import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, sql } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { tenants } from "../../db/schema/tenants";
import { items, itemVariants } from "../../db/schema/items";
import { AppError } from "../../security/error-handler";
import { generateUUID } from "../../security/crypto";
import { slugify } from "../../security/sanitize";
import { rateLimiter } from "../../security/rate-limiter";
import { detectImageMimeFromBytes } from "../../lib/media-validation";
import { isTenantMediaPath, sanitizePublicItemMetadata } from "../catalog/items.routes";
import {
  assertAllowedPlatformOrigin,
  readPlatformGoogleUser,
} from "./marketplace.routes";
import { getStaticLocationById } from "./kenya-static-data";
import {
  formatLocationLabel,
  LocationResolutionError,
  resolveOrCreateStoreLocation,
} from "./locations.service";

export const COMMUNITY_MARKET_TENANT_ID = "tenant-community-market";
export const COMMUNITY_MARKET_SUBDOMAIN = "market";

export const singleItemsRouter = new Hono<AppEnv>();

/**
 * Ensures the shared community marketplace tenant exists so individuals can publish
 * direct single-item listings without registering a dedicated store.
 */
export async function ensureCommunityMarketTenant(
  db: ReturnType<typeof createDb>
): Promise<void> {
  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, COMMUNITY_MARKET_TENANT_ID))
    .limit(1);

  if (existing) {
    return;
  }

  await db
    .insert(tenants)
    .values({
      id: COMMUNITY_MARKET_TENANT_ID,
      name: "Store254 Direct Sellers",
      subdomain: COMMUNITY_MARKET_SUBDOMAIN,
      businessType: "GENERAL",
      currency: "KES",
      status: "ACTIVE",
      settings: {
        tagline: "Direct individual seller listings across Kenya",
      },
    })
    .onConflictDoNothing();
}

function emptyToUndefined(val: unknown): unknown {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "string" && val.trim() === "") return undefined;
  return val;
}

function parseMetadataRecord(raw: unknown): Record<string, unknown> {
  let source = raw;
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
  return source as Record<string, unknown>;
}

const singleItemMediaPathSchema = z
  .string()
  .max(2_000_000)
  .refine(
    (val) => isTenantMediaPath(val, COMMUNITY_MARKET_TENANT_ID),
    `Images must be uploaded media paths in the format /api/media/${COMMUNITY_MARKET_TENANT_ID}/<file>`
  );

const createSingleItemSchema = z
  .object({
    title: z.string().trim().min(2, "Title must be at least 2 characters").max(200),
    basePrice: z.number().int().min(1, "Price must be at least KES 1"),
    description: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(5000).optional()
    ),
    itemType: z.enum(["PHYSICAL", "SERVICE"]).default("PHYSICAL"),
    condition: z.enum(["NEW", "USED"]).default("NEW"),
    sellerName: z.string().trim().min(2, "Seller name is required").max(100),
    sellerPhone: z.string().trim().min(6, "Seller phone is required").max(30),
    sellerWhatsapp: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(6).max(30).optional()
    ),
    countyId: z.string().trim().min(1, "County is required").max(64),
    locationId: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(64).optional()
    ),
    customLocationName: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(2).max(80).optional()
    ),
    images: z
      .array(singleItemMediaPathSchema)
      .max(5, "A listing can have at most 5 photos.")
      .default([]),
  })
  .refine((v) => Boolean(v.locationId || v.customLocationName), {
    message: "Please select a town or shopping centre (or enter a custom location name).",
    path: ["locationId"],
  });

const updateSingleItemSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  basePrice: z.number().int().min(1, "Price must be at least KES 1").optional(),
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
});

const mediaUploadBodyLimit = bodyLimit({
  maxSize: 6 * 1024 * 1024,
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

// Upload image for a single-item quick listing
singleItemsRouter.post(
  "/media",
  rateLimiter({ max: 20, windowMs: 60 * 1000, binding: "SENSITIVE_RATE_LIMITER" }),
  mediaUploadBodyLimit,
  async (c) => {
    assertAllowedPlatformOrigin(c);
    const googleUser = await readPlatformGoogleUser(c);
    if (!googleUser || !googleUser.email) {
      throw new AppError(
        "Please sign in with Google to upload listing photos.",
        401,
        "GOOGLE_AUTH_REQUIRED"
      );
    }

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

    const maxBytes = 5 * 1024 * 1024;
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
    const key = `${COMMUNITY_MARKET_TENANT_ID}/${generateUUID()}.${ext}`;

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

// Create a single-item direct listing without registering a store
singleItemsRouter.post(
  "/",
  rateLimiter({ max: 20, windowMs: 60 * 1000, binding: "SENSITIVE_RATE_LIMITER" }),
  async (c, next) => {
    assertAllowedPlatformOrigin(c);
    await next();
  },
  zValidator("json", createSingleItemSchema),
  async (c) => {
    const googleUser = await readPlatformGoogleUser(c);
    if (!googleUser || !googleUser.email) {
      throw new AppError(
        "Please sign in with Google to post an item.",
        401,
        "GOOGLE_AUTH_REQUIRED"
      );
    }

    if (!c.env?.DB) {
      throw new AppError("Database binding not initialized.", 500, "DB_NOT_INITIALIZED");
    }

    const body = c.req.valid("json");
    const db = createDb(c.env.DB);

    let resolvedCountyId = body.countyId;
    let resolvedLocationId: string;
    let resolvedLocationLabel: string;
    let resolvedLat: number;
    let resolvedLng: number;

    const staticLoc = body.locationId ? getStaticLocationById(body.locationId) : undefined;
    if (staticLoc) {
      if (staticLoc.countyId !== body.countyId) {
        throw new AppError(
          "Selected town or shopping centre does not belong to the chosen county",
          400,
          "INVALID_LOCATION"
        );
      }
      resolvedCountyId = staticLoc.countyId;
      resolvedLocationId = staticLoc.id;
      resolvedLocationLabel = formatLocationLabel(
        staticLoc.name,
        staticLoc.constituencyName,
        staticLoc.countyName
      );
      resolvedLat = staticLoc.latitude;
      resolvedLng = staticLoc.longitude;
    } else {
      try {
        const resolved = await resolveOrCreateStoreLocation(db, c.env, {
          countyId: body.countyId,
          locationId: body.locationId,
          customLocationName: body.customLocationName,
        });
        resolvedCountyId = resolved.county.id;
        resolvedLocationId = resolved.location.id;
        resolvedLocationLabel = resolved.locationLabel;
        resolvedLat = resolved.location.latitude;
        resolvedLng = resolved.location.longitude;
      } catch (err) {
        if (err instanceof LocationResolutionError) {
          throw new AppError(err.message, err.status, "INVALID_LOCATION");
        }
        throw err;
      }
    }

    await ensureCommunityMarketTenant(db);

    const itemId = generateUUID();
    const slugBase = slugify(body.title) || "item";
    const slug = `${slugBase}-${itemId.slice(0, 8)}`;
    const sku = `SINGLE-${itemId.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const sellerEmail = googleUser.email.toLowerCase().trim();
    const sellerWhatsapp = body.sellerWhatsapp?.trim() || body.sellerPhone;

    const metadataPayload: Record<string, unknown> = {
      isSingleListing: true,
      sellerEmail,
      sellerName: body.sellerName,
      sellerPhone: body.sellerPhone,
      sellerWhatsapp,
      condition: body.condition,
      countyId: resolvedCountyId,
      locationId: resolvedLocationId,
      locationLabel: resolvedLocationLabel,
      latitude: resolvedLat,
      longitude: resolvedLng,
    };

    await db.insert(items).values({
      id: itemId,
      tenantId: COMMUNITY_MARKET_TENANT_ID,
      categoryId: null,
      title: body.title,
      slug,
      description: body.description || null,
      itemType: body.itemType,
      basePrice: body.basePrice,
      sku,
      trackInventory: true,
      stockQuantity: 1,
      status: "PUBLISHED",
      images: body.images,
      attributes: { condition: body.condition },
      metadata: metadataPayload,
    });

    const [created] = await db
      .select()
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);

    return c.json(
      {
        success: true,
        message: "Listing published to the Store254 marketplace.",
        data: {
          ...created,
          metadata: sanitizePublicItemMetadata(created?.metadata ?? metadataPayload),
        },
      },
      201
    );
  }
);

// List the authenticated seller's direct single-item listings
singleItemsRouter.get("/mine", async (c) => {
  const googleUser = await readPlatformGoogleUser(c);
  if (!googleUser || !googleUser.email) {
    throw new AppError(
      "Please sign in with Google to view your listings.",
      401,
      "GOOGLE_AUTH_REQUIRED"
    );
  }

  if (!c.env?.DB) {
    throw new AppError("Database binding not initialized.", 500, "DB_NOT_INITIALIZED");
  }

  const db = createDb(c.env.DB);
  const sellerEmail = googleUser.email.toLowerCase().trim();

  const rows = await db
    .select({
      id: items.id,
      tenantId: items.tenantId,
      title: items.title,
      slug: items.slug,
      description: items.description,
      itemType: items.itemType,
      basePrice: items.basePrice,
      status: items.status,
      images: items.images,
      attributes: items.attributes,
      metadata: items.metadata,
      createdAt: items.createdAt,
      updatedAt: items.updatedAt,
    })
    .from(items)
    .where(
      and(
        eq(items.tenantId, COMMUNITY_MARKET_TENANT_ID),
        sql`lower(json_extract(${items.metadata}, '$.sellerEmail')) = ${sellerEmail}`
      )
    )
    .orderBy(desc(items.createdAt))
    .limit(100);

  return c.json({
    success: true,
    data: rows.map((row) => ({
      ...row,
      metadata: sanitizePublicItemMetadata(row.metadata),
    })),
  });
});

// Update status/price/details of a single-item listing owned by the authenticated seller
singleItemsRouter.patch(
  "/:id",
  async (c, next) => {
    assertAllowedPlatformOrigin(c);
    await next();
  },
  zValidator("json", updateSingleItemSchema),
  async (c) => {
    const googleUser = await readPlatformGoogleUser(c);
    if (!googleUser || !googleUser.email) {
      throw new AppError(
        "Please sign in with Google to update your listing.",
        401,
        "GOOGLE_AUTH_REQUIRED"
      );
    }

    if (!c.env?.DB) {
      throw new AppError("Database binding not initialized.", 500, "DB_NOT_INITIALIZED");
    }

    const itemId = c.req.param("id");
    const body = c.req.valid("json");
    const db = createDb(c.env.DB);
    const callerEmail = googleUser.email.toLowerCase().trim();

    const [existing] = await db
      .select()
      .from(items)
      .where(
        and(eq(items.id, itemId), eq(items.tenantId, COMMUNITY_MARKET_TENANT_ID))
      )
      .limit(1);

    if (!existing) {
      throw new AppError("Listing not found.", 404, "NOT_FOUND");
    }

    const meta = parseMetadataRecord(existing.metadata);
    const ownerEmail =
      typeof meta.sellerEmail === "string" ? meta.sellerEmail.toLowerCase().trim() : "";

    if (!ownerEmail || ownerEmail !== callerEmail) {
      throw new AppError(
        "You do not have permission to update this listing.",
        403,
        "FORBIDDEN"
      );
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status !== undefined) updateData.status = body.status;
    if (body.basePrice !== undefined) updateData.basePrice = body.basePrice;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;

    await db
      .update(items)
      .set(updateData)
      .where(and(eq(items.id, itemId), eq(items.tenantId, COMMUNITY_MARKET_TENANT_ID)));

    const [updated] = await db
      .select()
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);

    return c.json({
      success: true,
      message: "Listing updated successfully.",
      data: {
        ...updated,
        metadata: sanitizePublicItemMetadata(updated?.metadata),
      },
    });
  }
);

// Delete a single-item listing owned by the authenticated seller
singleItemsRouter.delete("/:id", async (c) => {
  assertAllowedPlatformOrigin(c);
  const googleUser = await readPlatformGoogleUser(c);
  if (!googleUser || !googleUser.email) {
    throw new AppError(
      "Please sign in with Google to delete your listing.",
      401,
      "GOOGLE_AUTH_REQUIRED"
    );
  }

  if (!c.env?.DB) {
    throw new AppError("Database binding not initialized.", 500, "DB_NOT_INITIALIZED");
  }

  const itemId = c.req.param("id");
  const db = createDb(c.env.DB);
  const callerEmail = googleUser.email.toLowerCase().trim();

  const [existing] = await db
    .select()
    .from(items)
    .where(
      and(eq(items.id, itemId), eq(items.tenantId, COMMUNITY_MARKET_TENANT_ID))
    )
    .limit(1);

  if (!existing) {
    throw new AppError("Listing not found.", 404, "NOT_FOUND");
  }

  const meta = parseMetadataRecord(existing.metadata);
  const ownerEmail =
    typeof meta.sellerEmail === "string" ? meta.sellerEmail.toLowerCase().trim() : "";

  if (!ownerEmail || ownerEmail !== callerEmail) {
    throw new AppError(
      "You do not have permission to delete this listing.",
      403,
      "FORBIDDEN"
    );
  }

  await db.delete(itemVariants).where(eq(itemVariants.itemId, itemId));
  await db
    .delete(items)
    .where(and(eq(items.id, itemId), eq(items.tenantId, COMMUNITY_MARKET_TENANT_ID)));

  return c.json({
    success: true,
    message: "Listing deleted successfully.",
  });
});
