import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, gt, lt, or, inArray, isNotNull, sql } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { tenants } from "../../db/schema/tenants";
import { users } from "../../db/schema/users";
import { passwordResetOtps } from "../../db/schema/auth-tokens";
import {
  verifyPassword,
  hashPassword,
  generateUUID,
  generateNumericOtp,
  hashOtp,
  verifyOtp,
} from "../../security/crypto";
import { slugify } from "../../security/sanitize";
import { createAccessToken, verifyAccessToken, verifyCustomerSsoToken } from "../../security/jwt";
import { AppError } from "../../security/error-handler";
import { rateLimiter } from "../../security/rate-limiter";
import {
  authMiddleware,
  getStaffPermissions,
  requireRole,
  STAFF_PERMISSIONS,
} from "../../middlewares/auth.middleware";
import { SECURITY_LIMITS } from "../../config/constants";
import { EmailService } from "../../services/email.service";
import { findMerchantStoresByEmail } from "../../services/user-stores.service";
import { requireSecret } from "../../security/secrets";
import {
  CUSTOMER_SESSION_COOKIE,
  clearCustomerSessionCookie,
  clearTenantSessionCookie,
  getCookieValue,
  getTenantSessionCookieValue,
  tenantSessionCookie,
} from "../../security/session-cookie";

export const authRouter = new Hono<AppEnv>();

const loginSchema = z.object({
  email: z.string().min(1, "Username or email is required"),
  password: z.string().min(1),
});

const registerCustomerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(SECURITY_LIMITS.MIN_PASSWORD_LENGTH)
    .max(SECURITY_LIMITS.MAX_PASSWORD_LENGTH),
  fullName: z.string().min(2).max(80),
  phone: z.string().optional(),
});

const verifyEmailSchema = z.object({
  email: z.string().email(),
  otp: z.string().trim().min(6).max(8),
});

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required"),
  clientOrigin: z.string().optional(),
});

const resetPasswordSchema = z.object({
  email: z.string().min(1, "Email is required"),
  otp: z.string().optional(),
  token: z.string().optional(),
  newPassword: z
    .string()
    .min(SECURITY_LIMITS.MIN_PASSWORD_LENGTH)
    .max(SECURITY_LIMITS.MAX_PASSWORD_LENGTH),
});

authRouter.get("/google/config", (c) => {
  const clientId = c.env?.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = c.env?.GOOGLE_CLIENT_SECRET?.trim() || "";
  const enabled =
    Boolean(clientId && clientSecret) &&
    !/^(your_|replace_|placeholder)/i.test(clientId) &&
    !/^(your_|replace_|placeholder)/i.test(clientSecret);
  const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";
  return c.json({
    success: true,
    data: {
      enabled,
      loginUrl: enabled ? `https://${primaryDomain}/auth/google/login` : null,
    },
  });
});

authRouter.post("/logout", async (c) => {
  const tenant = c.get("tenant");
  const secret = c.env?.JWT_SECRET;

  if (tenant && secret && c.env?.DB) {
    const db = createDb(c.env.DB);
    const authHeader = c.req.header("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;
    const cookieHeader = c.req.header("cookie");
    const tenantCookieToken = bearerToken ? null : getTenantSessionCookieValue(cookieHeader);
    const token = bearerToken || tenantCookieToken;

    let revoked = false;
    if (token) {
      const tokenUser = await verifyAccessToken(token, secret, tenant.id);
      if (tokenUser) {
        await db
          .update(users)
          .set({ tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() })
          .where(and(eq(users.id, tokenUser.id), eq(users.tenantId, tenant.id)));
        revoked = true;
      }
    }

    if (!revoked) {
      const ssoToken = getCookieValue(cookieHeader, CUSTOMER_SESSION_COOKIE);
      if (ssoToken) {
        const googleUser = await verifyCustomerSsoToken(ssoToken, secret);
        if (googleUser) {
          const normalizedEmail = googleUser.email.toLowerCase().trim();
          await db
            .update(users)
            .set({ tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() })
            .where(and(eq(users.tenantId, tenant.id), sql`lower(${users.email}) = ${normalizedEmail}`));
        }
      }
    }
  }

  const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";
  const isDev = c.env?.ENVIRONMENT === "development";
  c.header("Set-Cookie", clearCustomerSessionCookie(primaryDomain), { append: true });
  c.header("Set-Cookie", clearTenantSessionCookie(isDev), { append: true });
  if (!isDev) {
    c.header("Set-Cookie", clearTenantSessionCookie(true), { append: true });
  }
  return c.json({ success: true, message: "Signed out successfully." });
});

async function verifyCandidatePassword(
  password: string,
  passwordHash: string | null | undefined
): Promise<boolean> {
  if (!passwordHash || passwordHash.startsWith("oauth$google$")) return false;
  return verifyPassword(password, passwordHash);
}

function escapeHtml(value: string | undefined | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveCanonicalTenantOrigin(
  tenant: { subdomain: string; customDomain?: string | null },
  primaryDomainEnv?: string
): string {
  const rawDomain = (primaryDomainEnv || "store254.co.ke").trim().toLowerCase();
  const safePrimary = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(rawDomain)
    ? rawDomain
    : "store254.co.ke";
  return `https://${tenant.subdomain}.${safePrimary}`;
}

async function recordFailedOtpAttempts(
  db: ReturnType<typeof createDb>,
  recordIds: string[]
): Promise<void> {
  if (recordIds.length === 0) return;
  await db
    .update(passwordResetOtps)
    .set({
      attempts: sql`${passwordResetOtps.attempts} + 1`,
      isUsed: sql`CASE WHEN ${passwordResetOtps.attempts} + 1 >= ${passwordResetOtps.maxAttempts} THEN 1 ELSE ${passwordResetOtps.isUsed} END`,
    })
    .where(
      and(
        inArray(passwordResetOtps.id, recordIds),
        eq(passwordResetOtps.isUsed, false),
        lt(passwordResetOtps.attempts, passwordResetOtps.maxAttempts)
      )
    );
}

async function consumeOtpRecord(
  db: ReturnType<typeof createDb>,
  recordId: string
): Promise<boolean> {
  const [consumed] = await db
    .update(passwordResetOtps)
    .set({ isUsed: true })
    .where(
      and(
        eq(passwordResetOtps.id, recordId),
        eq(passwordResetOtps.isUsed, false),
        lt(passwordResetOtps.attempts, passwordResetOtps.maxAttempts)
      )
    )
    .returning({ id: passwordResetOtps.id });
  return Boolean(consumed);
}

async function sendEmailVerificationOtp(params: {
  to: string;
  fullName: string;
  otpCode: string;
  storeName: string;
  env?: AppEnv["Bindings"];
}): Promise<void> {
  const safeName = escapeHtml(params.fullName);
  const safeStore = escapeHtml(params.storeName);
  const safeOtp = escapeHtml(params.otpCode);
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h2>Verify Your Email Address</h2>
      <p>Hello <strong>${safeName}</strong>,</p>
      <p>Use the 6-digit verification code below to activate your customer account on <strong>${safeStore}</strong>:</p>
      <div style="background:#f3f4f6;border-radius:8px;padding:16px;text-align:center;margin:20px 0;font-size:28px;font-weight:800;letter-spacing:6px;">
        ${safeOtp}
      </div>
      <p>This code expires in <strong>30 minutes</strong>. Do not share it with anyone.</p>
    </div>
  `;
  await EmailService.send({
    to: params.to,
    subject: `[${params.storeName}] Verify your email address`,
    html,
    apiKey: params.env?.RESEND_API_KEY,
    smtp: EmailService.smtpFromEnv(params.env),
    redactInLogs: [params.otpCode],
  });
}

async function saveStaffPermissions(
  db: ReturnType<typeof createDb>,
  tenantId: string,
  staffUserId: string,
  permissions: string[] | null
): Promise<void> {
  const [freshTenant] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const currentSettings =
    freshTenant?.settings && typeof freshTenant.settings === "object"
      ? { ...(freshTenant.settings as Record<string, unknown>) }
      : {};
  const existingMap =
    currentSettings.staffPermissions && typeof currentSettings.staffPermissions === "object"
      ? { ...(currentSettings.staffPermissions as Record<string, unknown>) }
      : {};

  if (permissions === null) {
    delete existingMap[staffUserId];
  } else {
    existingMap[staffUserId] = permissions;
  }

  currentSettings.staffPermissions = existingMap;
  await db
    .update(tenants)
    .set({ settings: currentSettings, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
}

// Tenant Store Email/Password Login
authRouter.post(
  "/login",
  rateLimiter({ max: 10, windowMs: 60 * 1000 }),
  zValidator("json", loginSchema),
  async (c) => {
    const tenant = c.get("tenant")!;

    if (tenant.status === "PENDING") {
      throw new AppError(
        "This store is currently pending activation by Our 254 team. You will receive an email confirmation once activated.",
        403,
        "STORE_PENDING_ACTIVATION"
      );
    }

    const { email, password } = c.req.valid("json");
    const normalizedEmail = email.toLowerCase().trim();

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [matchedUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenant.id),
          or(
            sql`lower(${users.email}) = ${normalizedEmail}`,
            sql`lower(${users.email}) = ${`${normalizedEmail}@${tenant.subdomain}.store254.co.ke`}`
          )
        )
      )
      .limit(1);

    const passwordMatched = matchedUser
      ? await verifyCandidatePassword(password, matchedUser.passwordHash)
      : false;
    const isEmailVerified =
      Boolean(matchedUser?.emailVerifiedAt) || matchedUser?.role === "STAFF";

    // Uniform 401 prevents account status, provider, and existence enumeration
    if (
      !matchedUser ||
      !passwordMatched ||
      matchedUser.status !== "ACTIVE" ||
      !isEmailVerified
    ) {
      throw new AppError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
    }

    if (tenant.status === "SUSPENDED" && !["OWNER", "ADMIN"].includes(matchedUser.role)) {
      throw new AppError(
        "This store is temporarily paused. Store accounts cannot sign in until the owner reactivates it.",
        403,
        "STORE_SUSPENDED"
      );
    }

    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, matchedUser.id));

    const permissions =
      matchedUser.role === "STAFF"
        ? getStaffPermissions(tenant.settings, matchedUser.id)
        : ["OWNER", "ADMIN"].includes(matchedUser.role)
        ? ["*"]
        : undefined;

    const secret = requireSecret(c.env?.JWT_SECRET, "JWT_SECRET");
    const token = await createAccessToken(
      {
        id: matchedUser.id,
        tenantId: tenant.id,
        email: matchedUser.email,
        role: matchedUser.role,
        tokenVersion: matchedUser.tokenVersion ?? 0,
        ...(permissions ? { permissions } : {}),
      },
      secret
    );

    const isDev = c.env?.ENVIRONMENT === "development";
    c.header("Set-Cookie", tenantSessionCookie(token, isDev));

    return c.json({
      success: true,
      message: "Login successful.",
      data: {
        user: {
          id: matchedUser.id,
          email: matchedUser.email,
          fullName: matchedUser.fullName,
          avatarUrl: matchedUser.avatarUrl,
          role: matchedUser.role,
          ...(permissions ? { permissions } : {}),
        },
        accessToken: token,
      },
    });
  }
);

// Register Customer on Storefront (Requires email OTP verification before activation)
authRouter.post(
  "/register",
  rateLimiter({ max: 5, windowMs: 60 * 1000 }),
  zValidator("json", registerCustomerSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const body = c.req.valid("json");
    const normalizedEmail = body.email.toLowerCase().trim();

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenant.id), sql`lower(${users.email}) = ${normalizedEmail}`))
      .limit(1);

    if (existing) {
      throw new AppError(
        "An account with this email address already exists for this store.",
        409,
        "EMAIL_EXISTS"
      );
    }

    const userId = generateUUID();
    const hashedPassword = await hashPassword(body.password);

    await db.insert(users).values({
      id: userId,
      tenantId: tenant.id,
      email: normalizedEmail,
      passwordHash: hashedPassword,
      fullName: body.fullName,
      phone: body.phone || null,
      role: "CUSTOMER",
      status: "PENDING_VERIFICATION",
      emailVerifiedAt: null,
      tokenVersion: 0,
    });

    const verificationEmailKey = `verify:${normalizedEmail}`;
    await db
      .update(passwordResetOtps)
      .set({ isUsed: true })
      .where(
        and(
          eq(passwordResetOtps.email, verificationEmailKey),
          eq(passwordResetOtps.tenantId, tenant.id)
        )
      );

    const otp = generateNumericOtp(6);
    const otpHash = await hashOtp(`verify_email:${otp}`);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await db.insert(passwordResetOtps).values({
      id: generateUUID(),
      tenantId: tenant.id,
      email: verificationEmailKey,
      otpHash,
      attempts: 0,
      maxAttempts: 3,
      expiresAt,
      isUsed: false,
    });

    await sendEmailVerificationOtp({
      to: normalizedEmail,
      fullName: body.fullName,
      otpCode: otp,
      storeName: tenant.name,
      env: c.env,
    });

    return c.json(
      {
        success: true,
        message: "Verification code sent to your email. Please verify your email before signing in.",
        data: {
          verificationRequired: true,
          user: {
            id: userId,
            email: normalizedEmail,
            fullName: body.fullName,
            role: "CUSTOMER",
            status: "PENDING_VERIFICATION",
          },
        },
      },
      201
    );
  }
);

// Verify Customer Email Address via 6-digit OTP
authRouter.post(
  "/verify-email",
  rateLimiter({ max: 5, windowMs: 15 * 60 * 1000 }),
  zValidator("json", verifyEmailSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const { email, otp } = c.req.valid("json");
    const normalizedEmail = email.toLowerCase().trim();
    const verificationEmailKey = `verify:${normalizedEmail}`;

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);
    const now = new Date();

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenant.id), sql`lower(${users.email}) = ${normalizedEmail}`))
      .limit(1);

    if (!user || user.status === "SUSPENDED") {
      throw new AppError("Invalid or expired verification code.", 400, "INVALID_VERIFICATION_CODE");
    }

    const activeRecords = await db
      .select()
      .from(passwordResetOtps)
      .where(
        and(
          eq(passwordResetOtps.email, verificationEmailKey),
          eq(passwordResetOtps.tenantId, tenant.id),
          eq(passwordResetOtps.isUsed, false),
          gt(passwordResetOtps.expiresAt, now),
          lt(passwordResetOtps.attempts, passwordResetOtps.maxAttempts)
        )
      )
      .orderBy(desc(passwordResetOtps.createdAt));

    if (!activeRecords.length) {
      throw new AppError("Invalid or expired verification code.", 400, "INVALID_VERIFICATION_CODE");
    }

    let matchedRecord = null;
    for (const record of activeRecords) {
      if (await verifyOtp(`verify_email:${otp}`, record.otpHash)) {
        matchedRecord = record;
        break;
      }
    }

    if (!matchedRecord) {
      await recordFailedOtpAttempts(
        db,
        activeRecords.map((r) => r.id)
      );
      throw new AppError("Invalid or expired verification code.", 400, "INVALID_VERIFICATION_CODE");
    }

    const consumed = await consumeOtpRecord(db, matchedRecord.id);
    if (!consumed) {
      throw new AppError("Invalid or expired verification code.", 400, "INVALID_VERIFICATION_CODE");
    }

    await db
      .update(passwordResetOtps)
      .set({ isUsed: true })
      .where(
        and(
          eq(passwordResetOtps.email, verificationEmailKey),
          eq(passwordResetOtps.tenantId, tenant.id)
        )
      );

    await db
      .update(users)
      .set({
        status: "ACTIVE",
        emailVerifiedAt: user.emailVerifiedAt || now,
        lastLoginAt: now,
        updatedAt: now,
      })
      .where(and(eq(users.id, user.id), eq(users.tenantId, tenant.id)));

    const secret = requireSecret(c.env?.JWT_SECRET, "JWT_SECRET");
    const token = await createAccessToken(
      {
        id: user.id,
        tenantId: tenant.id,
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion ?? 0,
      },
      secret
    );

    const isDev = c.env?.ENVIRONMENT === "development";
    c.header("Set-Cookie", tenantSessionCookie(token, isDev));

    return c.json({
      success: true,
      message: "Email verified successfully.",
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: "ACTIVE",
        },
        accessToken: token,
      },
    });
  }
);

// Resend Email Verification OTP
authRouter.post(
  "/resend-verification",
  rateLimiter({ max: 5, windowMs: 15 * 60 * 1000 }),
  zValidator("json", resendVerificationSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const { email } = c.req.valid("json");
    const normalizedEmail = email.toLowerCase().trim();

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        status: users.status,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      .where(and(eq(users.tenantId, tenant.id), sql`lower(${users.email}) = ${normalizedEmail}`))
      .limit(1);

    if (user && user.status === "PENDING_VERIFICATION" && !user.emailVerifiedAt) {
      const verificationEmailKey = `verify:${normalizedEmail}`;
      await db
        .update(passwordResetOtps)
        .set({ isUsed: true })
        .where(
          and(
            eq(passwordResetOtps.email, verificationEmailKey),
            eq(passwordResetOtps.tenantId, tenant.id)
          )
        );

      const otp = generateNumericOtp(6);
      const otpHash = await hashOtp(`verify_email:${otp}`);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await db.insert(passwordResetOtps).values({
        id: generateUUID(),
        tenantId: tenant.id,
        email: verificationEmailKey,
        otpHash,
        attempts: 0,
        maxAttempts: 3,
        expiresAt,
        isUsed: false,
      });

      await sendEmailVerificationOtp({
        to: normalizedEmail,
        fullName: user.fullName || "Customer",
        otpCode: otp,
        storeName: tenant.name,
        env: c.env,
      });
    }

    return c.json({
      success: true,
      message: "If an unverified account exists with this email, a new verification code has been sent.",
    });
  }
);

// Storefront Customer / Staff Forgot Password: Send OTP
authRouter.post(
  "/forgot-password",
  rateLimiter({ max: 5, windowMs: 15 * 60 * 1000 }),
  zValidator("json", forgotPasswordSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const { email } = c.req.valid("json");
    const normalizedEmail = email.toLowerCase().trim();

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [user] = await db
      .select({ id: users.id, fullName: users.fullName, email: users.email })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenant.id),
          eq(users.status, "ACTIVE"),
          isNotNull(users.emailVerifiedAt),
          or(
            sql`lower(${users.email}) = ${normalizedEmail}`,
            sql`lower(${users.email}) = ${`${normalizedEmail}@${tenant.subdomain}.store254.co.ke`}`
          )
        )
      )
      .limit(1);

    // Prevent email enumeration
    if (!user) {
      return c.json({
        success: true,
        message: "If an account exists with this email, a recovery link has been sent.",
      });
    }

    const targetEmail = user.email.toLowerCase().trim();

    // Invalidate existing OTPs/tokens
    await db
      .update(passwordResetOtps)
      .set({ isUsed: true })
      .where(
        and(
          eq(passwordResetOtps.email, targetEmail),
          eq(passwordResetOtps.tenantId, tenant.id)
        )
      );

    const otp = generateNumericOtp(6);
    const hashedOtp = await hashOtp(otp);
    const resetToken = generateUUID() + "-" + generateNumericOtp(8);
    const hashedToken = await hashOtp(resetToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Store secure link token
    await db.insert(passwordResetOtps).values({
      id: generateUUID(),
      tenantId: tenant.id,
      email: targetEmail,
      otpHash: hashedToken,
      attempts: 0,
      maxAttempts: 3,
      expiresAt,
      isUsed: false,
    });

    // Store 6-digit OTP
    await db.insert(passwordResetOtps).values({
      id: generateUUID(),
      tenantId: tenant.id,
      email: targetEmail,
      otpHash: hashedOtp,
      attempts: 0,
      maxAttempts: 3,
      expiresAt,
      isUsed: false,
    });

    // SEC-03: Always construct reset links from canonical server-configured origin
    const origin = resolveCanonicalTenantOrigin(tenant, c.env?.PRIMARY_DOMAIN);
    const resetLink = `${origin}/admin.html?reset_token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(targetEmail)}`;

    await EmailService.sendPasswordResetLink({
      to: targetEmail,
      fullName: user.fullName || "Store Admin",
      resetLink,
      otpCode: otp,
      expiresMinutes: 30,
      storeName: tenant.name,
      apiKey: c.env?.RESEND_API_KEY,
      smtp: EmailService.smtpFromEnv(c.env),
    });

    return c.json({
      success: true,
      message: "If an account exists with this email, a recovery link has been sent.",
    });
  }
);

// Storefront Customer / Staff Reset Password: Verify Token / OTP & Update Password
authRouter.post(
  "/reset-password",
  rateLimiter({ max: 5, windowMs: 15 * 60 * 1000 }),
  zValidator("json", resetPasswordSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const { email, otp, token, newPassword } = c.req.valid("json");
    const normalizedEmail = email.toLowerCase().trim();

    if (!otp && !token) {
      throw new AppError("Either reset token or OTP code is required.", 400, "MISSING_TOKEN");
    }

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);
    const now = new Date();

    const candidateCodes = [token, otp].filter(Boolean) as string[];
    const candidateEmails = [
      normalizedEmail,
      `${normalizedEmail}@${tenant.subdomain}.store254.co.ke`,
    ];

    const activeRecords = await db
      .select()
      .from(passwordResetOtps)
      .where(
        and(
          inArray(passwordResetOtps.email, candidateEmails),
          eq(passwordResetOtps.tenantId, tenant.id),
          eq(passwordResetOtps.isUsed, false),
          gt(passwordResetOtps.expiresAt, now),
          lt(passwordResetOtps.attempts, passwordResetOtps.maxAttempts)
        )
      )
      .orderBy(desc(passwordResetOtps.createdAt));

    if (!activeRecords.length) {
      throw new AppError("Invalid or expired password reset link.", 400, "INVALID_TOKEN");
    }

    let matchedRecord = null;
    for (const record of activeRecords) {
      for (const code of candidateCodes) {
        if (await verifyOtp(code, record.otpHash)) {
          matchedRecord = record;
          break;
        }
      }
      if (matchedRecord) break;
    }

    if (!matchedRecord) {
      await recordFailedOtpAttempts(
        db,
        activeRecords.map((r) => r.id)
      );
      throw new AppError("Incorrect or expired recovery code.", 400, "INVALID_TOKEN");
    }

    const consumed = await consumeOtpRecord(db, matchedRecord.id);
    if (!consumed) {
      throw new AppError("Invalid or expired password reset link.", 400, "INVALID_TOKEN");
    }

    // Invalidate all remaining tokens for this email within the tenant
    await db
      .update(passwordResetOtps)
      .set({ isUsed: true })
      .where(
        and(
          eq(passwordResetOtps.email, matchedRecord.email),
          eq(passwordResetOtps.tenantId, tenant.id)
        )
      );

    const newPasswordHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.tenantId, tenant.id),
          eq(users.status, "ACTIVE"),
          sql`lower(${users.email}) = ${matchedRecord.email}`
        )
      );

    return c.json({
      success: true,
      message: "Password reset successfully. You may now log in with your new password.",
    });
  }
);

// Current User Profile
authRouter.get("/me", authMiddleware(true), async (c) => {
  const userContext = c.get("user")!;
  const tenant = c.get("tenant")!;
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      phone: users.phone,
      role: users.role,
      status: users.status,
      emailVerifiedAt: users.emailVerifiedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, userContext.id), eq(users.tenantId, userContext.tenantId)))
    .limit(1);

  if (!user) {
    throw new AppError("User not found.", 404, "USER_NOT_FOUND");
  }

  const effectiveRole = userContext.role === "CUSTOMER" ? "CUSTOMER" : user.role;
  const permissions =
    effectiveRole === "STAFF"
      ? getStaffPermissions(tenant.settings, user.id)
      : ["OWNER", "ADMIN"].includes(effectiveRole)
      ? ["*"]
      : undefined;

  let storeSummary: Awaited<ReturnType<typeof findMerchantStoresByEmail>> = {
    stores: [],
    activeStore: null,
  };
  const isVerifiedActiveUser = Boolean(user.emailVerifiedAt) && user.status === "ACTIVE";
  if (isVerifiedActiveUser) {
    try {
      storeSummary = await findMerchantStoresByEmail(db, user.email, {
        emailVerified: true,
      });
    } catch {
      storeSummary = { stores: [], activeStore: null };
    }
  }

  return c.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      role: effectiveRole,
      status: user.status,
      emailVerified: Boolean(user.emailVerifiedAt),
      createdAt: user.createdAt,
      ...(permissions ? { permissions } : {}),
      stores: storeSummary.stores,
      activeStore: storeSummary.activeStore,
    },
  });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(SECURITY_LIMITS.MIN_PASSWORD_LENGTH, "New password must be at least 8 characters")
    .max(SECURITY_LIMITS.MAX_PASSWORD_LENGTH),
});

// Change Own Store Admin / Staff Password
authRouter.post(
  "/change-password",
  authMiddleware(true),
  requireRole(["OWNER", "ADMIN", "STAFF"]),
  zValidator("json", changePasswordSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const userContext = c.get("user")!;
    const { currentPassword, newPassword } = c.req.valid("json");

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [userRow] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userContext.id), eq(users.tenantId, tenant.id)))
      .limit(1);

    if (!userRow) {
      throw new AppError("Account not found.", 404, "USER_NOT_FOUND");
    }

    if (userRow.passwordHash.startsWith("oauth$google$")) {
      throw new AppError(
        "This account uses Google Sign-In and does not have a store password to change.",
        400,
        "USE_GOOGLE_LOGIN"
      );
    }

    const currentValid = await verifyCandidatePassword(currentPassword, userRow.passwordHash);
    if (!currentValid) {
      throw new AppError("Current password is incorrect.", 400, "INVALID_CURRENT_PASSWORD");
    }

    const nextHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({
        passwordHash: nextHash,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userRow.id), eq(users.tenantId, tenant.id)));

    return c.json({
      success: true,
      message: "Store password updated successfully.",
    });
  }
);

const createStaffSchema = z.object({
  fullName: z.string().trim().min(2, "Staff name must be at least 2 characters").max(100),
  email: z.string().trim().max(150).optional(),
  password: z
    .string()
    .min(SECURITY_LIMITS.MIN_PASSWORD_LENGTH, "Staff password must be at least 8 characters")
    .max(SECURITY_LIMITS.MAX_PASSWORD_LENGTH),
  permissions: z
    .array(z.enum(STAFF_PERMISSIONS))
    .min(1, "Select at least one permission for this staff account"),
});

const updateStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  password: z
    .string()
    .min(SECURITY_LIMITS.MIN_PASSWORD_LENGTH, "Staff password must be at least 8 characters")
    .max(SECURITY_LIMITS.MAX_PASSWORD_LENGTH)
    .optional(),
  permissions: z
    .array(z.enum(STAFF_PERMISSIONS))
    .min(1, "Select at least one permission for this staff account")
    .optional(),
});

// List Staff Accounts & Granular Permissions (Owner only)
authRouter.get("/staff", authMiddleware(true), requireRole(["OWNER"]), async (c) => {
  const tenant = c.get("tenant")!;
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);

  const [freshTenant] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenant.id))
    .limit(1);

  const [ownerRow] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.role, "OWNER")))
    .limit(1);

  const staffRows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.role, "STAFF")))
    .orderBy(desc(users.createdAt));

  const staff = staffRows.map((row) => ({
    ...row,
    permissions: getStaffPermissions(freshTenant?.settings || tenant.settings, row.id),
  }));

  return c.json({
    success: true,
    data: {
      ownerEmail: ownerRow?.email || null,
      availablePermissions: STAFF_PERMISSIONS,
      staff,
    },
  });
});

// Create Staff Account with Specific Rights & Dedicated Staff Password (Owner only)
authRouter.post(
  "/staff",
  authMiddleware(true),
  requireRole(["OWNER"]),
  zValidator("json", createStaffSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const body = c.req.valid("json");
    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [ownerRow] = await db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.role, "OWNER")))
      .limit(1);

    const rawInputEmail = (body.email || "").trim().toLowerCase();
    let resolvedEmail = "";

    if (!rawInputEmail || rawInputEmail === ownerRow?.email?.toLowerCase()) {
      const slug = slugify(body.fullName).slice(0, 24) || "staff";
      const suffix = generateUUID().slice(0, 6);
      resolvedEmail = `staff.${slug}.${suffix}@${tenant.subdomain}.store254.co.ke`;
    } else if (!rawInputEmail.includes("@")) {
      const cleanLocal = slugify(rawInputEmail).slice(0, 32) || "staff";
      resolvedEmail = `${cleanLocal}@${tenant.subdomain}.store254.co.ke`;
    } else {
      const emailCheck = z.string().email().safeParse(rawInputEmail);
      if (!emailCheck.success) {
        throw new AppError("Enter a valid staff email address or leave blank.", 400, "INVALID_EMAIL");
      }
      resolvedEmail = rawInputEmail;
    }

    const [conflict] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.email, resolvedEmail)))
      .limit(1);
    if (conflict) {
      throw new AppError("An account with that email/username already exists in this store.", 409, "EMAIL_EXISTS");
    }

    const staffId = generateUUID();
    const passwordHash = await hashPassword(body.password);
    const uniquePermissions = Array.from(new Set(body.permissions));
    const isInternalSubdomainEmail = resolvedEmail.endsWith(
      `@${tenant.subdomain}.store254.co.ke`
    );

    await db.insert(users).values({
      id: staffId,
      tenantId: tenant.id,
      email: resolvedEmail,
      passwordHash,
      fullName: body.fullName,
      role: "STAFF",
      status: "ACTIVE",
      emailVerifiedAt: isInternalSubdomainEmail ? new Date() : null,
      tokenVersion: 0,
    });

    await saveStaffPermissions(db, tenant.id, staffId, uniquePermissions);

    return c.json(
      {
        success: true,
        message: `Staff account "${body.fullName}" created.`,
        data: {
          id: staffId,
          fullName: body.fullName,
          email: resolvedEmail,
          status: "ACTIVE",
          permissions: uniquePermissions,
        },
      },
      201
    );
  }
);

// Update Staff Account Permissions, Status, or Password (Owner only)
authRouter.patch(
  "/staff/:id",
  authMiddleware(true),
  requireRole(["OWNER"]),
  zValidator("json", updateStaffSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const staffId = c.req.param("id");
    const body = c.req.valid("json");
    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, staffId), eq(users.tenantId, tenant.id), eq(users.role, "STAFF")))
      .limit(1);

    if (!existing) {
      throw new AppError("Staff account not found.", 404, "STAFF_NOT_FOUND");
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.fullName !== undefined) updates.fullName = body.fullName;
    if (body.status !== undefined) updates.status = body.status;
    if (body.password !== undefined) {
      updates.passwordHash = await hashPassword(body.password);
    }
    if (body.password !== undefined || body.status === "SUSPENDED") {
      updates.tokenVersion = sql`${users.tokenVersion} + 1`;
    }

    await db
      .update(users)
      .set(updates)
      .where(and(eq(users.id, staffId), eq(users.tenantId, tenant.id)));

    if (body.permissions !== undefined) {
      await saveStaffPermissions(db, tenant.id, staffId, Array.from(new Set(body.permissions)));
    }

    const [freshTenant] = await db
      .select({ settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, tenant.id))
      .limit(1);

    const [updated] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, staffId))
      .limit(1);

    return c.json({
      success: true,
      message: "Staff account updated.",
      data: {
        ...updated,
        permissions: getStaffPermissions(freshTenant?.settings || tenant.settings, staffId),
      },
    });
  }
);

// Delete Staff Account (Owner only)
authRouter.delete(
  "/staff/:id",
  authMiddleware(true),
  requireRole(["OWNER"]),
  async (c) => {
    const tenant = c.get("tenant")!;
    const staffId = c.req.param("id");
    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, staffId), eq(users.tenantId, tenant.id), eq(users.role, "STAFF")))
      .limit(1);

    if (!existing) {
      throw new AppError("Staff account not found.", 404, "STAFF_NOT_FOUND");
    }

    await db
      .delete(users)
      .where(and(eq(users.id, staffId), eq(users.tenantId, tenant.id)));
    await saveStaffPermissions(db, tenant.id, staffId, null);

    return c.json({
      success: true,
      message: "Staff account removed.",
    });
  }
);
