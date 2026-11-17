import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, sql } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { tenants } from "../../db/schema/tenants";
import { items } from "../../db/schema/items";
import { orders } from "../../db/schema/orders";
import { authMiddleware, requireRole, requirePermission } from "../../middlewares/auth.middleware";
import { AppError } from "../../security/error-handler";
import { generateSecureToken, generateUUID } from "../../security/crypto";
import { businessTypeSchema } from "../../config/business-types";
import { detectImageMimeFromBytes } from "../../lib/media-validation";
import { rateLimiter } from "../../security/rate-limiter";
import { DEFAULT_PRIMARY_DOMAIN } from "../../config/constants";

export const tenantSettingsRouter = new Hono<AppEnv>();

export const MEDIA_SEGMENT_REGEX = /^[a-zA-Z0-9._-]+$/;
export const MEDIA_PATH_REGEX = /^\/api\/media\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

/**
 * Validates a single media path segment (tenantId or fileName) against strict safe characters
 * and rejects path traversal, slashes, query strings, and fragments.
 */
export function isSafeMediaSegment(segment: string): boolean {
  if (typeof segment !== "string") return false;
  if (segment.length === 0 || segment.length > 255) return false;
  if (segment === "." || segment.includes("..") || /[/\\?#]/.test(segment)) {
    return false;
  }
  return MEDIA_SEGMENT_REGEX.test(segment);
}

export function isTenantMediaPath(path: string, tenantId: string): boolean {
  if (typeof path !== "string" || !isSafeMediaSegment(tenantId)) return false;
  if (path.includes("..") || /[\\?#]/.test(path)) return false;
  const prefix = `/api/media/${tenantId}/`;
  if (!path.startsWith(prefix)) return false;
  const fileName = path.slice(prefix.length);
  return isSafeMediaSegment(fileName);
}

export function validateTenantMediaUrl(
  url: string | null | undefined,
  currentUrl: string | null | undefined,
  tenantId: string
): boolean {
  if (url === undefined || url === null || url === "") return true;
  if (currentUrl && url === currentUrl) return true;
  return isTenantMediaPath(url, tenantId);
}

const RESERVED_CUSTOM_DOMAIN_TLDS = new Set([
  "local",
  "internal",
  "localhost",
  "localdomain",
  "arpa",
  "invalid",
  "test",
  "example",
  "home",
  "lan",
  "corp",
  "intranet",
]);

const RESERVED_CUSTOM_DOMAIN_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "api.internal",
  "metadata.google.internal",
  "example.com",
  "example.org",
  "example.net",
]);

const RESERVED_CUSTOM_DOMAIN_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".localdomain",
  ".arpa",
  ".invalid",
  ".test",
  ".example",
  ".workers.dev",
  ".pages.dev",
];

/**
 * Validates that a custom domain is a public, non-reserved DNS hostname and cannot
 * hijack platform subdomains, local/internal addresses, or IP literals.
 */
export function isAllowedCustomDomain(
  rawDomain: string,
  primaryDomain = DEFAULT_PRIMARY_DOMAIN
): boolean {
  const domain = String(rawDomain || "").trim().toLowerCase();
  if (!domain || domain.length < 4 || domain.length > 100) return false;
  if (domain.includes(":") || domain.includes("/") || domain.includes("..")) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain)) return false;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    return false;
  }

  const normalizedPrimary = primaryDomain.trim().toLowerCase() || DEFAULT_PRIMARY_DOMAIN;
  if (domain === normalizedPrimary || domain.endsWith(`.${normalizedPrimary}`)) {
    return false;
  }
  if (RESERVED_CUSTOM_DOMAIN_HOSTNAMES.has(domain)) {
    return false;
  }
  if (RESERVED_CUSTOM_DOMAIN_SUFFIXES.some((suffix) => domain.endsWith(suffix))) {
    return false;
  }
  const labels = domain.split(".");
  const tld = labels[labels.length - 1];
  if (RESERVED_CUSTOM_DOMAIN_TLDS.has(tld)) {
    return false;
  }
  return true;
}

function isSafeSocialFieldValue(value: string, isWhatsapp = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("//")) return false;
  // Reject any URL with a non-http(s) scheme (e.g. javascript:, data:, vbscript:, file:)
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.hostname);
    } catch {
      return false;
    }
  }
  if (isWhatsapp) {
    return /^\+?[0-9\s()-]{6,30}$/.test(trimmed);
  }
  return /^@?[a-zA-Z0-9._-]{1,100}$/.test(trimmed);
}

const socialHandleOrUrlSchema = z
  .string()
  .max(200)
  .refine((v) => isSafeSocialFieldValue(v, false), {
    message: "Social links must use an http/https URL or a valid handle.",
  })
  .optional();

const whatsappFieldSchema = z
  .string()
  .max(50)
  .refine((v) => isSafeSocialFieldValue(v, true), {
    message: "WhatsApp contact must be a phone number or http/https URL.",
  })
  .optional();

const optionalMediaPath = z
  .union([
    z.string().max(2_000_000),
    z.literal(""),
    z.null(),
  ])
  .optional();

// Update Store Profile & Branding Schema
export const updateStoreProfileSchema = z.object({
  // A store's chosen subdomain is fixed at registration and cannot be changed through owner settings.
  subdomain: z.never().optional(),
  name: z.string().min(2).max(100).optional(),
  currency: z.string().length(3).optional(),
  businessType: businessTypeSchema.optional(),
  settings: z
    .object({
      logoUrl: optionalMediaPath,
      bannerUrl: optionalMediaPath,
      tagline: z.string().max(160).optional(),
      description: z.string().max(1000).optional(),
      contactEmail: z.union([z.string().email(), z.literal("")]).optional(),
      contactPhone: z.string().max(20).optional(),
      physicalAddress: z.string().max(255).optional(),
      businessHours: z.record(z.string()).optional(),
      socialLinks: z
        .object({
          instagram: socialHandleOrUrlSchema,
          facebook: socialHandleOrUrlSchema,
          tiktok: socialHandleOrUrlSchema,
          whatsapp: whatsappFieldSchema,
          twitter: socialHandleOrUrlSchema,
        })
        .optional(),
      primaryColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).optional(),
      backgroundColor: z.union([z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/), z.literal("")]).optional(),
      themePalette: z.string().optional(),
      storefrontArchetype: z
        .enum(["modern-retailer", "lifestyle-boutique", "single-product-maker", "service-portfolio"])
        .optional(),
      headingFont: z.enum(["modern", "editorial", "rounded"]).optional(),
      productImageRatio: z.enum(["square", "portrait", "landscape"]).optional(),
      heroStyle: z.enum(["split", "editorial", "minimal"]).optional(),
      heroFocalPoint: z.enum(["center", "left", "right", "top"]).optional(),
      cardDensity: z.enum(["compact", "comfortable", "spacious"]).optional(),
      sectionVisibility: z.object({
        collectionIntro: z.boolean().optional(),
        socialLinks: z.boolean().optional(),
        contactActions: z.boolean().optional(),
      }).optional(),
      headerVariant: z.enum(["compact-search-first", "centered-brand", "minimal-nav"]).optional(),
      productCardStyle: z.enum(["grid-card", "service-card"]).optional(),
    })
    .optional(),
});

// Custom Domain Mapping Schema
export const customDomainSchema = z.object({
  customDomain: z
    .string()
    .trim()
    .min(4)
    .max(100)
    .transform((v) => v.toLowerCase())
    .refine(
      (v) => isAllowedCustomDomain(v),
      "Invalid or reserved domain. Use a valid public domain you own (e.g. yourstore.com)."
    ),
});

interface DomainVerificationState {
  domain: string;
  token: string;
  verified: boolean;
  requestedAt: string;
  verifiedAt?: string;
}

const DNS_TXT_PREFIX = "_store254-verify";

async function verifyDomainTxtRecord(
  domain: string,
  expectedToken: string
): Promise<{ verified: boolean; lookupFailed: boolean }> {
  const txtHost = `${DNS_TXT_PREFIX}.${domain}`;
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(txtHost)}&type=TXT`;
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/dns-json" },
    });
    if (!resp.ok) {
      return { verified: false, lookupFailed: true };
    }
    const data = (await resp.json()) as {
      Status?: number;
      Answer?: Array<{ type?: number; data?: string }>;
    };
    const answers = Array.isArray(data?.Answer) ? data.Answer : [];
    const matched = answers.some((record) => {
      if (record.type !== 16 || typeof record.data !== "string") return false;
      const cleaned = record.data.replace(/^"+|"+$/g, "").replace(/"\s+"/g, "").trim();
      return cleaned === expectedToken;
    });
    return { verified: matched, lookupFailed: false };
  } catch {
    return { verified: false, lookupFailed: true };
  }
}

// Update Store Profile & Branding (Store Owner, Admins, or Staff with manage_settings)
tenantSettingsRouter.patch(
  "/",
  authMiddleware(true),
  requirePermission("manage_settings"),
  zValidator("json", updateStoreProfileSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const body = c.req.valid("json");

    const currentSettings = ((tenant.settings as Record<string, unknown>) || {});
    const currentLogoUrl = typeof currentSettings.logoUrl === "string" ? currentSettings.logoUrl : "";
    const currentBannerUrl = typeof currentSettings.bannerUrl === "string" ? currentSettings.bannerUrl : "";

    if (body.settings) {
      if (
        body.settings.logoUrl !== undefined &&
        !validateTenantMediaUrl(body.settings.logoUrl, currentLogoUrl, tenant.id)
      ) {
        throw new AppError(
          `Invalid logoUrl: ${body.settings.logoUrl}. New logo must be an uploaded media path in the format /api/media/${tenant.id}/<file>`,
          400,
          "INVALID_MEDIA_PATH"
        );
      }

      if (
        body.settings.bannerUrl !== undefined &&
        !validateTenantMediaUrl(body.settings.bannerUrl, currentBannerUrl, tenant.id)
      ) {
        throw new AppError(
          `Invalid bannerUrl: ${body.settings.bannerUrl}. New banner must be an uploaded media path in the format /api/media/${tenant.id}/<file>`,
          400,
          "INVALID_MEDIA_PATH"
        );
      }
    }

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [latestTenant] = await db
      .select({ settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, tenant.id))
      .limit(1);
    const latestSettings = ((latestTenant?.settings as Record<string, unknown>) || currentSettings);

    const mergedSettings: Record<string, unknown> = {
      ...currentSettings,
      ...(body.settings || {}),
    };
    if (latestSettings.staffPermissions && typeof latestSettings.staffPermissions === "object") {
      mergedSettings.staffPermissions = latestSettings.staffPermissions;
    }
    if (
      latestSettings.customDomainVerification &&
      typeof latestSettings.customDomainVerification === "object"
    ) {
      mergedSettings.customDomainVerification = latestSettings.customDomainVerification;
    }
    delete mergedSettings.storefrontTemplate;
    delete mergedSettings.storefrontTemplateVersion;
    delete mergedSettings.themePalette;

    await db
      .update(tenants)
      .set({
        name: body.name || tenant.name,
        currency: body.currency?.toUpperCase() || tenant.currency,
        businessType: body.businessType || tenant.businessType,
        settings: mergedSettings,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenant.id));

    const [updated] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenant.id))
      .limit(1);

    return c.json({
      success: true,
      message: "Store profile and branding updated successfully.",
      data: updated,
    });
  }
);

// Map Custom Apex/Subdomain Domain (e.g. alicebabycare.com) with DNS TXT ownership verification
async function handleCustomDomainBindOrVerify(
  c: Context<AppEnv>,
  requestedDomain: string
) {
  const tenant = c.get("tenant")!;
  const primaryDomain = (c.env?.PRIMARY_DOMAIN || DEFAULT_PRIMARY_DOMAIN).toLowerCase();
  const normalizedDomain = requestedDomain.toLowerCase().trim();

  if (!isAllowedCustomDomain(normalizedDomain, primaryDomain)) {
    throw new AppError(
      "This domain cannot be mapped. Provide a valid public domain you own.",
      400,
      "INVALID_CUSTOM_DOMAIN"
    );
  }

  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);

  // Check if domain is claimed by another store
  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.customDomain, normalizedDomain))
    .limit(1);

  if (existing && existing.id !== tenant.id) {
    throw new AppError(
      "This custom domain is already registered to another store.",
      409,
      "DOMAIN_TAKEN"
    );
  }

  const [freshTenant] = await db
    .select({ customDomain: tenants.customDomain, settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenant.id))
    .limit(1);

  const currentSettings =
    freshTenant?.settings &&
    typeof freshTenant.settings === "object" &&
    !Array.isArray(freshTenant.settings)
      ? { ...(freshTenant.settings as Record<string, unknown>) }
      : { ...((tenant.settings as Record<string, unknown>) || {}) };

  const existingVerification =
    currentSettings.customDomainVerification &&
    typeof currentSettings.customDomainVerification === "object"
      ? (currentSettings.customDomainVerification as Partial<DomainVerificationState>)
      : null;

  const isAlreadyVerifiedForSameDomain =
    freshTenant?.customDomain === normalizedDomain &&
    existingVerification?.domain === normalizedDomain &&
    existingVerification?.verified === true;

  if (isAlreadyVerifiedForSameDomain) {
    return c.json({
      success: true,
      message: "Custom domain is verified and active.",
      data: {
        customDomain: normalizedDomain,
        verified: true,
        dnsInstructions: {
          recordType: "CNAME",
          host: normalizedDomain,
          pointsTo: `${tenant.subdomain}.${primaryDomain}`,
          ttl: "Auto / 3600",
        },
      },
    });
  }

  const token =
    existingVerification?.domain === normalizedDomain &&
    typeof existingVerification.token === "string" &&
    existingVerification.token.startsWith("store254-verify=")
      ? existingVerification.token
      : `store254-verify=${generateSecureToken(16)}`;

  const nowIso = new Date().toISOString();
  const txtCheck = await verifyDomainTxtRecord(normalizedDomain, token);

  if (txtCheck.verified) {
    const nextSettings = {
      ...currentSettings,
      customDomainVerification: {
        domain: normalizedDomain,
        token,
        verified: true,
        requestedAt: existingVerification?.requestedAt || nowIso,
        verifiedAt: nowIso,
      },
    };

    await db
      .update(tenants)
      .set({
        customDomain: normalizedDomain,
        settings: nextSettings,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenant.id));

    return c.json({
      success: true,
      message: "Custom domain verified and mapped successfully.",
      data: {
        customDomain: normalizedDomain,
        verified: true,
        dnsInstructions: {
          recordType: "CNAME",
          host: normalizedDomain,
          pointsTo: `${tenant.subdomain}.${primaryDomain}`,
          ttl: "Auto / 3600",
        },
      },
    });
  }

  // Persist pending verification challenge without binding customDomain yet.
  const nextSettings = {
    ...currentSettings,
    customDomainVerification: {
      domain: normalizedDomain,
      token,
      verified: false,
      requestedAt: existingVerification?.requestedAt || nowIso,
    },
  };

  await db
    .update(tenants)
    .set({
      settings: nextSettings,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenant.id));

  const txtHost = `${DNS_TXT_PREFIX}.${normalizedDomain}`;
  return c.json(
    {
      success: true,
      message: txtCheck.lookupFailed
        ? "Domain ownership verification is required. DNS lookup could not be completed yet; add the TXT record below and try again."
        : "Domain ownership verification is required. Add the DNS TXT record below and re-submit to activate your custom domain.",
      data: {
        customDomain: null,
        pendingDomain: normalizedDomain,
        verified: false,
        txtVerification: {
          recordType: "TXT",
          host: txtHost,
          value: token,
        },
        dnsInstructions: {
          recordType: "TXT",
          host: txtHost,
          pointsTo: token,
          ttl: "Auto / 3600",
        },
      },
    },
    202
  );
}

tenantSettingsRouter.put(
  "/custom-domain",
  authMiddleware(true),
  requirePermission("manage_settings"),
  zValidator("json", customDomainSchema),
  async (c) => {
    const { customDomain } = c.req.valid("json");
    return handleCustomDomainBindOrVerify(c, customDomain);
  }
);

tenantSettingsRouter.post(
  "/custom-domain/verify",
  authMiddleware(true),
  requirePermission("manage_settings"),
  zValidator("json", customDomainSchema),
  async (c) => {
    const { customDomain } = c.req.valid("json");
    return handleCustomDomainBindOrVerify(c, customDomain);
  }
);

// Accurate SQL-aggregated Store Statistics for Merchant Dashboard
tenantSettingsRouter.get(
  "/stats",
  authMiddleware(true),
  requireRole(["OWNER", "ADMIN", "STAFF"]),
  async (c) => {
    const tenant = c.get("tenant")!;
    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [productStats] = await db
      .select({
        totalProducts: sql<number>`count(*)`,
      })
      .from(items)
      .where(eq(items.tenantId, tenant.id));

    const [orderStats] = await db
      .select({
        totalOrders: sql<number>`count(*)`,
        pendingOrders: sql<number>`sum(case when ${orders.status} in ('PENDING_PAYMENT', 'PROCESSING') then 1 else 0 end)`,
        completedRevenue: sql<number>`sum(case when ${orders.status} = 'COMPLETED' or ${orders.paymentStatus} = 'PAID' then ${orders.totalAmount} else 0 end)`,
      })
      .from(orders)
      .where(eq(orders.tenantId, tenant.id));

    return c.json({
      success: true,
      data: {
        totalProducts: Number(productStats?.totalProducts || 0),
        totalOrders: Number(orderStats?.totalOrders || 0),
        pendingOrders: Number(orderStats?.pendingOrders || 0),
        totalRevenue: Number(orderStats?.completedRevenue || 0),
      },
    });
  }
);

const mediaUploadBodyLimit = bodyLimit({
  maxSize: 6 * 1024 * 1024, // 6 MB (5 MB image + multipart overhead)
  onError: (c) =>
    c.json(
      {
        success: false,
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "Media upload exceeds the 6 MB maximum payload size.",
        },
      },
      413
    ),
});

// Upload Store/Product Image to Cloudflare R2
tenantSettingsRouter.post(
  "/media",
  rateLimiter({ max: 20, windowMs: 60 * 1000, binding: "SENSITIVE_RATE_LIMITER" }),
  mediaUploadBodyLimit,
  authMiddleware(true),
  requirePermission("manage_products", "manage_settings"),
  async (c) => {
    if (!c.env?.MEDIA_BUCKET) {
      return c.json(
        {
          success: false,
          error: {
            code: "STORAGE_UNAVAILABLE",
            message: "Media storage is not configured or unavailable.",
          },
        },
        503
      );
    }

    const tenant = c.get("tenant")!;
    const formData = await c.req.formData().catch(() => null);
    if (!formData) {
      throw new AppError("Invalid multipart form data.", 400, "INVALID_FORM_DATA");
    }

    const rawFile = formData.get("file") as unknown;
    if (
      !rawFile ||
      typeof rawFile !== "object" ||
      typeof (rawFile as Blob).arrayBuffer !== "function"
    ) {
      throw new AppError("No image file uploaded.", 400, "FILE_REQUIRED");
    }
    const file = rawFile as Blob;

    const allowedTypes: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    const maxBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size <= 0) {
      throw new AppError("Uploaded image file is empty.", 400, "EMPTY_FILE");
    }
    if (file.size > maxBytes) {
      throw new AppError("Image exceeds the 5 MB maximum size.", 400, "FILE_TOO_LARGE");
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const detectedMime = detectImageMimeFromBytes(bytes);

    if (!detectedMime || !allowedTypes[detectedMime]) {
      throw new AppError(
        "Unsupported image format. Please upload a valid JPEG, PNG, or WEBP image.",
        400,
        "UNSUPPORTED_MEDIA_TYPE"
      );
    }

    const ext = allowedTypes[detectedMime];
    const key = `${tenant.id}/${generateUUID()}.${ext}`;

    await c.env.MEDIA_BUCKET.put(key, buffer, {
      httpMetadata: {
        contentType: detectedMime,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
    return c.json({
      success: true,
      data: {
        url: `/api/media/${key}`,
        key,
        contentType: detectedMime,
        size: file.size,
      },
    });
  }
);

