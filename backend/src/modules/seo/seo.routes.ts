import { Hono } from "hono";
import { and, asc, desc, eq, inArray, notLike, sql } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { tenants } from "../../db/schema/tenants";
import { categories } from "../../db/schema/categories";
import { items, itemVariants } from "../../db/schema/items";
import { reviews } from "../../db/schema/reviews";
import { AppError } from "../../security/error-handler";

export const seoPlatformRouter = new Hono<AppEnv>();
export const seoTenantRouter = new Hono<AppEnv>();

/**
 * Public SEO metadata listing active merchant storefronts for root sitemap,
 * robots.txt discovery links, and platform homepage SSR directory links.
 */
seoPlatformRouter.get("/seo-stores", async (c) => {
  if (!c.env?.DB) {
    throw new AppError("Database binding not initialized.", 500, "DB_NOT_INITIALIZED");
  }

  const db = createDb(c.env.DB);
  const activeStores = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      subdomain: tenants.subdomain,
      customDomain: tenants.customDomain,
      businessType: tenants.businessType,
      currency: tenants.currency,
      settings: tenants.settings,
      itemCount: sql<number>`(select count(*) from items where items.tenant_id = ${tenants.id} and items.status = 'PUBLISHED')`,
      updatedAt: tenants.updatedAt,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .where(
      and(
        eq(tenants.status, "ACTIVE"),
        notLike(tenants.id, "tenant-demo-%"),
        sql`exists (select 1 from items where items.tenant_id = ${tenants.id} and items.status = 'PUBLISHED')`
      )
    )
    .orderBy(desc(tenants.updatedAt), desc(tenants.createdAt))
    .limit(10000);

  c.header("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
  return c.json({
    success: true,
    data: activeStores,
  });
});

/**
 * Consolidated SEO bootstrap for an active storefront (metadata, categories,
 * published products/services, variants, and aggregated review ratings).
 */
seoTenantRouter.get("/storefront", async (c) => {
  const tenant = c.get("tenant")!;
  if (tenant.status !== "ACTIVE") {
    throw new AppError("Storefront is not publicly indexable.", 404, "TENANT_INACTIVE");
  }
  if (!c.env?.DB) {
    throw new AppError("Database binding not initialized.", 500, "DB_NOT_INITIALIZED");
  }

  const db = createDb(c.env.DB);

  const [categoryList, itemList, ratingRows] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        parentId: categories.parentId,
        description: categories.description,
      })
      .from(categories)
      .where(and(eq(categories.tenantId, tenant.id), eq(categories.isActive, true)))
      .orderBy(asc(categories.displayOrder), asc(categories.name)),
    db
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
        updatedAt: items.updatedAt,
        createdAt: items.createdAt,
      })
      .from(items)
      .where(and(eq(items.tenantId, tenant.id), eq(items.status, "PUBLISHED")))
      .orderBy(desc(items.updatedAt), desc(items.createdAt))
      .limit(500),
    db
      .select({
        itemId: reviews.itemId,
        reviewCount: sql<number>`count(*)`,
        avgRating: sql<number>`round(avg(${reviews.rating}), 1)`,
      })
      .from(reviews)
      .where(eq(reviews.tenantId, tenant.id))
      .groupBy(reviews.itemId),
  ]);

  const itemIds = itemList.map((item) => item.id);
  const allVariants =
    itemIds.length > 0
      ? await db
          .select({
            id: itemVariants.id,
            itemId: itemVariants.itemId,
            title: itemVariants.title,
            price: itemVariants.price,
            stockQuantity: itemVariants.stockQuantity,
          })
          .from(itemVariants)
          .where(and(eq(itemVariants.tenantId, tenant.id), inArray(itemVariants.itemId, itemIds)))
      : [];

  const variantsByItem = new Map<string, typeof allVariants>();
  for (const variant of allVariants) {
    const arr = variantsByItem.get(variant.itemId) || [];
    arr.push(variant);
    variantsByItem.set(variant.itemId, arr);
  }

  const ratingsByItem = new Map<string, { reviewCount: number; avgRating: number }>();
  for (const row of ratingRows) {
    ratingsByItem.set(row.itemId, {
      reviewCount: Number(row.reviewCount) || 0,
      avgRating: Number(row.avgRating) || 0,
    });
  }

  const enrichedItems = itemList.map((item) => {
    const ratingStats = ratingsByItem.get(item.id);
    return {
      ...item,
      variants: variantsByItem.get(item.id) || [],
      reviewCount: ratingStats?.reviewCount || 0,
      avgRating: ratingStats?.avgRating || 0,
    };
  });

  c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  return c.json({
    success: true,
    data: {
      tenant,
      categories: categoryList,
      items: enrichedItems,
    },
  });
});

/**
 * Full SEO detail payload for a single published product or service URL (/item/:slug).
 */
seoTenantRouter.get("/item/:slug", async (c) => {
  const tenant = c.get("tenant")!;
  if (tenant.status !== "ACTIVE") {
    throw new AppError("Storefront is not publicly indexable.", 404, "TENANT_INACTIVE");
  }
  if (!c.env?.DB) {
    throw new AppError("Database binding not initialized.", 500, "DB_NOT_INITIALIZED");
  }

  const slug = c.req.param("slug");
  const db = createDb(c.env.DB);

  const [item] = await db
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
      updatedAt: items.updatedAt,
      createdAt: items.createdAt,
    })
    .from(items)
    .where(and(eq(items.tenantId, tenant.id), eq(items.slug, slug), eq(items.status, "PUBLISHED")))
    .limit(1);

  if (!item) {
    throw new AppError("Item not found.", 404, "ITEM_NOT_FOUND");
  }

  const [variants, categoryRow, reviewList, ratingAgg] = await Promise.all([
    db
      .select({
        id: itemVariants.id,
        title: itemVariants.title,
        price: itemVariants.price,
        compareAtPrice: itemVariants.compareAtPrice,
        stockQuantity: itemVariants.stockQuantity,
        options: itemVariants.options,
      })
      .from(itemVariants)
      .where(and(eq(itemVariants.tenantId, tenant.id), eq(itemVariants.itemId, item.id))),
    item.categoryId
      ? db
          .select({ id: categories.id, name: categories.name, slug: categories.slug, parentId: categories.parentId })
          .from(categories)
          .where(and(eq(categories.tenantId, tenant.id), eq(categories.id, item.categoryId)))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        customerName: reviews.customerName,
        rating: reviews.rating,
        comment: reviews.comment,
        isVerifiedBuyer: reviews.isVerifiedBuyer,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(and(eq(reviews.tenantId, tenant.id), eq(reviews.itemId, item.id)))
      .orderBy(desc(reviews.createdAt))
      .limit(10),
    db
      .select({
        reviewCount: sql<number>`count(*)`,
        avgRating: sql<number>`round(avg(${reviews.rating}), 1)`,
      })
      .from(reviews)
      .where(and(eq(reviews.tenantId, tenant.id), eq(reviews.itemId, item.id))),
  ]);

  const reviewCount = Number(ratingAgg[0]?.reviewCount) || 0;
  const avgRating = reviewCount > 0 ? Number(ratingAgg[0]?.avgRating) || 0 : 0;

  c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  return c.json({
    success: true,
    data: {
      tenant,
      item: {
        ...item,
        variants,
        reviewCount,
        avgRating,
      },
      category: categoryRow[0] || null,
      reviews: reviewList,
    },
  });
});
