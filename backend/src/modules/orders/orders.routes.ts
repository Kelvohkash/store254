import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, inArray, or, gte, lte, sql } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { orders, orderItems, payments } from "../../db/schema/orders";
import { items, itemVariants } from "../../db/schema/items";
import { tenantPaymentConfigs } from "../../db/schema/payment-configs";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware";
import { generateUUID, generateSecureToken, hashOtp } from "../../security/crypto";
import { AppError } from "../../security/error-handler";
import { rateLimiter } from "../../security/rate-limiter";
import {
  normalizeKenyanPhone,
  initiateMpesaStkPush,
  type MpesaCredentials,
} from "../../security/mpesa";
import { EmailService } from "../../services/email.service";
import {
  checkoutSchema,
  createOrderForTenant,
  getDecryptedPaymentConfig,
} from "./checkout.service";

export const ordersRouter = new Hono<AppEnv>();

const updateOrderStatusSchema = z.object({
  status: z.enum(["PROCESSING", "SHIPPED", "CANCELLED"]),
  fulfillmentDetails: z
    .object({
      courierName: z.string().max(80).optional(), // e.g. "Fargo Courier", "Wells Fargo", "Rider"
      trackingNumber: z.string().max(100).optional(),
      trackingUrl: z.string().url().optional(),
      notes: z.string().max(500).optional(),
    })
    .optional(),
});

const markOrderPaidSchema = z.object({
  paymentStatus: z.literal("PAID"),
});

const sendPaymentPromptSchema = z.object({
  phoneNumber: z.string().min(9).max(15).optional(),
});

// Create Order & Trigger Merchant's M-Pesa STK Push
ordersRouter.post("/checkout", authMiddleware(false), zValidator("json", checkoutSchema), async (c) => {
  const tenant = c.get("tenant")!;
  const user = c.get("user");
  const body = c.req.valid("json");

  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);
  const result = await createOrderForTenant(db, c.env, tenant, user, body);

  return c.json(
    {
      success: true,
      message: result.message,
      data: result.data,
    },
    201
  );
});

// Merchant Update Order Status & Courier Tracking (Fulfillment)
ordersRouter.patch(
  "/:id/status",
  authMiddleware(true),
  requireRole(["OWNER", "ADMIN"]),
  zValidator("json", updateOrderStatusSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const orderId = c.req.param("id");
    const { status, fulfillmentDetails } = c.req.valid("json");

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenant.id), eq(orders.id, orderId)))
      .limit(1);

    if (!order) {
      throw new AppError("Order not found.", 404, "ORDER_NOT_FOUND");
    }
    if (order.status === "COMPLETED") {
      throw new AppError("Delivered orders cannot be changed by the merchant.", 400, "ORDER_ALREADY_DELIVERED");
    }

    const shouldRestoreStock =
      status === "CANCELLED" &&
      order.status !== "CANCELLED" &&
      (order.fulfillmentDetails?.inventoryDeducted === true || order.paymentStatus === "PAID");

    const mergedFulfillment = {
      ...(order.fulfillmentDetails || {}),
      ...(fulfillmentDetails || {}),
      dispatchedAt: status === "SHIPPED" ? new Date().toISOString() : order.fulfillmentDetails?.dispatchedAt,
      deliveredAt: order.fulfillmentDetails?.deliveredAt,
      inventoryDeducted: shouldRestoreStock
        ? false
        : order.fulfillmentDetails?.inventoryDeducted,
    };

    const [updatedOrder] = await db
      .update(orders)
      .set({
        status,
        fulfillmentDetails: mergedFulfillment,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orders.tenantId, tenant.id),
          eq(orders.id, order.id),
          eq(orders.status, order.status)
        )
      )
      .returning({ id: orders.id });
    if (!updatedOrder) {
      throw new AppError("Order status changed. Refresh and try again.", 409, "ORDER_STATUS_CHANGED");
    }

    if (shouldRestoreStock) {
      const lines = await db
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.orderId, order.id), eq(orderItems.tenantId, tenant.id)));
      for (const line of lines) {
        if (line.variantId) {
          await db
            .update(itemVariants)
            .set({ stockQuantity: sql`${itemVariants.stockQuantity} + ${line.quantity}` })
            .where(and(eq(itemVariants.id, line.variantId), eq(itemVariants.tenantId, tenant.id)));
        } else if (line.itemId) {
          await db
            .update(items)
            .set({ stockQuantity: sql`${items.stockQuantity} + ${line.quantity}` })
            .where(and(eq(items.id, line.itemId), eq(items.tenantId, tenant.id)));
        }
      }
    }

    // Send customer notification email about the new status
    await EmailService.sendOrderStatusUpdate({
      to: order.customerEmail,
      customerName: order.customerName,
      storeName: tenant.name,
      orderNumber: order.orderNumber,
      status,
      courierName: mergedFulfillment.courierName,
      trackingNumber: mergedFulfillment.trackingNumber,
      trackingUrl: mergedFulfillment.trackingUrl,
      notes: mergedFulfillment.notes,
      apiKey: c.env?.RESEND_API_KEY,
    });

    return c.json({
      success: true,
      message: `Order #${order.orderNumber} status updated to ${status}. Notification dispatched.`,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status,
        paymentStatus: order.paymentStatus,
        fulfillmentDetails: mergedFulfillment,
      },
    });
  }
);

ordersRouter.post("/:id/confirm-delivery", authMiddleware(true), async (c) => {
  const tenant = c.get("tenant")!;
  const user = c.get("user")!;
  const orderId = c.req.param("id");
  if (user.role !== "CUSTOMER") {
    throw new AppError("Only the customer can confirm delivery.", 403, "CUSTOMER_REQUIRED");
  }
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.tenantId, tenant.id), eq(orders.id, orderId)))
    .limit(1);
  if (!order) throw new AppError("Order not found.", 404, "ORDER_NOT_FOUND");
  if (order.customerId !== user.id && order.customerEmail.toLowerCase() !== user.email.toLowerCase()) {
    throw new AppError("This order does not belong to your account.", 403, "ORDER_NOT_OWNED");
  }
  if (order.status !== "SHIPPED") {
    throw new AppError("Only shipped orders can be confirmed as delivered.", 400, "ORDER_NOT_SHIPPED");
  }

  const deliveredAt = new Date().toISOString();
  const fulfillmentDetails = {
    ...(order.fulfillmentDetails || {}),
    deliveredAt,
  };
  const [confirmedOrder] = await db
    .update(orders)
    .set({ status: "COMPLETED", fulfillmentDetails, updatedAt: new Date() })
    .where(
      and(
        eq(orders.tenantId, tenant.id),
        eq(orders.id, orderId),
        eq(orders.status, "SHIPPED")
      )
    )
    .returning({ id: orders.id });
  if (!confirmedOrder) {
    throw new AppError(
      "The order status changed before delivery could be confirmed. Refresh and try again.",
      409,
      "ORDER_STATUS_CHANGED"
    );
  }

  if (order.paymentMethod !== "CASH_ON_DELIVERY" || order.paymentStatus === "PAID") {
    return c.json({
      success: true,
      message: "Thanks for confirming delivery.",
      data: { orderId, status: "COMPLETED", paymentStatus: order.paymentStatus },
    });
  }

  const [storedConfig] = await db
    .select()
    .from(tenantPaymentConfigs)
    .where(
      and(
        eq(tenantPaymentConfigs.tenantId, tenant.id),
        eq(tenantPaymentConfigs.provider, "MPESA")
      )
    )
    .limit(1);
  const config = storedConfig
    ? await getDecryptedPaymentConfig(db, storedConfig, c.env?.PAYMENT_CONFIG_ENCRYPTION_KEY)
    : undefined;

  if (
    config?.isEnabled &&
    config.consumerKey &&
    config.consumerSecret &&
    config.passkey &&
    config.shortcode
  ) {
    const customerPhone = normalizeKenyanPhone(order.customerPhone);
    if (!customerPhone) {
      return c.json({
        success: true,
        message: "Delivery confirmed. Update your account phone number with a valid M-Pesa number to pay by prompt, or use the payment instructions below.",
        data: {
          orderId,
          status: "COMPLETED",
          paymentStatus: "PENDING",
        },
      });
    }

    const callbackToken = generateSecureToken();
    const statusToken = generateSecureToken();
    const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";
    let result: Awaited<ReturnType<typeof initiateMpesaStkPush>>;
    try {
      result = await initiateMpesaStkPush({
        credentials: {
          consumerKey: config.consumerKey,
          consumerSecret: config.consumerSecret,
          passkey: config.passkey,
          shortcode: config.shortcode,
          shortcodeType: config.shortcodeType,
          isSandbox: config.isSandbox,
        },
        phoneNumber: customerPhone,
        amount: order.totalAmount,
        orderNumber: order.orderNumber,
        storeName: tenant.name,
        callbackUrl: `https://${primaryDomain}/api/payments/mpesa/callback?token=${callbackToken}`,
      });
    } catch (error) {
      console.error("M-Pesa delivery payment prompt failed.", {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      await db
        .update(orders)
        .set({
          fulfillmentDetails: {
            ...fulfillmentDetails,
            paymentInstructionsVisible: true,
            paymentInstructionsShownAt: deliveredAt,
          },
          updatedAt: new Date(),
        })
        .where(and(eq(orders.tenantId, tenant.id), eq(orders.id, orderId)));

      return c.json({
        success: true,
        message: "Delivery confirmed, but the M-Pesa prompt could not be sent. Use the payment instructions below.",
        data: {
          orderId,
          status: "COMPLETED",
          paymentStatus: "PENDING",
          paymentPromptFailed: true,
          paymentInstructions: {
            method: config.shortcodeType,
            shortcode: config.shortcode,
            accountReference: config.shortcodeType === "PAYBILL" ? order.orderNumber : null,
            amount: order.totalAmount,
            currency: order.currency,
          },
        },
      });
    }

    await db.insert(payments).values({
      id: generateUUID(),
      tenantId: tenant.id,
      orderId: order.id,
      paymentMethod: "MPESA",
      amount: order.totalAmount,
      currency: order.currency,
      status: "INITIATED",
      merchantRequestId: result.merchantRequestId,
      checkoutRequestId: result.checkoutRequestId,
      phoneNumber: customerPhone,
      callbackTokenHash: await hashOtp(callbackToken),
      statusTokenHash: await hashOtp(statusToken),
    });

    return c.json({
      success: true,
      message: result.customerMessage || "Delivery confirmed. M-Pesa payment prompt sent.",
      data: {
        orderId,
        orderNumber: order.orderNumber,
        status: "COMPLETED",
        paymentStatus: "PENDING",
        checkoutRequestId: result.checkoutRequestId,
        paymentStatusToken: statusToken,
        phoneNumber: customerPhone,
        totalAmount: order.totalAmount,
      },
    });
  }

  const fulfillmentWithInstructions = {
    ...fulfillmentDetails,
    paymentInstructionsVisible: true,
    paymentInstructionsShownAt: deliveredAt,
  };
  await db
    .update(orders)
    .set({ fulfillmentDetails: fulfillmentWithInstructions, updatedAt: new Date() })
    .where(and(eq(orders.tenantId, tenant.id), eq(orders.id, orderId)));

  return c.json({
    success: true,
    message: config?.shortcode
      ? "Delivery confirmed. M-Pesa payment instructions are shown below."
      : "Delivery confirmed. Please pay the store directly and contact them to confirm payment.",
    data: {
      orderId,
      status: "COMPLETED",
      paymentStatus: "PENDING",
      paymentInstructions: config?.shortcode
        ? {
            method: config.shortcodeType,
            shortcode: config.shortcode,
            accountReference: config.shortcodeType === "PAYBILL" ? order.orderNumber : null,
            amount: order.totalAmount,
            currency: order.currency,
          }
        : null,
    },
  });
});

ordersRouter.patch(
  "/:id/payment-status",
  authMiddleware(true),
  requireRole(["OWNER", "ADMIN"]),
  zValidator("json", markOrderPaidSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const orderId = c.req.param("id");

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenant.id), eq(orders.id, orderId)))
      .limit(1);

    if (!order) throw new AppError("Order not found.", 404, "ORDER_NOT_FOUND");
    if (order.paymentMethod !== "CASH_ON_DELIVERY") {
      throw new AppError(
        "Only cash-on-delivery orders can be manually marked as paid.",
        400,
        "PAYMENT_METHOD_NOT_MANUAL"
      );
    }
    if (order.status !== "COMPLETED") {
      throw new AppError(
        "Manually record payment after the order has been delivered.",
        400,
        "ORDER_NOT_DELIVERED"
      );
    }
    if (order.paymentStatus === "PAID") {
      throw new AppError("This order is already marked as paid.", 409, "ORDER_ALREADY_PAID");
    }

    await db
      .update(orders)
      .set({ paymentStatus: "PAID", updatedAt: new Date() })
      .where(and(eq(orders.tenantId, tenant.id), eq(orders.id, orderId)));

    return c.json({
      success: true,
      message: `Payment for order #${order.orderNumber} recorded.`,
      data: {
        orderId,
        orderNumber: order.orderNumber,
        paymentStatus: "PAID",
      },
    });
  }
);

ordersRouter.post(
  "/:id/payment-instructions",
  authMiddleware(true),
  requireRole(["OWNER", "ADMIN"]),
  async (c) => {
    const tenant = c.get("tenant")!;
    const orderId = c.req.param("id");

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenant.id), eq(orders.id, orderId)))
      .limit(1);

    if (!order) throw new AppError("Order not found.", 404, "ORDER_NOT_FOUND");
    if (order.paymentMethod !== "CASH_ON_DELIVERY" || order.paymentStatus === "PAID") {
      throw new AppError(
        "Payment instructions are available only for unpaid cash-on-delivery orders.",
        400,
        "PAYMENT_INSTRUCTIONS_UNAVAILABLE"
      );
    }
    if (order.status !== "COMPLETED") {
      throw new AppError(
        "Wait for the customer to confirm delivery before showing payment instructions.",
        400,
        "ORDER_NOT_DELIVERED"
      );
    }

    const [config] = await db
      .select({
        shortcode: tenantPaymentConfigs.shortcode,
        shortcodeType: tenantPaymentConfigs.shortcodeType,
      })
      .from(tenantPaymentConfigs)
      .where(
        and(
          eq(tenantPaymentConfigs.tenantId, tenant.id),
          eq(tenantPaymentConfigs.provider, "MPESA")
        )
      )
      .limit(1);

    if (!config?.shortcode) {
      throw new AppError(
        "Add your M-Pesa Till or Paybill number in payment settings first.",
        400,
        "PAYMENT_INSTRUCTIONS_NOT_CONFIGURED"
      );
    }

    const fulfillmentDetails = {
      ...(order.fulfillmentDetails || {}),
      paymentInstructionsVisible: true,
      paymentInstructionsShownAt: new Date().toISOString(),
    };
    await db
      .update(orders)
      .set({ fulfillmentDetails, updatedAt: new Date() })
      .where(and(eq(orders.tenantId, tenant.id), eq(orders.id, orderId)));

    return c.json({
      success: true,
      message: "M-Pesa payment instructions are now visible in the customer's order history.",
      data: {
        orderId,
        shortcode: config.shortcode,
        shortcodeType: config.shortcodeType,
        accountReference: order.orderNumber,
        amount: order.totalAmount,
      },
    });
  }
);

ordersRouter.post(
  "/:id/payment-prompt",
  authMiddleware(true),
  requireRole(["OWNER", "ADMIN"]),
  zValidator("json", sendPaymentPromptSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const orderId = c.req.param("id");
    const { phoneNumber } = c.req.valid("json");

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenant.id), eq(orders.id, orderId)))
      .limit(1);

    if (!order) throw new AppError("Order not found.", 404, "ORDER_NOT_FOUND");
    if (order.paymentMethod !== "CASH_ON_DELIVERY" || order.paymentStatus === "PAID") {
      throw new AppError(
        "An M-Pesa prompt can only be sent for an unpaid cash-on-delivery order.",
        400,
        "PAYMENT_PROMPT_UNAVAILABLE"
      );
    }
    if (order.status !== "COMPLETED") {
      throw new AppError(
        "Wait for the customer to confirm delivery before sending a payment prompt.",
        400,
        "ORDER_NOT_DELIVERED"
      );
    }

    const [storedConfig] = await db
      .select()
      .from(tenantPaymentConfigs)
      .where(
        and(
          eq(tenantPaymentConfigs.tenantId, tenant.id),
          eq(tenantPaymentConfigs.provider, "MPESA")
        )
      )
      .limit(1);
    const config = storedConfig
      ? await getDecryptedPaymentConfig(db, storedConfig, c.env?.PAYMENT_CONFIG_ENCRYPTION_KEY)
      : undefined;
    if (
      !config?.isEnabled ||
      !config.consumerKey ||
      !config.consumerSecret ||
      !config.passkey ||
      !config.shortcode
    ) {
      throw new AppError(
        "Enable and configure M-Pesa in payment settings before sending a prompt.",
        400,
        "PAYMENT_CONFIG_INCOMPLETE"
      );
    }

    const customerPhone = normalizeKenyanPhone(phoneNumber || order.customerPhone);
    if (!customerPhone) {
      throw new AppError(
        "Enter a valid Kenyan M-Pesa number for this order.",
        400,
        "INVALID_PHONE_NUMBER"
      );
    }

    const callbackToken = generateSecureToken();
    const statusToken = generateSecureToken();
    const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";
    const callbackUrl = `https://${primaryDomain}/api/payments/mpesa/callback?token=${callbackToken}`;
    const result = await initiateMpesaStkPush({
      credentials: {
        consumerKey: config.consumerKey,
        consumerSecret: config.consumerSecret,
        passkey: config.passkey,
        shortcode: config.shortcode,
        shortcodeType: config.shortcodeType,
        isSandbox: config.isSandbox,
      },
      phoneNumber: customerPhone,
      amount: order.totalAmount,
      orderNumber: order.orderNumber,
      storeName: tenant.name,
      callbackUrl,
    });

    await db.insert(payments).values({
      id: generateUUID(),
      tenantId: tenant.id,
      orderId: order.id,
      paymentMethod: "MPESA",
      amount: order.totalAmount,
      currency: order.currency,
      status: "INITIATED",
      merchantRequestId: result.merchantRequestId,
      checkoutRequestId: result.checkoutRequestId,
      phoneNumber: customerPhone,
      callbackTokenHash: await hashOtp(callbackToken),
      statusTokenHash: await hashOtp(statusToken),
    });

    return c.json({
      success: true,
      message: result.customerMessage || "M-Pesa payment prompt sent.",
      data: {
        orderId,
        orderNumber: order.orderNumber,
        checkoutRequestId: result.checkoutRequestId,
        paymentStatusToken: statusToken,
        phoneNumber: customerPhone,
        amount: order.totalAmount,
      },
    });
  }
);

// Merchant Scheduled Service Bookings Calendar
ordersRouter.get("/calendar/bookings", authMiddleware(true), requireRole(["OWNER", "ADMIN"]), async (c) => {
  const tenant = c.get("tenant")!;

  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);

  // Fetch all orders with bookingDetails
  const allOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      customerEmail: orders.customerEmail,
      bookingDetails: orders.bookingDetails,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalAmount: orders.totalAmount,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.tenantId, tenant.id), or(eq(orders.status, "PAID"), eq(orders.status, "PROCESSING"), eq(orders.status, "COMPLETED"))))
    .orderBy(desc(orders.createdAt));

  // Filter orders that have a scheduled booking date
  const bookings = allOrders.filter((o) => Boolean(o.bookingDetails?.bookingDate));

  return c.json({
    success: true,
    data: bookings,
  });
});

// Authenticated Customer Order History (My Orders)
ordersRouter.get("/my-orders", authMiddleware(true), async (c) => {
  const tenant = c.get("tenant")!;
  const user = c.get("user")!;

  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);

  const customerOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenant.id),
        or(eq(orders.customerId, user.id), eq(orders.customerEmail, user.email))
      )
    )
    .orderBy(desc(orders.createdAt))
    .limit(50);

  const [paymentConfig] = await db
    .select({
      shortcode: tenantPaymentConfigs.shortcode,
      shortcodeType: tenantPaymentConfigs.shortcodeType,
    })
    .from(tenantPaymentConfigs)
    .where(
      and(
        eq(tenantPaymentConfigs.tenantId, tenant.id),
        eq(tenantPaymentConfigs.provider, "MPESA")
      )
    )
    .limit(1);

  return c.json({
    success: true,
    data: customerOrders.map((order) => {
      const instructionsAvailable =
        order.paymentMethod === "CASH_ON_DELIVERY" &&
        order.paymentStatus !== "PAID" &&
        order.fulfillmentDetails?.paymentInstructionsVisible === true &&
        order.status === "COMPLETED" &&
        Boolean(paymentConfig?.shortcode);

      return {
        ...order,
        paymentInstructions: instructionsAvailable
          ? {
              method: paymentConfig!.shortcodeType,
              shortcode: paymentConfig!.shortcode,
              accountReference:
                paymentConfig!.shortcodeType === "PAYBILL" ? order.orderNumber : null,
              amount: order.totalAmount,
              currency: order.currency,
            }
          : null,
      };
    }),
  });
});

function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return "***@***.com";
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
  return `${maskedName}@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return `${phone.slice(0, 4)}****${phone.slice(-3)}`;
}

// Get Order Details by ID (Protected against IDOR & PII Scraping)
ordersRouter.get(
  "/:id",
  rateLimiter({ max: 30, windowMs: 60 * 1000 }),
  authMiddleware(false),
  async (c) => {
    const tenant = c.get("tenant")!;
    const user = c.get("user");
    const orderId = c.req.param("id");

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenant.id), eq(orders.id, orderId)))
      .limit(1);

    if (!order) {
      throw new AppError("Order not found.", 404, "ORDER_NOT_FOUND");
    }

    // Check if requester has authorized access to view full customer PII
    const isMerchant =
      user &&
      ["OWNER", "ADMIN"].includes(user.role) &&
      user.tenantId === tenant.id;
    const isCustomerOwner =
      user &&
      (order.customerId === user.id ||
        (user.email &&
          order.customerEmail.toLowerCase() === user.email.toLowerCase()));
    const queryPhone = c.req.query("phone")?.trim();
    const isPhoneVerified =
      queryPhone &&
      normalizeKenyanPhone(queryPhone) === normalizeKenyanPhone(order.customerPhone);

    const hasFullAccess = isMerchant || isCustomerOwner || isPhoneVerified;

    const itemsList = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.tenantId, tenant.id), eq(orderItems.orderId, orderId)));

    const paymentsList = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        status: payments.status,
        mpesaReceiptNumber: payments.mpesaReceiptNumber,
        checkoutRequestId: payments.checkoutRequestId,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(and(eq(payments.tenantId, tenant.id), eq(payments.orderId, orderId)));

    const safeOrder = hasFullAccess
      ? order
      : {
          ...order,
          customerName: order.customerName.split(" ")[0] + " ***",
          customerEmail: maskEmail(order.customerEmail),
          customerPhone: maskPhone(order.customerPhone),
          shippingAddress: {
            county: (order.shippingAddress as any)?.county || "",
            subCounty: (order.shippingAddress as any)?.subCounty || "",
          },
        };

    return c.json({
      success: true,
      data: {
        ...safeOrder,
        items: itemsList,
        payments: paymentsList,
      },
    });
  }
);

// Merchant List Orders (Auth required)
ordersRouter.get("/", authMiddleware(true), requireRole(["OWNER", "ADMIN"]), async (c) => {
  const tenant = c.get("tenant")!;

  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);

  const query = c.req.query();
  const limit = Math.min(500, Math.max(1, parseInt(query.limit || "200", 10)));
  const page = Math.max(1, parseInt(query.page || "1", 10));
  const offset = (page - 1) * limit;

  const orderList = await db
    .select()
    .from(orders)
    .where(eq(orders.tenantId, tenant.id))
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.tenantId, tenant.id));

  const orderItemList = orderList.length
    ? await db
        .select()
        .from(orderItems)
        .where(
          and(
            eq(orderItems.tenantId, tenant.id),
            inArray(
              orderItems.orderId,
              orderList.map((order) => order.id)
            )
          )
        )
    : [];
  const orderItemsByOrder = new Map<string, typeof orderItemList>();
  for (const item of orderItemList) {
    const itemsForOrder = orderItemsByOrder.get(item.orderId) || [];
    itemsForOrder.push(item);
    orderItemsByOrder.set(item.orderId, itemsForOrder);
  }

  const formattedOrders = orderList.map((order) => ({
    ...order,
    items: orderItemsByOrder.get(order.id) || [],
  }));

  return c.json({
    success: true,
    data: formattedOrders,
    total: Number(count) || orderList.length,
    page,
    limit,
  });
});

// Merchant Delete Order (Only for orders that are not paid or not completed)
ordersRouter.delete(
  "/:id",
  authMiddleware(true),
  requireRole(["OWNER", "ADMIN"]),
  async (c) => {
    const tenant = c.get("tenant")!;
    const orderId = c.req.param("id");

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenant.id), eq(orders.id, orderId)))
      .limit(1);

    if (!order) {
      throw new AppError("Order not found.", 404, "ORDER_NOT_FOUND");
    }

    // Orders that are both paid and completed cannot be deleted
    if (order.paymentStatus === "PAID" && order.status === "COMPLETED") {
      throw new AppError("Completed and paid orders cannot be deleted.", 400, "CANNOT_DELETE_COMPLETED_PAID_ORDER");
    }

    // If inventory was deducted and order was not cancelled, restore inventory
    if (order.fulfillmentDetails?.inventoryDeducted === true && order.status !== "CANCELLED") {
      const lines = await db
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.orderId, order.id), eq(orderItems.tenantId, tenant.id)));
      for (const line of lines) {
        if (line.itemId) {
          if (line.variantId) {
            await db
              .update(itemVariants)
              .set({
                stockQuantity: sql`${itemVariants.stockQuantity} + ${line.quantity}`,
                updatedAt: new Date(),
              })
              .where(and(eq(itemVariants.id, line.variantId), eq(itemVariants.itemId, line.itemId)));
          } else {
            await db
              .update(items)
              .set({
                stockQuantity: sql`${items.stockQuantity} + ${line.quantity}`,
                updatedAt: new Date(),
              })
              .where(and(eq(items.id, line.itemId), eq(items.tenantId, tenant.id)));
          }
        }
      }
    }

    // Delete associated lines & payments, then delete the order
    await db
      .delete(orderItems)
      .where(and(eq(orderItems.orderId, order.id), eq(orderItems.tenantId, tenant.id)));
    await db
      .delete(payments)
      .where(and(eq(payments.orderId, order.id), eq(payments.tenantId, tenant.id)));
    await db
      .delete(orders)
      .where(and(eq(orders.id, order.id), eq(orders.tenantId, tenant.id)));

    return c.json({
      success: true,
      message: "Order deleted successfully",
    });
  }
);
