import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { tenants } from "./tenants";
import { categories } from "./categories";

export const attributeDefinitions = sqliteTable(
  "attribute_definitions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // If null, this attribute is available globally for all categories of the store
    categoryId: text("category_id").references(() => categories.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // normalized identifier, e.g. "brand", "screen_size"
    name: text("name").notNull(), // display label, e.g. "Brand", "Screen Size"
    type: text("type", {
      enum: ["TEXT", "NUMBER", "SELECT", "MULTISELECT", "BOOLEAN", "RANGE"],
    })
      .notNull()
      .default("TEXT"),
    // Pre-defined choices for SELECT/MULTISELECT: e.g. ["Samsung", "Sony", "LG"]
    options: text("options", { mode: "json" })
      .$type<string[]>()
      .default([]),
    unit: text("unit"), // e.g. "inches", "kg", "GB", "hours"
    isFilterable: integer("is_filterable", { mode: "boolean" }).notNull().default(true),
    isRequired: integer("is_required", { mode: "boolean" }).notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    tenantCategoryCodeIdx: uniqueIndex("attr_def_tenant_category_code_idx").on(
      table.tenantId,
      table.categoryId,
      table.code
    ),
    tenantFilterableIdx: index("attr_def_tenant_filterable_idx").on(
      table.tenantId,
      table.isFilterable
    ),
  })
);

export type AttributeDefinition = typeof attributeDefinitions.$inferSelect;
export type NewAttributeDefinition = typeof attributeDefinitions.$inferInsert;
