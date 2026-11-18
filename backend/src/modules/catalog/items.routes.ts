import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, ne, sql, gte, lte, inArray } from "drizzle-orm";
import type { AppEnv, UserContext } from "../../types/context";
import { createDb } from "../../db";
import { items, itemVariants, type ItemVariant } from "../../db/schema/items";
import { categories } from "../../db/schema/categories";
import { attributeDefinitions } from "../../db/schema/attributes";
import { authMiddleware, hasPermission, requirePermission } from "../../middlewares/auth.middleware";
import { generateUUID } from "../../security/crypto";
import { slugify } from "../../security/sanitize";
import { AppError } from "../../security/error-handler";
import { categoryPath, itemPath, notifyIndexNow } from "../../services/indexnow.service";

export const itemsRouter = new Hono<AppEnv>();

const variantInputSchema = z.object({
  title: z.string().min(1).max(100),
  price: z.number().int().positive(),
  compareAtPrice: z.number().int().positive().optional(),
  stockQuantity: z.number().int().min(0).default(0),
  options: z.record(z.string()).default({}),
});

const MEDIA_SEGMENT_REGEX = /^[a-zA-Z0-9._-]+$/;
export const MEDIA_PATH_REGEX = /^\/api\/media\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)$/;

const DISALLOWED_FILTER_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isSafeMediaSegment(segment: string): boolean {
  if (!segment || !MEDIA_SEGMENT_REGEX.test(segment)) return false;
  if (
    segment === "." ||
    segment === ".." ||
    segment.includes("..") ||
    segment.includes("?") ||
    segment.includes("#") ||
    segment.includes("/") ||
    segment.includes("\\")
  ) {
    return false;
  }
  return true;
}

export function isTenantMediaPath(path: string, tenantId: string): boolean {
  if (typeof path !== "string" || typeof tenantId !== "string" || !isSafeMediaSegment(tenantId)) {
    return false;
  }
  if (path.includes("..") || path.includes("?") || path.includes("#") || path.includes("\\")) {
    return false;
  }
  const match = MEDIA_PATH_REGEX.exec(path);
  if (!match) return false;
  const [, pathTenantId, fileName] = match;
  return pathTenantId === tenantId && isSafeMediaSegment(fileName);
}

const mediaPathSchema = z
  .string()
  .max(2_000_000)
  .refine(
    (val) => {
      const match = MEDIA_PATH_REGEX.exec(val);
      return Boolean(match && isSafeMediaSegment(match[1]) && isSafeMediaSegment(match[2]));
    },
    "Images must be uploaded media paths in the format /api/media/<tenantId>/<file>"
  );

function parseClampedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function isTenantMerchantUser(user: UserContext | undefined, tenantId: string): boolean {
  return Boolean(
    user &&
      user.tenantId === tenantId &&
      (user.role === "OWNER" || user.role === "ADMIN" || user.role === "STAFF")
  );
}

function isValidHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("//")) return false;
  try {
    const parsed = new URL(trimmed);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Strips internal merchant metadata so public storefront endpoints only expose
 * safe display, portfolio, single-listing, and booking configuration keys.
 * Internal fields such as `sellerEmail` are never exposed.
 */
export function sanitizePublicItemMetadata(raw: unknown): Record<string, unknown> {
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
  const obj = source as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  if (typeof obj.artworkIcon === "string" && obj.artworkIcon.trim()) {
    sanitized.artworkIcon = obj.artworkIcon.trim();
  }
  if (
    obj.serviceConfig &&
    typeof obj.serviceConfig === "object" &&
    !Array.isArray(obj.serviceConfig)
  ) {
    const rawSvc = obj.serviceConfig as Record<string, unknown>;
    const serviceConfig: Record<string, unknown> = {};
    if (typeof rawSvc.available === "boolean") {
      serviceConfig.available = rawSvc.available;
    }
    if (typeof rawSvc.deliveryMode === "string" && rawSvc.deliveryMode.trim()) {
      serviceConfig.deliveryMode = rawSvc.deliveryMode.trim();
    }
    if (typeof rawSvc.duration === "string" && rawSvc.duration.trim()) {
      serviceConfig.duration = rawSvc.duration.trim();
    }
    if (Object.keys(serviceConfig).length > 0) {
      sanitized.serviceConfig = serviceConfig;
    }
  }
  if (typeof obj.isPortfolioProject === "boolean") {
    sanitized.isPortfolioProject = obj.isPortfolioProject;
  }
  if (typeof obj.projectUrl === "string" && isValidHttpUrl(obj.projectUrl)) {
    sanitized.projectUrl = obj.projectUrl.trim();
  }
  if (typeof obj.clientName === "string" && obj.clientName.trim()) {
    sanitized.clientName = obj.clientName.trim();
  }
  if (typeof obj.completedYear === "string" && obj.completedYear.trim()) {
    sanitized.completedYear = obj.completedYear.trim();
  }
  if (typeof obj.isSingleListing === "boolean") {
    sanitized.isSingleListing = obj.isSingleListing;
  }
  if (typeof obj.sellerName === "string" && obj.sellerName.trim()) {
    sanitized.sellerName = obj.sellerName.trim();
  }
  if (typeof obj.sellerPhone === "string" && obj.sellerPhone.trim()) {
    sanitized.sellerPhone = obj.sellerPhone.trim();
  }
  if (typeof obj.sellerWhatsapp === "string" && obj.sellerWhatsapp.trim()) {
    sanitized.sellerWhatsapp = obj.sellerWhatsapp.trim();
  }
  if (typeof obj.condition === "string" && obj.condition.trim()) {
    sanitized.condition = obj.condition.trim();
  }
  if (typeof obj.locationLabel === "string" && obj.locationLabel.trim()) {
    sanitized.locationLabel = obj.locationLabel.trim();
  }
  return sanitized;
}

export const createItemSchema = z.object({
  categoryId: z.string().min(1).nullable().optional(),
  title: z.string().min(2).max(200),
  slug: z.string().optional(),
  description: z.string().optional(),
  itemType: z.enum(["PHYSICAL", "SERVICE", "DIGITAL"]).default("PHYSICAL"),
  basePrice: z.number().int().min(0),
  compareAtPrice: z.number().int().positive().optional(),
  costPrice: z.number().int().positive().optional(),
  barcode: z.string().optional(),
  trackInventory: z.boolean().default(true),
  stockQuantity: z.number().int().min(0).default(0),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("PUBLISHED"),
  images: z.array(mediaPathSchema).max(5, "A product can have at most 5 photos.").default([]),
  attributes: z.record(z.unknown()).default({}), // Dynamic attributes { brand: "Samsung", size: "55" }
  metadata: z.record(z.unknown()).default({}),
  variants: z.array(variantInputSchema).default([]),
});

// Dynamic Items Query (Filtering, Search & Facets)
itemsRouter.get("/", authMiddleware(false), async (c) => {
  const tenant = c.get("tenant")!;
  const user = c.get("user");
  const query = c.req.query();
  const db = createDb(c.env.DB);

  const page = parseClampedInt(query.page, 1, 1, 100_000);
  const limit = parseClampedInt(query.limit, 50, 1, 200);
  const offset = (page - 1) * limit;

  const isMerchant =
    user &&
    hasPermission(user, "manage_products") &&
    user.tenantId === tenant.id &&
    query.includeAll === "true";

  // Reserved query parameter keys
  const reservedParams = new Set(["page", "limit", "category", "search", "minPrice", "maxPrice", "itemType", "sort", "includeAll"]);

  // Extract dynamic attribute filters from query string (e.g. ?brand=Samsung&screen_size=55)
  const dynamicFilters = new Map<string, string>();
  for (const [key, val] of Object.entries(query)) {
    if (!reservedParams.has(key) && val) {
      dynamicFilters.set(key, val);
    }
  }

  // Retrieve items for this tenant (all statuses for merchant admin, PUBLISHED for storefront)
  let itemsQuery = db
    .select({
      id: items.id,
      categoryId: items.categoryId,
      title: items.title,
      slug: items.slug,
      description: items.description,
      itemType: items.itemType,
      basePrice: items.basePrice,
      compareAtPrice: items.compareAtPrice,
      sku: items.sku,
      trackInventory: items.trackInventory,
      stockQuantity: items.stockQuantity,
      images: items.images,
      attributes: items.attributes,
      metadata: items.metadata,
      status: items.status,
      createdAt: items.createdAt,
    })
    .from(items)
    .where(
      isMerchant
        ? eq(items.tenantId, tenant.id)
        : and(eq(items.tenantId, tenant.id), eq(items.status, "PUBLISHED"))
    )
    .orderBy(desc(items.createdAt))
    .limit(limit)
    .offset(offset);

  const rawList = await itemsQuery;

  // Attach variants for returned items
  const itemIds = rawList.map((i) => i.id);
  const allVariants =
    itemIds.length > 0
      ? await db
          .select()
          .from(itemVariants)
          .where(and(eq(itemVariants.tenantId, tenant.id), inArray(itemVariants.itemId, itemIds)))
      : [];
  const variantsByItem = new Map<string, typeof allVariants>();
  for (const v of allVariants) {
    const arr = variantsByItem.get(v.itemId) || [];
    arr.push(v);
    variantsByItem.set(v.itemId, arr);
  }

  // In-memory filter for dynamic JSON attributes and client search
  const canViewInternalMetadata = isTenantMerchantUser(user, tenant.id);
  let filtered = rawList.map((i) => ({
    ...i,
    metadata: canViewInternalMetadata ? i.metadata : sanitizePublicItemMetadata(i.metadata),
    variants: variantsByItem.get(i.id) || [],
  }));

  // Filter by category if requested
  if (query.category) {
    // Check if category is slug or UUID
    const [matchedCategory] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.tenantId, tenant.id), eq(categories.slug, query.category)))
      .limit(1);

    const targetCategoryId = matchedCategory ? matchedCategory.id : query.category;
    filtered = filtered.filter((i) => i.categoryId === targetCategoryId);
  }

  // Filter by Price range
  if (query.minPrice) {
    const min = parseInt(query.minPrice, 10);
    if (Number.isFinite(min)) filtered = filtered.filter((i) => i.basePrice >= min);
  }
  if (query.maxPrice) {
    const max = parseInt(query.maxPrice, 10);
    if (Number.isFinite(max)) filtered = filtered.filter((i) => i.basePrice <= max);
  }

  // Filter by item type (e.g. PHYSICAL or SERVICE)
  if (query.itemType) {
    filtered = filtered.filter((i) => i.itemType === query.itemType);
  }

  // Search by keyword in title/description
  if (query.search) {
    const keyword = query.search.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.title.toLowerCase().includes(keyword) ||
        (i.description && i.description.toLowerCase().includes(keyword))
    );
  }

  // Filter by dynamic attributes (e.g. brand, size, color, duration)
  if (dynamicFilters.size > 0) {
    filtered = filtered.filter((item) => {
      const rawAttrs = item.attributes;
      if (!rawAttrs || typeof rawAttrs !== "object" || Array.isArray(rawAttrs)) {
        return false;
      }
      const itemAttrs = rawAttrs as Record<string, unknown>;
      for (const [filterKey, filterValue] of dynamicFilters.entries()) {
        if (DISALLOWED_FILTER_KEYS.has(filterKey) || !Object.hasOwn(itemAttrs, filterKey)) {
          return false;
        }
        const itemVal = itemAttrs[filterKey];
        if (itemVal === undefined || itemVal === null) return false;

        // Comma-separated multi-value match: ?brand=Samsung,Sony
        const expectedValues = filterValue.split(",").map((v) => v.trim().toLowerCase());
        const actualVal = String(itemVal).trim().toLowerCase();

        if (!expectedValues.includes(actualVal)) {
          return false;
        }
      }
      return true;
    });
  }

  if (!isMerchant) {
    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  }

  return c.json({
    success: true,
    data: filtered,
    pagination: {
      page,
      limit,
      count: filtered.length,
    },
  });
});

// Get Single Item with Variants
itemsRouter.get("/:slug", authMiddleware(false), async (c) => {
  const tenant = c.get("tenant")!;
  const user = c.get("user");
  const slug = c.req.param("slug");
  const db = createDb(c.env.DB);
  const isMerchant = isTenantMerchantUser(user, tenant.id);

  const [item] = await db
    .select()
    .from(items)
    .where(
      isMerchant
        ? and(eq(items.tenantId, tenant.id), eq(items.slug, slug))
        : and(eq(items.tenantId, tenant.id), eq(items.slug, slug), eq(items.status, "PUBLISHED"))
    )
    .limit(1);

  if (!item || (!isMerchant && item.status !== "PUBLISHED")) {
    throw new AppError("Item not found.", 404, "ITEM_NOT_FOUND");
  }

  // Fetch variants if any
  const variants = await db
    .select()
    .from(itemVariants)
    .where(and(eq(itemVariants.tenantId, tenant.id), eq(itemVariants.itemId, item.id)));

  if (!isMerchant) {
    const { costPrice: _costPrice, barcode: _barcode, ...publicItem } = item;
    return c.json({
      success: true,
      data: {
        ...publicItem,
        metadata: sanitizePublicItemMetadata(item.metadata),
        variants,
      },
    });
  }

  return c.json({
    success: true,
    data: {
      ...item,
      variants,
    },
  });
});

// Create Item (Physical Product or Bookable Service)
itemsRouter.post(
  "/",
  authMiddleware(true),
  requirePermission("manage_products"),
  zValidator("json", createItemSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const body = c.req.valid("json");
    const db = createDb(c.env.DB);

    if (body.images && body.images.length > 0) {
      for (const img of body.images) {
        if (!isTenantMediaPath(img, tenant.id)) {
          throw new AppError(
            `Invalid image path: ${img}. Images must be uploaded media paths in the format /api/media/${tenant.id}/<file>`,
            400,
            "INVALID_IMAGE_PATH"
          );
        }
      }
    }

    let createdCategorySlug: string | null = null;
    if (body.categoryId) {
      const [category] = await db
        .select({ id: categories.id, slug: categories.slug })
        .from(categories)
        .where(and(eq(categories.id, body.categoryId), eq(categories.tenantId, tenant.id)))
        .limit(1);

      if (!category) {
        throw new AppError("Specified category does not exist in this store.", 404, "CATEGORY_NOT_FOUND");
      }
      createdCategorySlug = category.slug;
    }

    const slug = body.slug ? slugify(body.slug) : slugify(body.title);

    // Check slug uniqueness
    const [existing] = await db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.tenantId, tenant.id), eq(items.slug, slug)))
      .limit(1);

    if (existing) {
      throw new AppError(`An item with slug "${slug}" already exists.`, 409, "SLUG_EXISTS");
    }

    const itemId = generateUUID();
    const sku = `SKU-${itemId.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const isServiceItem = body.itemType === "SERVICE";
    const resolvedTrackInventory = isServiceItem ? false : body.trackInventory;
    const resolvedStockQuantity = isServiceItem ? 0 : body.stockQuantity;

    await db.insert(items).values({
      id: itemId,
      tenantId: tenant.id,
      categoryId: body.categoryId || null,
      title: body.title,
      slug,
      description: body.description || null,
      itemType: body.itemType,
      basePrice: body.basePrice,
      compareAtPrice: body.compareAtPrice || null,
      costPrice: body.costPrice || null,
      sku,
      barcode: body.barcode || null,
      trackInventory: resolvedTrackInventory,
      stockQuantity: resolvedStockQuantity,
      status: body.status,
      images: body.images,
      attributes: body.attributes,
      metadata: body.metadata,
    });

    // Insert variants if provided
    const createdVariants: ItemVariant[] = [];
    for (const [index, v] of body.variants.entries()) {
      const variantId = generateUUID();
      const variantSku = `${sku}-${String(index + 1).padStart(2, "0")}`;
      const variantStock = isServiceItem ? 0 : v.stockQuantity;
      await db.insert(itemVariants).values({
        id: variantId,
        tenantId: tenant.id,
        itemId: itemId,
        title: v.title,
        sku: variantSku,
        price: v.price,
        compareAtPrice: v.compareAtPrice || null,
        stockQuantity: variantStock,
        options: v.options,
      });

      createdVariants.push({
        id: variantId,
        tenantId: tenant.id,
        itemId,
        title: v.title,
        sku: variantSku,
        price: v.price,
        compareAtPrice: v.compareAtPrice || null,
        stockQuantity: variantStock,
        options: v.options,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const [createdItem] = await db
      .select()
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);

    notifyIndexNow(c, tenant, [itemPath(slug), createdCategorySlug ? categoryPath(createdCategorySlug) : null]);
    return c.json(
      {
        success: true,
        message: `${body.itemType === "SERVICE" ? "Service" : "Product"} created successfully.`,
        data: {
          ...createdItem,
          variants: createdVariants,
        },
      },
      201
    );
  }
);

// Update Item (Store Owners & Admins only)
const updateItemImageSchema = z.string().max(2_000_000);
const updateItemSchema = createItemSchema.partial().extend({
  images: z.array(updateItemImageSchema).max(5, "A product can have at most 5 photos.").optional(),
});

itemsRouter.put(
  "/:id",
  authMiddleware(true),
  requirePermission("manage_products"),
  zValidator("json", updateItemSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const { id } = c.req.param();
    const body = c.req.valid("json");
    const db = createDb(c.env.DB);

    // Verify item belongs to this tenant
    const [existing] = await db
      .select({ id: items.id, images: items.images, sku: items.sku, itemType: items.itemType, slug: items.slug })
      .from(items)
      .where(and(eq(items.id, id), eq(items.tenantId, tenant.id)))
      .limit(1);

    if (!existing) {
      throw new AppError("Item not found.", 404, "NOT_FOUND");
    }

    if (body.images !== undefined) {
      const existingImages = new Set(
        Array.isArray(existing.images) ? (existing.images as string[]) : []
      );
      for (const img of body.images) {
        if (!existingImages.has(img) && !isTenantMediaPath(img, tenant.id)) {
          throw new AppError(
            `Invalid image path: ${img}. New images must be uploaded media paths in the format /api/media/${tenant.id}/<file>`,
            400,
            "INVALID_IMAGE_PATH"
          );
        }
      }
    }

    let createdCategorySlug: string | null = null;
    if (body.categoryId) {
      const [category] = await db
        .select({ id: categories.id, slug: categories.slug })
        .from(categories)
        .where(and(eq(categories.id, body.categoryId), eq(categories.tenantId, tenant.id)))
        .limit(1);

      if (!category) {
        throw new AppError("Specified category does not exist in this store.", 404, "CATEGORY_NOT_FOUND");
      }
      createdCategorySlug = category.slug;
    }

    const effectiveItemType = body.itemType ?? existing.itemType;
    const isServiceItem = effectiveItemType === "SERVICE";
    const sku = existing.sku || `SKU-${existing.id.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (!existing.sku) updateData.sku = sku;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.slug !== undefined) {
      const nextSlug = slugify(body.slug);
      if (!nextSlug) {
        throw new AppError("Slug cannot be empty.", 400, "INVALID_SLUG");
      }
      const [slugConflict] = await db
        .select({ id: items.id })
        .from(items)
        .where(
          and(
            eq(items.tenantId, tenant.id),
            eq(items.slug, nextSlug),
            ne(items.id, id)
          )
        )
        .limit(1);

      if (slugConflict) {
        throw new AppError(
          `An item with slug "${nextSlug}" already exists.`,
          409,
          "SLUG_TAKEN"
        );
      }
      updateData.slug = nextSlug;
    }
    if (body.description !== undefined) updateData.description = body.description;
    if (body.itemType !== undefined) updateData.itemType = body.itemType;
    if (body.basePrice !== undefined) updateData.basePrice = body.basePrice;
    if (body.compareAtPrice !== undefined) updateData.compareAtPrice = body.compareAtPrice;
    if (body.costPrice !== undefined) updateData.costPrice = body.costPrice;
    if (body.barcode !== undefined) updateData.barcode = body.barcode;
    if (isServiceItem) {
      updateData.trackInventory = false;
      updateData.stockQuantity = 0;
    } else {
      if (body.trackInventory !== undefined) updateData.trackInventory = body.trackInventory;
      if (body.stockQuantity !== undefined) updateData.stockQuantity = body.stockQuantity;
    }
    if (body.status !== undefined) updateData.status = body.status;
    if (body.images !== undefined) updateData.images = body.images;
    if (body.attributes !== undefined) updateData.attributes = body.attributes;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId || null;

    await db.update(items).set(updateData).where(and(eq(items.id, id), eq(items.tenantId, tenant.id)));

    if (body.variants !== undefined) {
      await db
        .delete(itemVariants)
        .where(and(eq(itemVariants.itemId, id), eq(itemVariants.tenantId, tenant.id)));
      for (const [index, v] of body.variants.entries()) {
        await db.insert(itemVariants).values({
          id: generateUUID(),
          tenantId: tenant.id,
          itemId: id,
          title: v.title,
          sku: `${sku}-${String(index + 1).padStart(2, "0")}`,
          price: v.price,
          compareAtPrice: v.compareAtPrice || null,
          stockQuantity: isServiceItem ? 0 : v.stockQuantity,
          options: v.options,
        });
      }
    }

    const [updated] = await db.select().from(items).where(eq(items.id, id)).limit(1);
    const updatedVariants = await db
      .select()
      .from(itemVariants)
      .where(and(eq(itemVariants.itemId, id), eq(itemVariants.tenantId, tenant.id)));

    notifyIndexNow(c, tenant, [
      itemPath(existing.slug),
      updated?.slug && updated.slug !== existing.slug ? itemPath(updated.slug) : null,
      createdCategorySlug ? categoryPath(createdCategorySlug) : null,
    ]);

    return c.json({
      success: true,
      message: "Product updated successfully.",
      data: {
        ...updated,
        variants: updatedVariants,
      },
    });
  }
);

// Delete Item (Store Owners & Admins only)
itemsRouter.delete(
  "/:id",
  authMiddleware(true),
  requirePermission("manage_products"),
  async (c) => {
    const tenant = c.get("tenant")!;
    const { id } = c.req.param();
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: items.id, title: items.title, slug: items.slug })
      .from(items)
      .where(and(eq(items.id, id), eq(items.tenantId, tenant.id)))
      .limit(1);

    if (!existing) {
      throw new AppError("Item not found.", 404, "NOT_FOUND");
    }

    // Delete variants first (FK constraint)
    await db.delete(itemVariants).where(eq(itemVariants.itemId, id));
    await db.delete(items).where(and(eq(items.id, id), eq(items.tenantId, tenant.id)));

    notifyIndexNow(c, tenant, [itemPath(existing.slug)]);

    return c.json({ success: true, message: "Product deleted successfully." });
  }
);
