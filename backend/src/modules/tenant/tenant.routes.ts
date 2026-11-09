import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { tenants } from "../../db/schema/tenants";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware";
import { AppError } from "../../security/error-handler";

export const tenantSettingsRouter = new Hono<AppEnv>();

// Update Store Profile & Branding Schema
const updateStoreProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  currency: z.string().length(3).optional(),
  businessType: z
    .enum(["RETAIL", "ELECTRONICS", "FURNITURE", "SERVICES", "GENERAL"])
    .optional(),
  settings: z
    .object({
      logoUrl: z.string().url().optional(),
      bannerUrl: z.string().url().optional(),
      tagline: z.string().max(160).optional(),
      description: z.string().max(1000).optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().max(20).optional(),
      physicalAddress: z.string().max(255).optional(),
      businessHours: z.record(z.string()).optional(),
      socialLinks: z
        .object({
          instagram: z.string().optional(),
          facebook: z.string().optional(),
          tiktok: z.string().optional(),
          whatsapp: z.string().optional(),
          twitter: z.string().optional(),
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
