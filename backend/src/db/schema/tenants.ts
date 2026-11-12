import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable(
  "tenants",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    subdomain: text("subdomain").notNull().unique(),
    customDomain: text("custom_domain").unique(),
    businessType: text("business_type").notNull().default("RETAIL"),
    currency: text("currency").notNull().default("KES"),
    // Changed to PENDING by default until Super Admin approves
    status: text("status", { enum: ["ACTIVE", "SUSPENDED", "PENDING"] })
      .notNull()
      .default("PENDING"),
    // Dynamic settings: branding, logo, contact, business hours, social links
    settings: text("settings", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({}),
    subscriptionDueAt: integer("subscription_due_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    subdomainIdx: index("tenants_subdomain_idx").on(table.subdomain),
    customDomainIdx: index("tenants_custom_domain_idx").on(table.customDomain),
    statusIdx: index("tenants_status_idx").on(table.status),
  })
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
