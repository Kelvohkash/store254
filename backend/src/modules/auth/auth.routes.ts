import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, gt, or, inArray } from "drizzle-orm";
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
import { createAccessToken } from "../../security/jwt";
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
  clearCustomerSessionCookie,
  clearTenantSessionCookie,
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

authRouter.post("/logout", (c) => {
  const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";
  const isDev = c.env?.ENVIRONMENT === "development";
  c.header("Set-Cookie", clearCustomerSessionCookie(primaryDomain), { append: true });
  c.header("Set-Cookie", clearTenantSessionCookie(isDev), { append: true });
  return c.json({ success: true, message: "Signed out successfully." });
});

const DEMO_PASSWORD_HASHES = new Set([
  "pbkdf2$sha512$100000$3d29aa15a970e1fdeac9d6d57d2863f9$682a5c5e5a279f675ed7dcd9c3a3bd1b8f434b7082d93a48897f29ea0f20f866eb48d77b8eab66bc57576a336c51562d258dcd13e5115cf41b76978b003f2575",
  "pbkdf2$sha512$100000$dde6530e852bb302b2bb17283e0739b6$8f4c31e3e04f40779f18ba17a45a7ee0a924da1378bb73f1fd855c4d6b8fdffab1378807dbb326b175b64d9a0df5942c2d806d15e2131db1d1d4d748616f088c",
]);

async function verifyCandidatePassword(password: string, passwordHash: string): Promise<boolean> {
  if (!passwordHash || passwordHash.startsWith("oauth$google$")) return false;
  if (await verifyPassword(password, passwordHash)) return true;
  return (password === "1234" || password === "demo") && DEMO_PASSWORD_HASHES.has(passwordHash);
}

async function assertDistinctMerchantPassword(
  db: ReturnType<typeof createDb>,
  tenantId: string,
  candidatePassword: string,
  excludeUserId?: string
): Promise<void> {
  const merchantRows = await db
    .select({ id: users.id, role: users.role, passwordHash: users.passwordHash })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), inArray(users.role, ["OWNER", "ADMIN", "STAFF"])));
  for (const row of merchantRows) {
    if (excludeUserId && row.id === excludeUserId) continue;
    if (!row.passwordHash || row.passwordHash.startsWith("oauth$google$")) continue;
    if (await verifyPassword(candidatePassword, row.passwordHash)) {
      throw new AppError(
        "Each owner and staff password must be different so the store can distinguish owner vs staff login.",
        400,
        "PASSWORD_CONFLICT"
      );
    }
  }
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

    const [directUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenant.id),
          or(
            eq(users.email, normalizedEmail),
            eq(users.email, `${normalizedEmail}@demo.com`),
            eq(users.email, `${normalizedEmail}@${tenant.subdomain}.store254.co.ke`)
          )
        )
      )
      .limit(1);

    let matchedUser = directUser || null;
    let passwordMatched = false;

    if (matchedUser) {
      if (matchedUser.status !== "ACTIVE") {
        throw new AppError("Your account has been deactivated. Please contact support.", 403, "ACCOUNT_INACTIVE");
      }
      if (matchedUser.passwordHash.startsWith("oauth$google$")) {
        throw new AppError(
          "This account was created with Google. Please click 'Sign in with Google' to continue.",
          400,
          "USE_GOOGLE_LOGIN"
        );
      }
      passwordMatched = await verifyCandidatePassword(password, matchedUser.passwordHash);
    }

    // Dual Owner/Staff Password fallback: allow signing in with the store owner email (or "staff") + a staff password
    const isSharedStaffLogin =
      normalizedEmail === "staff" ||
      Boolean(matchedUser && ["OWNER", "ADMIN"].includes(matchedUser.role));

    if (!passwordMatched && isSharedStaffLogin) {
      const staffAccounts = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenant.id),
            eq(users.role, "STAFF"),
            eq(users.status, "ACTIVE")
          )
        );
      for (const staffCandidate of staffAccounts) {
        if (await verifyCandidatePassword(password, staffCandidate.passwordHash)) {
          matchedUser = staffCandidate;
          passwordMatched = true;
          break;
        }
      }
    }

    if (!matchedUser || !passwordMatched) {
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

// Register Customer on Storefront
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
      .where(and(eq(users.tenantId, tenant.id), eq(users.email, normalizedEmail)))
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
      status: "ACTIVE",
    });

    const secret = requireSecret(c.env?.JWT_SECRET, "JWT_SECRET");
    const token = await createAccessToken(
      {
        id: userId,
        tenantId: tenant.id,
        email: normalizedEmail,
        role: "CUSTOMER",
      },
      secret
    );

    return c.json(
      {
        success: true,
        message: "Customer account created successfully.",
        data: {
          user: {
            id: userId,
            email: normalizedEmail,
            fullName: body.fullName,
            role: "CUSTOMER",
          },
          accessToken: token,
        },
      },
      201
    );
  }
);

// Storefront Customer / Staff Forgot Password: Send OTP
authRouter.post(
  "/forgot-password",
  rateLimiter({ max: 5, windowMs: 15 * 60 * 1000 }),
  zValidator("json", forgotPasswordSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const { email, clientOrigin } = c.req.valid("json");
    const normalizedEmail = email.toLowerCase().trim();

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [user] = await db
      .select({ id: users.id, fullName: users.fullName, email: users.email })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenant.id),
          or(
            eq(users.email, normalizedEmail),
            eq(users.email, `${normalizedEmail}@demo.com`),
            eq(users.email, `${normalizedEmail}@${tenant.subdomain}.store254.co.ke`)
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

    // Invalidate existing OTPs/tokens
    await db
      .update(passwordResetOtps)
      .set({ isUsed: true })
      .where(
        and(
          eq(passwordResetOtps.email, normalizedEmail),
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
      email: normalizedEmail,
      otpHash: hashedToken,
      expiresAt,
      isUsed: false,
    });

    // Store 6-digit OTP
    await db.insert(passwordResetOtps).values({
      id: generateUUID(),
      tenantId: tenant.id,
      email: normalizedEmail,
      otpHash: hashedOtp,
      expiresAt,
      isUsed: false,
    });

    const origin = clientOrigin || c.req.header("origin") || `https://${tenant.subdomain}.store254.co.ke`;
    const resetLink = `${origin}/admin.html?reset_token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(normalizedEmail)}`;

    await EmailService.sendPasswordResetLink({
      to: normalizedEmail,
      fullName: user.fullName || "Store Admin",
      resetLink,
      otpCode: otp,
      expiresMinutes: 30,
      storeName: tenant.name,
      apiKey: c.env?.RESEND_API_KEY,
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

    const activeRecords = await db
      .select()
      .from(passwordResetOtps)
      .where(
        and(
          eq(passwordResetOtps.email, normalizedEmail),
          eq(passwordResetOtps.tenantId, tenant.id),
          eq(passwordResetOtps.isUsed, false),
          gt(passwordResetOtps.expiresAt, now)
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
      throw new AppError("Incorrect or expired recovery code.", 400, "INVALID_TOKEN");
    }

    // Invalidate all tokens for this email
    await db
      .update(passwordResetOtps)
      .set({ isUsed: true })
      .where(
        and(
          eq(passwordResetOtps.email, normalizedEmail),
          eq(passwordResetOtps.tenantId, tenant.id)
        )
      );

    const newPasswordHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.tenantId, tenant.id),
          or(
            eq(users.email, normalizedEmail),
            eq(users.email, `${normalizedEmail}@demo.com`),
            eq(users.email, `${normalizedEmail}@${tenant.subdomain}.store254.co.ke`)
          )
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
  try {
    storeSummary = await findMerchantStoresByEmail(db, user.email);
  } catch {
    storeSummary = { stores: [], activeStore: null };
  }

  return c.json({
    success: true,
    data: {
      ...user,
      role: effectiveRole,
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

    await assertDistinctMerchantPassword(db, tenant.id, newPassword, userRow.id);

    const nextHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ passwordHash: nextHash, updatedAt: new Date() })
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

    await assertDistinctMerchantPassword(db, tenant.id, body.password);

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

    await db.insert(users).values({
      id: staffId,
      tenantId: tenant.id,
      email: resolvedEmail,
      passwordHash,
      fullName: body.fullName,
      role: "STAFF",
      status: "ACTIVE",
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
      await assertDistinctMerchantPassword(db, tenant.id, body.password, staffId);
      updates.passwordHash = await hashPassword(body.password);
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
