import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, sql, gte, lte, inArray } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { items, itemVariants, type ItemVariant } from "../../db/schema/items";
import { categories } from "../../db/schema/categories";
import { attributeDefinitions } from "../../db/schema/attributes";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware";
import { generateUUID } from "../../security/crypto";
import { slugify } from "../../security/sanitize";
import { AppError } from "../../security/error-handler";

export const itemsRouter = new Hono<AppEnv>();

const variantInputSchema = z.object({
  title: z.string().min(1).max(100),
  sku: z.string().optional(),
  price: z.number().int().positive(),
  compareAtPrice: z.number().int().positive().optional(),
  stockQuantity: z.number().int().min(0).default(0),
  options: z.record(z.string()).default({}),
});

export const MEDIA_PATH_REGEX = /^\/api\/media\/[^/\s]+\/[^/\s]+$/;

const mediaPathSchema = z
  .string()
  .max(2_000_000)
  .refine(
    (val) => MEDIA_PATH_REGEX.test(val),
    "Images must be uploaded media paths in the format /api/media/<tenantId>/<file>"
  );

export const createItemSchema = z.object({
  categoryId: z.string().min(1).nullable().optional(),
  title: z.string().min(2).max(200),
  slug: z.string().optional(),
  description: z.string().optional(),
  itemType: z.enum(["PHYSICAL", "SERVICE", "DIGITAL"]).default("PHYSICAL"),
  basePrice: z.number().int().positive(),
  compareAtPrice: z.number().int().positive().optional(),
  costPrice: z.number().int().positive().optional(),
  sku: z.string().optional(),
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

  const page = Math.max(1, parseInt(query.page || "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(query.limit || "50", 10)));
  const offset = (page - 1) * limit;

  const isMerchant =
    user &&
    ["OWNER", "ADMIN"].includes(user.role) &&
    user.tenantId === tenant.id &&
    query.includeAll === "true";

  // Reserved query parameter keys
  const reservedParams = new Set(["page", "limit", "category", "search", "minPrice", "maxPrice", "itemType", "sort", "includeAll"]);

  // Extract dynamic attribute filters from query string (e.g. ?brand=Samsung&screen_size=55)
  const dynamicFilters: Record<string, string> = {};
  for (const [key, val] of Object.entries(query)) {
    if (!reservedParams.has(key) && val) {
      dynamicFilters[key] = val;
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
  let filtered = rawList.map((i) => ({
    ...i,
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
    if (!isNaN(min)) filtered = filtered.filter((i) => i.basePrice >= min);
  }
  if (query.maxPrice) {
    const max = parseInt(query.maxPrice, 10);
    if (!isNaN(max)) filtered = filtered.filter((i) => i.basePrice <= max);
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
  if (Object.keys(dynamicFilters).length > 0) {
    filtered = filtered.filter((item) => {
      const itemAttrs = (item.attributes as Record<string, unknown>) || {};
      for (const [filterKey, filterValue] of Object.entries(dynamicFilters)) {
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
itemsRouter.get("/:slug", async (c) => {
  const tenant = c.get("tenant")!;
  const slug = c.req.param("slug");
  const db = createDb(c.env.DB);

  const [item] = await db
    .select()
    .from(items)
    .where(and(eq(items.tenantId, tenant.id), eq(items.slug, slug)))
    .limit(1);

  if (!item) {
    throw new AppError("Item not found.", 404, "ITEM_NOT_FOUND");
  }

  // Fetch variants if any
  const variants = await db
    .select()
    .from(itemVariants)
    .where(and(eq(itemVariants.tenantId, tenant.id), eq(itemVariants.itemId, item.id)));

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
  requireRole(["OWNER", "ADMIN"]),
  zValidator("json", createItemSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const body = c.req.valid("json");
    const db = createDb(c.env.DB);

    if (body.categoryId) {
      const [category] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, body.categoryId), eq(categories.tenantId, tenant.id)))
        .limit(1);

      if (!category) {
        throw new AppError("Specified category does not exist in this store.", 404, "CATEGORY_NOT_FOUND");
      }
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
      sku: body.sku || null,
      barcode: body.barcode || null,
      trackInventory: body.trackInventory,
      stockQuantity: body.stockQuantity,
      status: body.status,
      images: body.images,
      attributes: body.attributes,
      metadata: body.metadata,
    });

    // Insert variants if provided
    const createdVariants: ItemVariant[] = [];
    for (const v of body.variants) {
      const variantId = generateUUID();
      await db.insert(itemVariants).values({
        id: variantId,
        tenantId: tenant.id,
        itemId: itemId,
        title: v.title,
        sku: v.sku || null,
        price: v.price,
        compareAtPrice: v.compareAtPrice || null,
        stockQuantity: v.stockQuantity,
        options: v.options,
      });

      createdVariants.push({
        id: variantId,
        tenantId: tenant.id,
        itemId,
        title: v.title,
        sku: v.sku || null,
        price: v.price,
        compareAtPrice: v.compareAtPrice || null,
        stockQuantity: v.stockQuantity,
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
  requireRole(["OWNER", "ADMIN"]),
  zValidator("json", updateItemSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const { id } = c.req.param();
    const body = c.req.valid("json");
    const db = createDb(c.env.DB);

    // Verify item belongs to this tenant
    const [existing] = await db
      .select({ id: items.id, images: items.images })
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
        if (!existingImages.has(img) && !MEDIA_PATH_REGEX.test(img)) {
          throw new AppError(
            `Invalid image path: ${img}. New images must be uploaded media paths in the format /api/media/<tenantId>/<file>`,
            400,
            "INVALID_IMAGE_PATH"
          );
        }
      }
    }

    if (body.categoryId) {
      const [category] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, body.categoryId), eq(categories.tenantId, tenant.id)))
        .limit(1);

      if (!category) {
        throw new AppError("Specified category does not exist in this store.", 404, "CATEGORY_NOT_FOUND");
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updateData.title = body.title;
    if (body.slug !== undefined) updateData.slug = slugify(body.slug);
    if (body.description !== undefined) updateData.description = body.description;
    if (body.itemType !== undefined) updateData.itemType = body.itemType;
    if (body.basePrice !== undefined) updateData.basePrice = body.basePrice;
    if (body.compareAtPrice !== undefined) updateData.compareAtPrice = body.compareAtPrice;
    if (body.costPrice !== undefined) updateData.costPrice = body.costPrice;
    if (body.sku !== undefined) updateData.sku = body.sku;
    if (body.barcode !== undefined) updateData.barcode = body.barcode;
    if (body.trackInventory !== undefined) updateData.trackInventory = body.trackInventory;
    if (body.stockQuantity !== undefined) updateData.stockQuantity = body.stockQuantity;
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
      for (const v of body.variants) {
        await db.insert(itemVariants).values({
          id: generateUUID(),
          tenantId: tenant.id,
          itemId: id,
          title: v.title,
          sku: v.sku || null,
          price: v.price,
          compareAtPrice: v.compareAtPrice || null,
          stockQuantity: v.stockQuantity,
          options: v.options,
        });
      }
    }

    const [updated] = await db.select().from(items).where(eq(items.id, id)).limit(1);
    const updatedVariants = await db
      .select()
      .from(itemVariants)
      .where(and(eq(itemVariants.itemId, id), eq(itemVariants.tenantId, tenant.id)));

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
  requireRole(["OWNER", "ADMIN"]),
  async (c) => {
    const tenant = c.get("tenant")!;
    const { id } = c.req.param();
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: items.id, title: items.title })
      .from(items)
      .where(and(eq(items.id, id), eq(items.tenantId, tenant.id)))
      .limit(1);

    if (!existing) {
      throw new AppError("Item not found.", 404, "NOT_FOUND");
    }

    // Delete variants first (FK constraint)
    await db.delete(itemVariants).where(eq(itemVariants.itemId, id));
    await db.delete(items).where(and(eq(items.id, id), eq(items.tenantId, tenant.id)));

    return c.json({ success: true, message: "Product deleted successfully." });
  }
);
