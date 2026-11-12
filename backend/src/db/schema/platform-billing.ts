import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { tenants } from "./tenants";

export const platformBillingSettings = sqliteTable("platform_billing_settings", {
  id: text("id").primaryKey(),
  amount: integer("amount").notNull().default(0),
  intervalDays: integer("interval_days").notNull().default(30),
  shortcodeType: text("shortcode_type", { enum: ["PAYBILL", "BUY_GOODS"] }).notNull().default("PAYBILL"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const platformBillingPayments = sqliteTable(
  "platform_billing_payments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    intervalDays: integer("interval_days").notNull(),
    phoneNumber: text("phone_number").notNull(),
    status: text("status", { enum: ["INITIATED", "COMPLETED", "FAILED"] })
      .notNull()
      .default("INITIATED"),
    merchantRequestId: text("merchant_request_id"),
    checkoutRequestId: text("checkout_request_id").unique(),
    callbackTokenHash: text("callback_token_hash").notNull(),
    mpesaReceiptNumber: text("mpesa_receipt_number"),
    resultCode: integer("result_code"),
    resultDesc: text("result_desc"),
    paidAt: integer("paid_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    tenantCreatedIdx: index("platform_billing_tenant_created_idx").on(table.tenantId, table.createdAt),
    checkoutRequestIdx: index("platform_billing_checkout_idx").on(table.checkoutRequestId),
  })
);
