import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { tenants } from "./tenants";
import { users } from "./users";
import { items, itemVariants } from "./items";

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderNumber: text("order_number").notNull(), // e.g. "ORD-2026-1001"
    customerId: text("customer_id").references(() => users.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    shippingAddress: text("shipping_address", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({}),
    currency: text("currency").notNull().default("KES"),
    subtotal: integer("subtotal").notNull(),
    discountAmount: integer("discount_amount").notNull().default(0),
    shippingFee: integer("shipping_fee").notNull().default(0),
    totalAmount: integer("total_amount").notNull(),
    couponCode: text("coupon_code"),
    status: text("status", {
      enum: ["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELLED"],
    })
      .notNull()
      .default("PENDING_PAYMENT"),
    paymentStatus: text("payment_status", {
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
    })
      .notNull()
      .default("PENDING"),
    paymentMethod: text("payment_method").notNull().default("MPESA"),
    // Fulfillment & Courier Tracking (e.g. Fargo Courier, Wells Fargo, G4S, Rider)
    fulfillmentDetails: text("fulfillment_details", { mode: "json" })
      .$type<{
        courierName?: string;
        trackingNumber?: string;
        trackingUrl?: string;
        dispatchedAt?: string;
        deliveredAt?: string;
        paymentInstructionsVisible?: boolean;
        paymentInstructionsShownAt?: string;
        inventoryDeducted?: boolean;
        notes?: string;
      }>()
      .default({}),
    // Service Booking Information (For appointment / consulting services)
    bookingDetails: text("booking_details", { mode: "json" })
      .$type<{
        bookingDate?: string;
        timeSlot?: string;
        serviceLocation?: string;
        specialInstructions?: string;
      }>()
      .default({}),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    tenantOrderNumberIdx: uniqueIndex("orders_tenant_number_idx").on(
      table.tenantId,
      table.orderNumber
    ),
    tenantStatusIdx: index("orders_tenant_status_idx").on(table.tenantId, table.status),
    tenantCustomerIdx: index("orders_tenant_customer_idx").on(table.tenantId, table.customerId),
  })
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    itemId: text("item_id").references(() => items.id, { onDelete: "set null" }),
    variantId: text("variant_id").references(() => itemVariants.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    sku: text("sku"),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    totalPrice: integer("total_price").notNull(),
    // Snapshot of attributes/options at time of order placement
    options: text("options", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({}),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    tenantOrderIdx: index("order_items_tenant_order_idx").on(table.tenantId, table.orderId),
  })
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    paymentMethod: text("payment_method").notNull().default("MPESA"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("KES"),
    status: text("status", { enum: ["INITIATED", "COMPLETED", "FAILED"] })
      .notNull()
      .default("INITIATED"),
    merchantRequestId: text("merchant_request_id"),
    checkoutRequestId: text("checkout_request_id").unique(),
    callbackTokenHash: text("callback_token_hash"),
    statusTokenHash: text("status_token_hash"),
    mpesaReceiptNumber: text("mpesa_receipt_number"),
    transactionDate: integer("transaction_date", { mode: "timestamp" }),
    phoneNumber: text("phone_number"),
    resultCode: integer("result_code"),
    resultDesc: text("result_desc"),
    rawCallback: text("raw_callback", { mode: "json" })
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
    checkoutRequestIdx: index("payments_checkout_req_idx").on(table.checkoutRequestId),
    mpesaReceiptIdx: index("payments_mpesa_receipt_idx").on(table.mpesaReceiptNumber),
    tenantOrderIdx: index("payments_tenant_order_idx").on(table.tenantId, table.orderId),
  })
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
