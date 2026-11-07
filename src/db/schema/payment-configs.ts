import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { tenants } from "./tenants";

export const tenantPaymentConfigs = sqliteTable(
  "tenant_payment_configs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("MPESA"),
    // Disabled by default until merchant configures their Safaricom credentials
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(false),
    shortcodeType: text("shortcode_type", { enum: ["PAYBILL", "BUY_GOODS"] })
      .notNull()
      .default("PAYBILL"),
    shortcode: text("shortcode"), // Paybill Number or Till Number
    passkey: text("passkey"), // Lipa Na M-Pesa Passkey
    consumerKey: text("consumer_key"), // Daraja App Consumer Key
    consumerSecret: text("consumer_secret"), // Daraja App Consumer Secret
    isSandbox: integer("is_sandbox", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    tenantProviderIdx: uniqueIndex("tenant_payment_provider_idx").on(
      table.tenantId,
      table.provider
    ),
  })
);

export type TenantPaymentConfig = typeof tenantPaymentConfigs.$inferSelect;
export type NewTenantPaymentConfig = typeof tenantPaymentConfigs.$inferInsert;
