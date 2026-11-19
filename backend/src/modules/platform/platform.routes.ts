import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, gt, lt, isNull, inArray, ne, sql } from "drizzle-orm";
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
import { businessTypeSchema } from "../../config/business-types";
import { EmailService } from "../../services/email.service";
import { locationsRouter } from "./locations.routes";
import { searchRouter } from "./search.routes";
import {
  marketplaceRouter,
  readPlatformGoogleUser,
  assertAllowedPlatformOrigin,
} from "./marketplace.routes";
import {
  singleItemsRouter,
  COMMUNITY_MARKET_TENANT_ID,
} from "./single-items.routes";
import { ridesRouter } from "./rides.routes";
import {
  clearCustomerSessionCookie,
} from "../../security/session-cookie";
import {
  LocationResolutionError,
  resolveOrCreateStoreLocation,
  resolveStorePinCoords,
} from "./locations.service";
import { kenyaLocations } from "../../db/schema/kenya-locations";
import { getStaticLocationById } from "./kenya-static-data";
import { findMerchantStoresByEmail } from "../../services/user-stores.service";
import { copyrightReports } from "../../db/schema/copyright-reports";
import { items } from "../../db/schema/items";
import { extractMediaReference } from "../../services/copyright-takedown.service";

export const platformRouter = new Hono<AppEnv>();

const PUBLIC_TENANT_SETTINGS_KEYS = new Set([
  "logoUrl",
  "bannerUrl",
  "heroBannerUrl",
  "tagline",
  "description",
  "contactEmail",
  "contactPhone",
  "physicalAddress",
  "businessHours",
  "socialLinks",
  "location",
  "theme",
  "primaryColor",
  "backgroundColor",
  "themePalette",
  "storefrontArchetype",
  "headingFont",
  "productImageRatio",
  "heroStyle",
  "heroFocalPoint",
  "cardDensity",
  "sectionVisibility",
  "headerVariant",
  "productCardStyle",
  "portfolioMode",
  "exactLocation",
]);

/**
 * Strips internal tenant settings (such as staffPermissions) so public directory
 * endpoints only expose storefront branding, contact, and location metadata.
 */
export function sanitizePublicTenantSettings(raw: unknown): Record<string, unknown> {
  let source: unknown = raw;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return {};
    }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return {};
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (PUBLIC_TENANT_SETTINGS_KEYS.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function resolveCanonicalPlatformOrigin(primaryDomainEnv?: string): string {
  const rawDomain = (primaryDomainEnv || "store254.co.ke").trim().toLowerCase();
  const safePrimary = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(rawDomain)
    ? rawDomain
    : "store254.co.ke";
  return `https://${safePrimary}`;
}

platformRouter.route("/locations", locationsRouter);
platformRouter.route("/search", searchRouter);
platformRouter.route("/marketplace", marketplaceRouter);
platformRouter.route("/single-items", singleItemsRouter);
platformRouter.route("/rides", ridesRouter);

platformRouter.get("/google-config", (c) => {
  const clientId = c.env?.GOOGLE_CLIENT_ID?.trim() || "";
  const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";
  return c.json({
    success: true,
    data: {
      enabled: Boolean(clientId),
      loginPath: `https://${primaryDomain}/auth/google/login`,
    },
  });
});

platformRouter.get("/me", async (c) => {
  const googleUser = await readPlatformGoogleUser(c);
  if (!googleUser) {
    return c.json({
      success: true,
      data: { authenticated: false, user: null },
    });
  }
  let storeSummary: Awaited<ReturnType<typeof findMerchantStoresByEmail>> = {
    stores: [],
    activeStore: null,
  };
  if (c.env?.DB) {
    try {
      storeSummary = await findMerchantStoresByEmail(
        createDb(c.env.DB),
        googleUser.email,
        { emailVerified: Boolean(googleUser.emailVerified) }
      );
    } catch {
      storeSummary = { stores: [], activeStore: null };
    }
  }
  return c.json({
    success: true,
    data: {
      authenticated: true,
      user: {
        sub: googleUser.sub,
        email: googleUser.email,
        fullName: googleUser.name,
        avatarUrl: googleUser.picture || null,
        role: "CUSTOMER",
        stores: storeSummary.stores,
        activeStore: storeSummary.activeStore,
      },
    },
  });
});

platformRouter.post("/logout", async (c) => {
  assertAllowedPlatformOrigin(c);
  if (c.env?.DB) {
    const googleUser = await readPlatformGoogleUser(c);
    if (googleUser?.email) {
      const normalizedEmail = googleUser.email.toLowerCase().trim();
      await createDb(c.env.DB)
        .update(users)
        .set({ tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() })
        .where(sql`lower(${users.email}) = ${normalizedEmail}`);
    }
  }
  const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";
  c.header("Set-Cookie", clearCustomerSessionCookie(primaryDomain), { append: true });
  return c.json({ success: true, message: "Signed out of Store254." });
});

// Register Store Input Schema
const registerStoreSchema = z
  .object({
    storeName: z.string().min(2, "Store name must be at least 2 characters").max(60),
    subdomain: z.string().min(2).max(32),
    businessType: businessTypeSchema.default("GENERAL"),
    portfolioMode: z.boolean().optional(),
    currency: z.string().length(3).default("KES"),
    ownerEmail: z.string().email("Valid email address required").optional(),
    ownerPassword: z
      .string()
      .min(SECURITY_LIMITS.MIN_PASSWORD_LENGTH, "Password must be at least 8 characters")
      .max(SECURITY_LIMITS.MAX_PASSWORD_LENGTH),
    ownerFullName: z.string().min(2).max(80),
    ownerPhone: z
      .string({ required_error: "Phone number is required." })
      .trim()
      .min(9, "Please enter a valid phone number (e.g. 0712 345 678 or +254712345678).")
      .max(24, "Phone number is too long.")
      .refine(
        (val) => {
          if (!/^\+?[0-9\s()-]+$/.test(val)) return false;
          const digits = val.replace(/\D/g, "");
          return digits.length >= 9 && digits.length <= 15;
        },
        {
          message: "Please enter a valid phone number (e.g. 0712 345 678 or +254712345678).",
        }
      ),
    countyId: z.string().min(1, "Please select your County"),
    constituencyId: z.string().optional(),
    locationId: z.string().optional(),
    googlePlaceId: z.string().optional(),
    customLocationName: z.string().trim().min(2).max(80).optional(),
    exactLat: z.number().min(-90).max(90).optional(),
    exactLng: z.number().min(-180).max(180).optional(),
    directionsNote: z.string().trim().max(240).optional(),
    acceptedTerms: z
      .boolean()
      .optional()
      .refine((v) => v !== false, {
        message: "You must accept the Store254 Terms & Conditions and Copyright Policy.",
      }),
  })
  .refine(
    (v) => Boolean(v.locationId || v.googlePlaceId || v.customLocationName),
    {
      message:
        "Please select a town or shopping centre (or enter a custom shopping centre name)",
      path: ["locationId"],
    }
  );

// Forgot Password Schemas
const forgotPasswordSchema = z.object({
  email: z.string().email(),
  clientOrigin: z.string().optional(),
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
  let activeStores: Array<Record<string, unknown>> = [];
  try {
    const rawStores = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        subdomain: tenants.subdomain,
        businessType: tenants.businessType,
        currency: tenants.currency,
        countyId: tenants.countyId,
        constituencyId: tenants.constituencyId,
        locationId: tenants.locationId,
        locationLabel: tenants.locationLabel,
        settings: tenants.settings,
        createdAt: tenants.createdAt,
        ownerName: users.fullName,
      })
      .from(tenants)
      .leftJoin(users, and(eq(users.tenantId, tenants.id), eq(users.role, "OWNER")))
      .where(and(eq(tenants.status, "ACTIVE"), ne(tenants.id, COMMUNITY_MARKET_TENANT_ID)))
      .orderBy(desc(tenants.createdAt))
      .limit(50);

    const missingLocationIds = Array.from(
      new Set(
        rawStores
          .map((s) => s.locationId)
          .filter((id): id is string => Boolean(id && !getStaticLocationById(id)))
      )
    );
    const dbLocationsMap = new Map<
      string,
      { latitude: number; longitude: number; name: string }
    >();
    if (missingLocationIds.length > 0) {
      const dbLocs = await db
        .select({
          id: kenyaLocations.id,
          name: kenyaLocations.name,
          latitude: kenyaLocations.latitude,
          longitude: kenyaLocations.longitude,
        })
        .from(kenyaLocations)
        .where(inArray(kenyaLocations.id, missingLocationIds));
      for (const loc of dbLocs) {
        dbLocationsMap.set(loc.id, loc);
      }
    }

    activeStores = rawStores.map((store) => {
      const fallbackLoc = store.locationId
        ? getStaticLocationById(store.locationId) || dbLocationsMap.get(store.locationId) || null
        : null;
      return {
        ...store,
        settings: sanitizePublicTenantSettings(store.settings),
        locationCoords: resolveStorePinCoords(store, fallbackLoc),
      };
    });
  } catch {
    activeStores = [];
  }

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
    const googleUser = await readPlatformGoogleUser(c);
    if (!googleUser || !googleUser.email) {
      throw new AppError(
        "Please sign in with Google before opening a store.",
        401,
        "GOOGLE_AUTH_REQUIRED"
      );
    }

    const verifiedOwnerEmail = googleUser.email.toLowerCase().trim();
    if (body.ownerEmail && body.ownerEmail.toLowerCase().trim() !== verifiedOwnerEmail) {
      throw new AppError(
        "Owner email must match your signed-in Google account and cannot be changed.",
        403,
        "EMAIL_MISMATCH"
      );
    }

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

    let resolvedLocation;
    try {
      resolvedLocation = await resolveOrCreateStoreLocation(db, c.env, {
        countyId: body.countyId,
        constituencyId: body.constituencyId,
        locationId: body.locationId,
        googlePlaceId: body.googlePlaceId,
        customLocationName: body.customLocationName,
      });
    } catch (err) {
      if (err instanceof LocationResolutionError) {
        throw new AppError(err.message, err.status, "INVALID_LOCATION");
      }
      throw err;
    }

    const tenantId = generateUUID();
    const userId = generateUUID();
    const hashedPassword = await hashPassword(body.ownerPassword);
    const isPortfolioMode = body.businessType === "PORTFOLIO" || body.portfolioMode === true;

    // 1. Create Tenant with status = PENDING (Admin approval required)
    await db.insert(tenants).values({
      id: tenantId,
      name: body.storeName,
      subdomain: sanitizedSub,
      businessType: body.businessType,
      currency: body.currency.toUpperCase(),
      status: "PENDING", // PENDING by default until Super Admin activates
      countyId: resolvedLocation.county.id,
      constituencyId: resolvedLocation.constituency.id,
      locationId: resolvedLocation.location.id,
      locationLabel: resolvedLocation.locationLabel,
      settings: {
        theme: "default",
        primaryColor: "#2563eb",
        contactEmail: verifiedOwnerEmail,
        contactPhone: body.ownerPhone,
        ...(isPortfolioMode
          ? {
              portfolioMode: true,
              storefrontArchetype: "service-portfolio",
              productCardStyle: "service-card",
            }
          : {}),
        location: {
          countyId: resolvedLocation.county.id,
          countyName: resolvedLocation.county.name,
          constituencyId: resolvedLocation.constituency.id,
          constituencyName: resolvedLocation.constituency.name,
          locationId: resolvedLocation.location.id,
          locationName: resolvedLocation.location.name,
          locationLabel: resolvedLocation.locationLabel,
          googlePlaceId: resolvedLocation.location.googlePlaceId || null,
        },
        ...(typeof body.exactLat === "number" && typeof body.exactLng === "number"
          ? {
              exactLocation: {
                lat: Number(body.exactLat.toFixed(6)),
                lng: Number(body.exactLng.toFixed(6)),
                label: resolvedLocation.locationLabel,
                directionsNote: body.directionsNote || "",
                pinnedAt: new Date().toISOString(),
              },
            }
          : {}),
      },
    });

    // 2. Create Owner User (email already verified via Google SSO)
    await db.insert(users).values({
      id: userId,
      tenantId: tenantId,
      email: verifiedOwnerEmail,
      passwordHash: hashedPassword,
      fullName: body.ownerFullName,
      phone: body.ownerPhone,
      googleId: googleUser.sub,
      role: "OWNER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      tokenVersion: 0,
    });

    const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";
    const storeUrl = `https://${sanitizedSub}.${primaryDomain}`;

    // 3. Send Pending Activation Notice from official email (non-blocking on provider failures)
    try {
      await EmailService.sendStorePendingActivation({
        to: verifiedOwnerEmail,
        storeName: body.storeName,
        subdomain: sanitizedSub,
        primaryDomain,
        apiKey: c.env?.RESEND_API_KEY,
        smtp: EmailService.smtpFromEnv(c.env),
      });
    } catch (emailErr) {
      console.error("[Platform] Failed sending store pending email:", emailErr);
    }

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
            businessType: body.businessType,
            portfolioMode: isPortfolioMode,
            storeUrl,
            status: "PENDING",
            currency: body.currency.toUpperCase(),
            countyId: resolvedLocation.county.id,
            constituencyId: resolvedLocation.constituency.id,
            locationId: resolvedLocation.location.id,
            locationLabel: resolvedLocation.locationLabel,
          },
          owner: {
            id: userId,
            email: verifiedOwnerEmail,
            fullName: body.ownerFullName,
            phone: body.ownerPhone,
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

    // Invalidate any existing active platform OTPs for this email
    await db
      .update(passwordResetOtps)
      .set({ isUsed: true })
      .where(
        and(
          eq(passwordResetOtps.email, normalizedEmail),
          isNull(passwordResetOtps.tenantId)
        )
      );

    // Generate 6-digit numeric OTP and URL reset token
    const otp = generateNumericOtp(6);
    const hashedOtp = await hashOtp(otp);
    const resetToken = generateUUID() + "-" + generateNumericOtp(8);
    const hashedToken = await hashOtp(resetToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes validity

    // Store URL token record (platform-scoped: tenantId = null)
    await db.insert(passwordResetOtps).values({
      id: generateUUID(),
      tenantId: null,
      email: normalizedEmail,
      otpHash: hashedToken,
      attempts: 0,
      maxAttempts: 3,
      expiresAt,
      isUsed: false,
    });

    // Store 6-digit OTP record (platform-scoped: tenantId = null)
    await db.insert(passwordResetOtps).values({
      id: generateUUID(),
      tenantId: null,
      email: normalizedEmail,
      otpHash: hashedOtp,
      attempts: 0,
      maxAttempts: 3,
      expiresAt,
      isUsed: false,
    });

    // SEC-03: Always construct reset links from canonical server-configured origin
    const origin = resolveCanonicalPlatformOrigin(c.env?.PRIMARY_DOMAIN);
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
      smtp: EmailService.smtpFromEnv(c.env),
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

    // Find active platform-scoped records (tenantId IS NULL) below attempt limit
    const activeRecords = await db
      .select()
      .from(passwordResetOtps)
      .where(
        and(
          eq(passwordResetOtps.email, normalizedEmail),
          isNull(passwordResetOtps.tenantId),
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
      const activeIds = activeRecords.map((r) => r.id);
      if (activeIds.length > 0) {
        await db
          .update(passwordResetOtps)
          .set({
            attempts: sql`${passwordResetOtps.attempts} + 1`,
            isUsed: sql`CASE WHEN ${passwordResetOtps.attempts} + 1 >= ${passwordResetOtps.maxAttempts} THEN 1 ELSE ${passwordResetOtps.isUsed} END`,
          })
          .where(
            and(
              inArray(passwordResetOtps.id, activeIds),
              eq(passwordResetOtps.isUsed, false),
              lt(passwordResetOtps.attempts, passwordResetOtps.maxAttempts)
            )
          );
      }
      throw new AppError("Incorrect or expired recovery code.", 400, "INVALID_TOKEN");
    }

    const [consumed] = await db
      .update(passwordResetOtps)
      .set({ isUsed: true })
      .where(
        and(
          eq(passwordResetOtps.id, matchedRecord.id),
          eq(passwordResetOtps.isUsed, false),
          lt(passwordResetOtps.attempts, passwordResetOtps.maxAttempts)
        )
      )
      .returning({ id: passwordResetOtps.id });

    if (!consumed) {
      throw new AppError("Invalid or expired password reset link.", 400, "INVALID_TOKEN");
    }

    // Invalidate all remaining platform-scoped tokens for this email
    await db
      .update(passwordResetOtps)
      .set({ isUsed: true })
      .where(
        and(
          eq(passwordResetOtps.email, normalizedEmail),
          isNull(passwordResetOtps.tenantId)
        )
      );

    // SEC-04: Scope password update strictly to OWNER accounts and rotate tokenVersion
    const newPasswordHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(users.email, normalizedEmail), eq(users.role, "OWNER")));

    return c.json({
      success: true,
      message: "Password reset successfully. You may now log in with your new password.",
    });
  }
);

const copyrightReportSchema = z.object({
  reporterName: z.string().trim().min(2, "Your full name is required").max(120),
  reporterEmail: z.string().trim().email("Valid email address is required").max(160),
  reportedImageUrl: z.string().trim().min(3, "Image URL is required").max(1000),
  targetType: z.enum(["ITEM_IMAGE", "STORE_LOGO", "STORE_BANNER", "OTHER"]).optional(),
  pageUrl: z.string().trim().max(1000).optional(),
  storeSubdomain: z.string().trim().max(64).optional(),
  itemId: z.string().trim().max(100).optional(),
  itemTitle: z.string().trim().max(200).optional(),
  originalWorkUrl: z.string().trim().max(1000).optional(),
  reason: z.string().trim().min(10, "Please describe the copyright claim (at least 10 characters)").max(2000),
  goodFaithConfirmed: z.literal(true, {
    errorMap: () => ({ message: "You must confirm good-faith ownership or authorization." }),
  }),
});

// Public Copyright & Image Infringement Reporting Endpoint
platformRouter.post(
  "/copyright-reports",
  rateLimiter({ max: 10, windowMs: 10 * 60 * 1000 }),
  zValidator("json", copyrightReportSchema),
  async (c) => {
    if (!c.env?.DB) {
      throw new AppError("Database binding not initialized.", 500, "DB_NOT_INITIALIZED");
    }
    const body = c.req.valid("json");
    const db = createDb(c.env.DB);

    const mediaRef = extractMediaReference(body.reportedImageUrl);
    let resolvedTenantId: string | null = null;
    let resolvedSubdomain = body.storeSubdomain ? sanitizeSubdomain(body.storeSubdomain) || body.storeSubdomain.toLowerCase() : null;
    let resolvedItemId: string | null = null;
    let resolvedItemTitle = body.itemTitle || null;

    if (mediaRef.tenantIdFromUrl) {
      const [tenantByMedia] = await db
        .select({ id: tenants.id, subdomain: tenants.subdomain })
        .from(tenants)
        .where(eq(tenants.id, mediaRef.tenantIdFromUrl))
        .limit(1);
      if (tenantByMedia) {
        resolvedTenantId = tenantByMedia.id;
        resolvedSubdomain = resolvedSubdomain || tenantByMedia.subdomain;
      }
    }

    if (!resolvedTenantId && resolvedSubdomain) {
      const [tenantBySub] = await db
        .select({ id: tenants.id, subdomain: tenants.subdomain })
        .from(tenants)
        .where(eq(tenants.subdomain, resolvedSubdomain))
        .limit(1);
      if (tenantBySub) {
        resolvedTenantId = tenantBySub.id;
        resolvedSubdomain = tenantBySub.subdomain;
      }
    }

    if (body.itemId) {
      const [matchedItem] = await db
        .select({ id: items.id, tenantId: items.tenantId, title: items.title })
        .from(items)
        .where(eq(items.id, body.itemId))
        .limit(1);
      if (matchedItem) {
        resolvedItemId = matchedItem.id;
        resolvedItemTitle = resolvedItemTitle || matchedItem.title;
        if (!resolvedTenantId) {
          resolvedTenantId = matchedItem.tenantId;
        }
      }
    }

    const reportId = generateUUID();
    await db.insert(copyrightReports).values({
      id: reportId,
      tenantId: resolvedTenantId,
      storeSubdomain: resolvedSubdomain,
      itemId: resolvedItemId,
      itemTitle: resolvedItemTitle,
      reportedImageUrl: body.reportedImageUrl,
      targetType: body.targetType || "ITEM_IMAGE",
      pageUrl: body.pageUrl || null,
      reporterName: body.reporterName,
      reporterEmail: body.reporterEmail.toLowerCase(),
      originalWorkUrl: body.originalWorkUrl || null,
      reason: body.reason,
      goodFaithConfirmed: true,
      status: "OPEN",
    });

    return c.json(
      {
        success: true,
        message: "Copyright report received. Store254 compliance will review it in Super Admin and take down infringing media promptly.",
        data: { reportId },
      },
      201
    );
  }
);
