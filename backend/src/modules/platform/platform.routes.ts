import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, gt } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { tenants } from "../../db/schema/tenants";
import { users } from "../../db/schema/users";
import { passwordResetOtps } from "../../db/schema/auth-tokens";
import { sanitizeSubdomain } from "../../security/sanitize";
import {
  hashPassword,
  generateUUID,
  generateNumericOtp,
  hashOtp,
  verifyOtp,
} from "../../security/crypto";
import { AppError } from "../../security/error-handler";
import { rateLimiter } from "../../security/rate-limiter";
import { SECURITY_LIMITS } from "../../config/constants";
import { EmailService } from "../../services/email.service";

export const platformRouter = new Hono<AppEnv>();

// Register Store Input Schema
const registerStoreSchema = z.object({
  storeName: z.string().min(2, "Store name must be at least 2 characters").max(60),
  subdomain: z.string().min(2).max(32),
  businessType: z
    .enum(["RETAIL", "ELECTRONICS", "FURNITURE", "SERVICES", "GENERAL"])
    .default("GENERAL"),
  currency: z.string().length(3).default("KES"),
  ownerEmail: z.string().email("Valid email address required"),
  ownerPassword: z
    .string()
    .min(SECURITY_LIMITS.MIN_PASSWORD_LENGTH, "Password must be at least 8 characters")
    .max(SECURITY_LIMITS.MAX_PASSWORD_LENGTH),
  ownerFullName: z.string().min(2).max(80),
  ownerPhone: z.string().optional(),
});

// Forgot Password Schemas
const forgotPasswordSchema = z.object({
  email: z.string().email(),
  clientOrigin: z.string().url().optional(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(6).max(8).optional(),
  token: z.string().min(16).max(128).optional(),
  newPassword: z
    .string()
    .min(SECURITY_LIMITS.MIN_PASSWORD_LENGTH)
    .max(SECURITY_LIMITS.MAX_PASSWORD_LENGTH),
});

// Check Subdomain Availability
platformRouter.get("/check-subdomain", async (c) => {
  const rawSubdomain = c.req.query("subdomain") || "";
  const cleaned = sanitizeSubdomain(rawSubdomain);

  if (!cleaned) {
    return c.json({
      success: true,
      data: {
        available: false,
        reason: "Invalid subdomain format or reserved keyword.",
      },
    });
  }

  if (!c.env?.DB) {
    return c.json({
      success: true,
      data: {
        subdomain: cleaned,
        available: true,
        reason: "Available",
      },
    });
  }

  const db = createDb(c.env.DB);
  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.subdomain, cleaned))
    .limit(1);

  return c.json({
    success: true,
    data: {
      subdomain: cleaned,
      available: !existing,
      reason: existing ? "Subdomain is already claimed." : "Available",
    },
  });
});

// Public Directory of Active Stores
platformRouter.get("/stores", async (c) => {
  if (!c.env?.DB) {
    throw new AppError("Database binding not initialized.", 500);
  }

  const db = createDb(c.env.DB);
  const activeStores = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      subdomain: tenants.subdomain,
      businessType: tenants.businessType,
      currency: tenants.currency,
      settings: tenants.settings,
      createdAt: tenants.createdAt,
      ownerName: users.fullName,
    })
    .from(tenants)
    .leftJoin(users, and(eq(users.tenantId, tenants.id), eq(users.role, "OWNER")))
    .where(eq(tenants.status, "ACTIVE"))
    .orderBy(desc(tenants.createdAt))
    .limit(50);

  return c.json({
    success: true,
    data: activeStores,
  });
});

// Register New Business & Create Store (Pending Super Admin Activation)
platformRouter.post(
  "/register-store",
  rateLimiter({ max: 5, windowMs: 60 * 1000 }), // Strict rate limit on registrations
  zValidator("json", registerStoreSchema),
  async (c) => {
    const body = c.req.valid("json");
    const sanitizedSub = sanitizeSubdomain(body.subdomain);

    if (!sanitizedSub) {
      throw new AppError(
        "Subdomain is reserved or invalid. Use lowercase letters, numbers, and hyphens (2-32 characters).",
        400,
        "INVALID_SUBDOMAIN"
      );
    }

    if (!c.env?.DB) {
      throw new AppError("Database binding not initialized.", 500);
    }

    const db = createDb(c.env.DB);

    // Verify subdomain uniqueness
    const [existingTenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.subdomain, sanitizedSub))
      .limit(1);

    if (existingTenant) {
      throw new AppError(
        `Subdomain "${sanitizedSub}" is already taken. Please choose another.`,
        409,
        "SUBDOMAIN_TAKEN"
      );
    }

    const tenantId = generateUUID();
    const userId = generateUUID();
    const hashedPassword = await hashPassword(body.ownerPassword);

    // 1. Create Tenant with status = PENDING (Admin approval required)
    await db.insert(tenants).values({
      id: tenantId,
      name: body.storeName,
      subdomain: sanitizedSub,
      businessType: body.businessType,
      currency: body.currency.toUpperCase(),
      status: "PENDING", // PENDING by default until Super Admin activates
      settings: {
        theme: "default",
        primaryColor: "#9a3412",
        contactEmail: body.ownerEmail,
        contactPhone: body.ownerPhone || null,
      },
    });

    // 2. Create Owner User
    await db.insert(users).values({
      id: userId,
      tenantId: tenantId,
      email: body.ownerEmail.toLowerCase(),
      passwordHash: hashedPassword,
      fullName: body.ownerFullName,
      phone: body.ownerPhone || null,
      role: "OWNER",
      status: "ACTIVE",
    });

    const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";
    const storeUrl = `https://${sanitizedSub}.${primaryDomain}`;

    // 3. Send Pending Activation Notice from official email
    await EmailService.sendStorePendingActivation({
      to: body.ownerEmail,
      storeName: body.storeName,
      subdomain: sanitizedSub,
      primaryDomain,
      apiKey: c.env?.RESEND_API_KEY,
    });

    return c.json(
      {
        success: true,
        message:
          "Business store registered successfully! Your account is currently under review by Our 254 team. You will receive an email confirmation once activated.",
        data: {
          store: {
            id: tenantId,
            name: body.storeName,
            subdomain: sanitizedSub,
            storeUrl,
            status: "PENDING",
            currency: body.currency.toUpperCase(),
          },
          owner: {
            id: userId,
            email: body.ownerEmail,
            fullName: body.ownerFullName,
            role: "OWNER",
          },
        },
      },
      201
    );
  }
);

// Platform Password Recovery: Request OTP
platformRouter.post(
  "/forgot-password",
  rateLimiter({ max: 5, windowMs: 15 * 60 * 1000 }), // Max 5 requests per 15 mins
  zValidator("json", forgotPasswordSchema),
  async (c) => {
    const { email } = c.req.valid("json");
    const normalizedEmail = email.toLowerCase().trim();

    if (!c.env?.DB) {
      throw new AppError("Database binding not initialized.", 500);
    }

    const db = createDb(c.env.DB);

    // Look up owner user across platform
    const [user] = await db
      .select({ id: users.id, email: users.email, fullName: users.fullName })
      .from(users)
      .where(and(eq(users.email, normalizedEmail), eq(users.role, "OWNER")))
      .limit(1);

    // Safe response to prevent account enumeration
    if (!user) {
      return c.json({
        success: true,
        message: "If an account exists with this email, a recovery OTP has been sent.",
      });
    }

    // Invalidate any existing active OTPs for this email
    await db
      .update(passwordResetOtps)
      .set({ isUsed: true })
      .where(eq(passwordResetOtps.email, normalizedEmail));

    // Generate 6-digit numeric OTP and URL reset token
    const otp = generateNumericOtp(6);
    const hashedOtp = await hashOtp(otp);
    const resetToken = generateUUID() + "-" + generateNumericOtp(8);
    const hashedToken = await hashOtp(resetToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes validity

    // Store URL token record
    await db.insert(passwordResetOtps).values({
      id: generateUUID(),
      email: normalizedEmail,
      otpHash: hashedToken,
      expiresAt,
      isUsed: false,
    });

    // Store 6-digit OTP record
    await db.insert(passwordResetOtps).values({
      id: generateUUID(),
      email: normalizedEmail,
      otpHash: hashedOtp,
      expiresAt,
      isUsed: false,
    });

    const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";
    const origin = (c.req.valid("json") as any).clientOrigin || c.req.header("origin") || `https://${primaryDomain}`;
    const resetLink = `${origin}/admin.html?reset_token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(normalizedEmail)}`;

    // Send official recovery email with direct reset button & OTP
    await EmailService.sendPasswordResetLink({
      to: normalizedEmail,
      fullName: user.fullName || "Store Owner",
      resetLink,
      otpCode: otp,
      expiresMinutes: 30,
      storeName: "Store254 Platform",
      apiKey: c.env?.RESEND_API_KEY,
    });

    return c.json({
      success: true,
      message: "If an account exists with this email, a recovery link has been sent.",
    });
  }
);

// Platform Password Recovery: Verify Token / OTP & Reset Password
platformRouter.post(
  "/reset-password",
  rateLimiter({ max: 5, windowMs: 15 * 60 * 1000 }),
  zValidator("json", resetPasswordSchema),
  async (c) => {
    const { email, otp, token, newPassword } = c.req.valid("json");
    const normalizedEmail = email.toLowerCase().trim();

    if (!otp && !token) {
      throw new AppError("Either reset token or OTP code is required.", 400, "MISSING_TOKEN");
    }

    if (!c.env?.DB) {
      throw new AppError("Database binding not initialized.", 500);
    }

    const db = createDb(c.env.DB);
    const now = new Date();

    const candidateCodes = [token, otp].filter(Boolean) as string[];

    // Find active records
    const activeRecords = await db
      .select()
      .from(passwordResetOtps)
      .where(
        and(
          eq(passwordResetOtps.email, normalizedEmail),
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
      .where(eq(passwordResetOtps.email, normalizedEmail));

    // Hash new password and update all matching user accounts for this email
    const newPasswordHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.email, normalizedEmail));

    return c.json({
      success: true,
      message: "Password reset successfully. You may now log in with your new password.",
    });
  }
);
