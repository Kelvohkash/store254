import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { tenants } from "./tenants";
import { categories } from "./categories";

export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    // Flexible item type: handles physical retail, digital goods, and professional/appointment services
    itemType: text("item_type", { enum: ["PHYSICAL", "SERVICE", "DIGITAL"] })
      .notNull()
      .default("PHYSICAL"),
    // Prices in integer currency units (e.g. KES)
    basePrice: integer("base_price").notNull(),
    compareAtPrice: integer("compare_at_price"), // original price before discount
    costPrice: integer("cost_price"), // for merchant cost/profit reporting
    sku: text("sku"),
    barcode: text("barcode"),
    trackInventory: integer("track_inventory", { mode: "boolean" }).notNull().default(true),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    status: text("status", { enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] })
      .notNull()
      .default("PUBLISHED"),
    // Product image URLs array
    images: text("images", { mode: "json" })
      .$type<string[]>()
      .default([]),
    // Dynamic attributes matching store attributeDefinitions:
    // e.g. { "brand": "Samsung", "screen_size": 55, "warranty": "2 Years" }
    attributes: text("attributes", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({}),
    // Arbitrary merchant metadata (e.g. service duration, cancellation policy, warranty notes)
    metadata: text("metadata", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({}),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    tenantSlugIdx: uniqueIndex("items_tenant_slug_idx").on(table.tenantId, table.slug),
    tenantCategoryIdx: index("items_tenant_category_idx").on(table.tenantId, table.categoryId),
    tenantStatusIdx: index("items_tenant_status_idx").on(table.tenantId, table.status),
    tenantPriceIdx: index("items_tenant_price_idx").on(table.tenantId, table.basePrice),
  })
);

export const itemVariants = sqliteTable(
  "item_variants",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    title: text("title").notNull(), // e.g. "55 inch / Black" or "60 Mins Session"
    sku: text("sku"),
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    // Dynamic option matrix: e.g. { "size": "55 inch", "color": "Black" }
    options: text("options", { mode: "json" })
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    tenantItemIdx: index("variants_tenant_item_idx").on(table.tenantId, table.itemId),
  })
);

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type ItemVariant = typeof itemVariants.$inferSelect;
export type NewItemVariant = typeof itemVariants.$inferInsert;
