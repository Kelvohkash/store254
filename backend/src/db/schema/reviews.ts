import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { tenants } from "./tenants";
import { users } from "./users";
import { items } from "./items";

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    customerId: text("customer_id").references(() => users.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    rating: integer("rating").notNull(), // 1 to 5 stars
    comment: text("comment"),
    isVerifiedBuyer: integer("is_verified_buyer", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    tenantItemRatingIdx: index("reviews_tenant_item_rating_idx").on(
      table.tenantId,
      table.itemId,
      table.rating
    ),
    tenantCustomerIdx: index("reviews_tenant_customer_idx").on(
      table.tenantId,
      table.customerId
    ),
  })
);

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
