import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { tenants } from "./tenants";

export const promotions = sqliteTable(
  "promotions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(), // e.g. "Mega Mid-Year Electronics Sale"
    // Optional coupon code: null for automatic storewide/category sales, or code like "FLASH20"
    code: text("code"),
    discountType: text("discount_type", {
      enum: ["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"],
    })
      .notNull()
      .default("PERCENTAGE"),
    // If percentage: 1-100 (e.g. 15 for 15% off). If fixed amount: amount in KES
    discountValue: integer("discount_value").notNull(),
    minOrderAmount: integer("min_order_amount").notNull().default(0),
    maxDiscountAmount: integer("max_discount_amount"), // optional cap for percentage discounts
    appliesTo: text("applies_to", {
      enum: ["ALL", "SPECIFIC_CATEGORIES", "SPECIFIC_ITEMS"],
    })
      .notNull()
      .default("ALL"),
    // Target category or item IDs when appliesTo != 'ALL'
    targetIds: text("target_ids", { mode: "json" })
      .$type<string[]>()
      .default([]),
    usageLimit: integer("usage_limit"), // null = unlimited
    usageCount: integer("usage_count").notNull().default(0),
    startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp" }), // null = no expiry
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    tenantCodeIdx: uniqueIndex("promotions_tenant_code_idx").on(table.tenantId, table.code),
    tenantActiveIdx: index("promotions_tenant_active_idx").on(table.tenantId, table.isActive),
  })
);

export type Promotion = typeof promotions.$inferSelect;
export type NewPromotion = typeof promotions.$inferInsert;
