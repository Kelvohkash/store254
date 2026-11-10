import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { items } from "../../db/schema/items";
import { categories } from "../../db/schema/categories";
import { attributeDefinitions } from "../../db/schema/attributes";

export const filtersRouter = new Hono<AppEnv>();

interface DynamicFacet {
  code: string;
  name: string;
  type: string;
  unit: string | null;
  options: { value: string; count: number }[];
}

// Compute Dynamic Filters and Facets for Storefront
filtersRouter.get("/", async (c) => {
  const tenant = c.get("tenant")!;
  const categorySlug = c.req.query("category");
  const db = createDb(c.env.DB);

  // 1. Resolve category if provided
  let categoryId: string | null = null;
  if (categorySlug) {
    const [matchedCategory] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.tenantId, tenant.id), eq(categories.slug, categorySlug)))
      .limit(1);

    if (matchedCategory) {
      categoryId = matchedCategory.id;
    }
  }

  // 2. Fetch all filterable attribute definitions for this store/category
  const allAttributes = await db
    .select()
    .from(attributeDefinitions)
    .where(and(eq(attributeDefinitions.tenantId, tenant.id), eq(attributeDefinitions.isFilterable, true)));

  const applicableAttributes = categoryId
    ? allAttributes.filter((attr) => !attr.categoryId || attr.categoryId === categoryId)
    : allAttributes;

  // 3. Fetch published items in this scope
  const itemList = await db
    .select({
      basePrice: items.basePrice,
      attributes: items.attributes,
      itemType: items.itemType,
    })
    .from(items)
    .where(
      categoryId
        ? and(
            eq(items.tenantId, tenant.id),
            eq(items.status, "PUBLISHED"),
            eq(items.categoryId, categoryId)
          )
        : and(eq(items.tenantId, tenant.id), eq(items.status, "PUBLISHED"))
    );

  // 4. Compute Price Boundaries
  let minPrice = itemList.length > 0 ? itemList[0].basePrice : 0;
  let maxPrice = itemList.length > 0 ? itemList[0].basePrice : 0;

  for (const item of itemList) {
    if (item.basePrice < minPrice) minPrice = item.basePrice;
    if (item.basePrice > maxPrice) maxPrice = item.basePrice;
  }

  // 5. Compute Option Frequencies for each dynamic filterable attribute
  const facets: DynamicFacet[] = [];

  for (const attr of applicableAttributes) {
    const counts = new Map<string, number>();

    // Seed predefined options if any
    const predefinedOptions = (attr.options as string[]) || [];
    for (const opt of predefinedOptions) {
      counts.set(opt, 0);
    }

    // Tally actual occurrences in items
    for (const item of itemList) {
      const itemAttrs = (item.attributes as Record<string, unknown>) || {};
      const val = itemAttrs[attr.code];

      if (val !== undefined && val !== null) {
        const valStr = String(val).trim();
        counts.set(valStr, (counts.get(valStr) || 0) + 1);
      }
    }

    // Convert map to sorted option list
    const optionsArray = Array.from(counts.entries())
      .filter(([_, count]) => count > 0 || predefinedOptions.length > 0)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    facets.push({
      code: attr.code,
      name: attr.name,
      type: attr.type,
      unit: attr.unit,
      options: optionsArray,
    });
  }

  c.header("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
  return c.json({
    success: true,
    data: {
      priceRange: {
        min: minPrice,
        max: maxPrice,
      },
      itemCount: itemList.length,
      facets,
    },
  });
});
