import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { tenants } from "../../db/schema/tenants";
import { users } from "../../db/schema/users";
import { sanitizeSubdomain } from "../../security/sanitize";
import { hashPassword, generateUUID } from "../../security/crypto";
import { createAccessToken } from "../../security/jwt";
import { AppError } from "../../security/error-handler";
import { rateLimiter } from "../../security/rate-limiter";
import { SECURITY_LIMITS } from "../../config/constants";

export const platformRouter = new Hono<AppEnv>();

// Register Store Input Schema
const registerStoreSchema = z.object({
  storeName: z.string().min(2, "Store name must be at least 2 characters").max(60),
  subdomain: z.string().min(2).max(32),
  businessType: z.enum(["RETAIL", "ELECTRONICS", "FURNITURE", "SERVICES", "GENERAL"]).default("GENERAL"),
  currency: z.string().length(3).default("KES"),
  ownerEmail: z.string().email("Valid email address required"),
  ownerPassword: z
    .string()
    .min(SECURITY_LIMITS.MIN_PASSWORD_LENGTH, "Password must be at least 8 characters")
    .max(SECURITY_LIMITS.MAX_PASSWORD_LENGTH),
  ownerFullName: z.string().min(2).max(80),
  ownerPhone: z.string().optional(),
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

// Register New Business & Create Store
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

    // Create Tenant
    await db.insert(tenants).values({
      id: tenantId,
      name: body.storeName,
      subdomain: sanitizedSub,
      businessType: body.businessType,
      currency: body.currency.toUpperCase(),
      status: "ACTIVE",
      settings: {
        theme: "default",
        contactEmail: body.ownerEmail,
        contactPhone: body.ownerPhone || null,
      },
    });

    // Create Owner User
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

    const jwtSecret = c.env.JWT_SECRET || "default-dev-secret-change-in-production";
    const token = await createAccessToken(
      {
        id: userId,
        tenantId,
        email: body.ownerEmail.toLowerCase(),
        role: "OWNER",
      },
      jwtSecret
    );

    const primaryDomain = c.env.PRIMARY_DOMAIN || "store254.co.ke";
    const storeUrl = `https://${sanitizedSub}.${primaryDomain}`;

    return c.json(
      {
        success: true,
        message: "Business store created successfully!",
        data: {
          store: {
            id: tenantId,
            name: body.storeName,
            subdomain: sanitizedSub,
            storeUrl,
            currency: body.currency.toUpperCase(),
          },
          owner: {
            id: userId,
            email: body.ownerEmail,
            fullName: body.ownerFullName,
            role: "OWNER",
          },
          accessToken: token,
        },
      },
      201
    );
  }
);
