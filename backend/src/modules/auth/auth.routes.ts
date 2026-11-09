import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, gt } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
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
import { createAccessToken } from "../../security/jwt";
import { AppError } from "../../security/error-handler";
import { rateLimiter } from "../../security/rate-limiter";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { SECURITY_LIMITS } from "../../config/constants";
import { EmailService } from "../../services/email.service";
import { requireSecret } from "../../security/secrets";
import {
  clearCustomerSessionCookie,
  clearTenantSessionCookie,
  tenantSessionCookie,
} from "../../security/session-cookie";

export const authRouter = new Hono<AppEnv>();

const loginSchema = z.object({
  email: z.string().email(),
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
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
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

// Tenant Store Email/Password Login
authRouter.post(
  "/login",
  rateLimiter({ max: 10, windowMs: 60 * 1000 }),
  zValidator("json", loginSchema),
  async (c) => {
    const tenant = c.get("tenant")!;

    if (tenant.status === "PENDING") {
      throw new AppError(
        "This store is currently pending activation by the Store254 Super Admin team. You will receive an email confirmation once activated.",
        403,
        "STORE_PENDING_ACTIVATION"
      );
    }

    const { email, password } = c.req.valid("json");
    const normalizedEmail = email.toLowerCase().trim();

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.email, normalizedEmail)))
      .limit(1);

    if (!user) {
      throw new AppError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
    }

    if (user.status !== "ACTIVE") {
      throw new AppError("Your account has been deactivated. Please contact support.", 403, "ACCOUNT_INACTIVE");
    }

    // If account was created purely with Google, prompt to use Google Sign-In
    if (user.passwordHash.startsWith("oauth$google$")) {
      throw new AppError(
        "This account was created with Google. Please click 'Sign in with Google' to continue.",
        400,
        "USE_GOOGLE_LOGIN"
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new AppError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
    }

    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    const secret = requireSecret(c.env?.JWT_SECRET, "JWT_SECRET");
    const token = await createAccessToken(
      {
        id: user.id,
        tenantId: tenant.id,
        email: user.email,
        role: user.role,
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
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
          role: user.role,
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
    const { email } = c.req.valid("json");
    const normalizedEmail = email.toLowerCase().trim();

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [user] = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.email, normalizedEmail)))
      .limit(1);

    // Prevent email enumeration
    if (!user) {
      return c.json({
        success: true,
        message: "If an account exists with this email, a recovery OTP has been sent.",
      });
    }

    // Invalidate existing OTPs
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
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.insert(passwordResetOtps).values({
      id: generateUUID(),
      tenantId: tenant.id,
      email: normalizedEmail,
      otpHash: hashedOtp,
      expiresAt,
      isUsed: false,
    });

    await EmailService.sendPasswordResetOtp({
      to: normalizedEmail,
      fullName: user.fullName || "Valued Customer",
      otpCode: otp,
      expiresMinutes: 15,
    });

    return c.json({
      success: true,
      message: "If an account exists with this email, a recovery OTP has been sent.",
    });
  }
);

// Storefront Customer / Staff Reset Password: Verify OTP & Update Password
authRouter.post(
  "/reset-password",
  rateLimiter({ max: 5, windowMs: 15 * 60 * 1000 }),
  zValidator("json", resetPasswordSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const { email, otp, newPassword } = c.req.valid("json");
    const normalizedEmail = email.toLowerCase().trim();

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);
    const now = new Date();

    const [record] = await db
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
      .orderBy(desc(passwordResetOtps.createdAt))
      .limit(1);

    if (!record) {
      throw new AppError("Invalid or expired OTP code.", 400, "INVALID_OTP");
    }

    if (record.attempts >= record.maxAttempts) {
      await db.update(passwordResetOtps).set({ isUsed: true }).where(eq(passwordResetOtps.id, record.id));
      throw new AppError("Too many incorrect OTP attempts. Code has been invalidated.", 400, "OTP_LOCKED");
    }

    const isValid = await verifyOtp(otp, record.otpHash);
    if (!isValid) {
      await db.update(passwordResetOtps).set({ attempts: record.attempts + 1 }).where(eq(passwordResetOtps.id, record.id));
      throw new AppError("Incorrect OTP code. Please check and try again.", 400, "INCORRECT_OTP");
    }

    await db.update(passwordResetOtps).set({ isUsed: true }).where(eq(passwordResetOtps.id, record.id));

    const newPasswordHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(and(eq(users.tenantId, tenant.id), eq(users.email, normalizedEmail)));

    return c.json({
      success: true,
      message: "Password reset successfully. You may now log in with your new password.",
    });
  }
);

// Current User Profile
authRouter.get("/me", authMiddleware(true), async (c) => {
  const userContext = c.get("user")!;
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

  return c.json({
    success: true,
    data: user,
  });
});
