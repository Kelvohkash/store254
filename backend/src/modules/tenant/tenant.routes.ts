import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, sql } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { tenants } from "../../db/schema/tenants";
import { items } from "../../db/schema/items";
import { orders } from "../../db/schema/orders";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware";
import { AppError } from "../../security/error-handler";
import { generateUUID } from "../../security/crypto";

export const tenantSettingsRouter = new Hono<AppEnv>();

const optionalUrlOrMediaPath = z
  .string()
  .max(500)
  .refine(
    (val) =>
      val === "" ||
      val.startsWith("/api/media/") ||
      val.startsWith("data:image/") ||
      /^https?:\/\/.+/i.test(val),
    "Must be a valid image URL or uploaded media path"
  )
  .optional();

// Update Store Profile & Branding Schema
const updateStoreProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  currency: z.string().length(3).optional(),
  businessType: z
    .enum(["RETAIL", "ELECTRONICS", "FURNITURE", "SERVICES", "GENERAL"])
    .optional(),
  settings: z
    .object({
      logoUrl: optionalUrlOrMediaPath,
      bannerUrl: optionalUrlOrMediaPath,
      tagline: z.string().max(160).optional(),
      description: z.string().max(1000).optional(),
      contactEmail: z.union([z.string().email(), z.literal("")]).optional(),
      contactPhone: z.string().max(20).optional(),
      physicalAddress: z.string().max(255).optional(),
      businessHours: z.record(z.string()).optional(),
      socialLinks: z
        .object({
          instagram: z.string().max(200).optional(),
          facebook: z.string().max(200).optional(),
          tiktok: z.string().max(200).optional(),
          whatsapp: z.string().max(50).optional(),
          twitter: z.string().max(200).optional(),
        })
        .optional(),
      primaryColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).optional(),
      backgroundColor: z.union([z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/), z.literal("")]).optional(),
      themePalette: z.string().optional(),
      storefrontArchetype: z
        .enum(["modern-retailer", "lifestyle-boutique", "single-product-maker", "service-portfolio"])
        .optional(),
      storefrontTemplate: z
        .string()
        .regex(/^[a-z0-9][a-z0-9-]{0,63}$/i)
        .optional(),
      storefrontTemplateVersion: z.number().int().positive().max(1000).optional(),
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
      productCardStyle: z.enum(["grid-card", "horizontal-list-row", "service-card"]).optional(),
    })
    .optional(),
});

// Custom Domain Mapping Schema
const customDomainSchema = z.object({
  customDomain: z
    .string()
    .min(4)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9-.]+\.[a-z]{2,}$/i, "Invalid domain format (e.g. yourstore.com)"),
});

// Update Store Profile & Branding (Store Owner & Admins only)
tenantSettingsRouter.patch(
  "/",
  authMiddleware(true),
  requireRole(["OWNER", "ADMIN"]),
  zValidator("json", updateStoreProfileSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const body = c.req.valid("json");

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const mergedSettings = {
      ...(tenant.settings as Record<string, unknown>),
      ...(body.settings || {}),
    };

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

// Map Custom Apex/Subdomain Domain (e.g. alicebabycare.com)
tenantSettingsRouter.put(
  "/custom-domain",
  authMiddleware(true),
  requireRole(["OWNER", "ADMIN"]),
  zValidator("json", customDomainSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const { customDomain } = c.req.valid("json");
    const normalizedDomain = customDomain.toLowerCase().trim();

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    // Check if domain is claimed by another store
    const [existing] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.customDomain, normalizedDomain))
      .limit(1);

    if (existing && existing.id !== tenant.id) {
      throw new AppError("This custom domain is already registered to another store.", 409, "DOMAIN_TAKEN");
    }

    await db
      .update(tenants)
      .set({
        customDomain: normalizedDomain,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenant.id));

    const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";

    return c.json({
      success: true,
      message: `Custom domain mapped. Please configure your DNS settings.`,
      data: {
        customDomain: normalizedDomain,
        dnsInstructions: {
          recordType: "CNAME",
          host: normalizedDomain,
          pointsTo: `${tenant.subdomain}.${primaryDomain}`,
          ttl: "Auto / 3600",
        },
      },
    });
  }
);

// Accurate SQL-aggregated Store Statistics for Merchant Dashboard
tenantSettingsRouter.get(
  "/stats",
  authMiddleware(true),
  requireRole(["OWNER", "ADMIN"]),
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

// Upload Store/Product Image to Cloudflare R2 (or Data URI fallback in local dev)
tenantSettingsRouter.post(
  "/media",
  authMiddleware(true),
  requireRole(["OWNER", "ADMIN"]),
  async (c) => {
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
      "image/gif": "gif",
    };

    const ext = allowedTypes[file.type];
    if (!ext) {
      throw new AppError(
        "Unsupported image format. Please upload JPEG, PNG, WEBP, or GIF.",
        400,
        "UNSUPPORTED_MEDIA_TYPE"
      );
    }

    const maxBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxBytes) {
      throw new AppError("Image exceeds the 5 MB maximum size.", 400, "FILE_TOO_LARGE");
    }

    const buffer = await file.arrayBuffer();
    const key = `${tenant.id}/${generateUUID()}.${ext}`;

    if (c.env?.MEDIA_BUCKET) {
      await c.env.MEDIA_BUCKET.put(key, buffer, {
        httpMetadata: {
          contentType: file.type,
          cacheControl: "public, max-age=31536000, immutable",
        },
      });
      return c.json({
        success: true,
        data: {
          url: `/api/media/${key}`,
          key,
        },
      });
    }

    // Local development fallback when R2 bucket is not bound
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return c.json({
      success: true,
      data: {
        url: `data:${file.type};base64,${base64}`,
        key,
      },
    });
  }
);

