import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, inArray } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { orders, orderItems, payments } from "../../db/schema/orders";
import { items, itemVariants } from "../../db/schema/items";
import { promotions } from "../../db/schema/offers";
import { tenantPaymentConfigs } from "../../db/schema/payment-configs";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware";
import { generateUUID } from "../../security/crypto";
import { AppError } from "../../security/error-handler";
import {
  normalizeKenyanPhone,
  initiateMpesaStkPush,
  type MpesaCredentials,
} from "../../security/mpesa";

export const ordersRouter = new Hono<AppEnv>();

const checkoutItemSchema = z.object({
  itemId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().positive().default(1),
});

const checkoutSchema = z.object({
  customerName: z.string().min(2).max(100),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(9).max(15),
  shippingAddress: z.record(z.unknown()).default({}),
  items: z.array(checkoutItemSchema).min(1, "Cart cannot be empty"),
  couponCode: z.string().optional(),
  notes: z.string().max(500).optional(),
});

// Create Order & Trigger Merchant's M-Pesa STK Push
ordersRouter.post("/checkout", zValidator("json", checkoutSchema), async (c) => {
  const tenant = c.get("tenant")!;
  const body = c.req.valid("json");
  const db = createDb(c.env.DB);

  // 1. Check Merchant's Payment Configuration (DISABLED by default)
  const [paymentConfig] = await db
    .select()
    .from(tenantPaymentConfigs)
    .where(
      and(
        eq(tenantPaymentConfigs.tenantId, tenant.id),
        eq(tenantPaymentConfigs.provider, "MPESA")
      )
    )
    .limit(1);

  if (!paymentConfig || !paymentConfig.isEnabled) {
    throw new AppError(
      "Online M-Pesa payment is currently not enabled for this store. Please contact the store owner.",
      400,
      "PAYMENT_METHOD_DISABLED"
    );
  }

  if (
    !paymentConfig.shortcode ||
    !paymentConfig.passkey ||
    !paymentConfig.consumerKey ||
    !paymentConfig.consumerSecret
  ) {
    throw new AppError(
      "Store payment gateway is misconfigured. Please contact store support.",
      500,
      "PAYMENT_CONFIG_INCOMPLETE"
    );
  }

  // 2. Validate and normalize Kenyan M-Pesa phone number
  const mpesaPhone = normalizeKenyanPhone(body.customerPhone);
  if (!mpesaPhone) {
    throw new AppError(
      "Invalid Kenyan phone number for M-Pesa. Use formats like 0712345678, 0112345678, or 254712345678.",
      400,
      "INVALID_PHONE_NUMBER"
    );
  }

  // 3. Fetch all requested catalog items
  const itemIds = body.items.map((i) => i.itemId);
  const dbItems = await db
    .select()
    .from(items)
    .where(and(eq(items.tenantId, tenant.id), inArray(items.id, itemIds)));

  const itemMap = new Map(dbItems.map((i) => [i.id, i]));

  // 4. Fetch variants if needed
  const variantIds = body.items.map((i) => i.variantId).filter(Boolean) as string[];
  const dbVariants =
    variantIds.length > 0
      ? await db
          .select()
          .from(itemVariants)
          .where(and(eq(itemVariants.tenantId, tenant.id), inArray(itemVariants.id, variantIds)))
      : [];
  const variantMap = new Map(dbVariants.map((v) => [v.id, v]));

  // 5. Validate stock & calculate subtotal
  let subtotal = 0;
  const orderLineItemsToInsert: {
    id: string;
    itemId: string;
    variantId?: string;
    title: string;
    sku?: string;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    options: Record<string, unknown>;
  }[] = [];

  for (const cartItem of body.items) {
    const dbItem = itemMap.get(cartItem.itemId);
    if (!dbItem || dbItem.status !== "PUBLISHED") {
      throw new AppError(`Item "${cartItem.itemId}" is unavailable.`, 400, "ITEM_UNAVAILABLE");
    }

    let unitPrice = dbItem.basePrice;
    let itemTitle = dbItem.title;
    let sku = dbItem.sku || undefined;
    let options: Record<string, unknown> = (dbItem.attributes as Record<string, unknown>) || {};

    if (cartItem.variantId) {
      const variant = variantMap.get(cartItem.variantId);
      if (!variant) {
        throw new AppError("Selected product variant not found.", 400, "VARIANT_NOT_FOUND");
      }
      unitPrice = variant.price;
      itemTitle = `${dbItem.title} - ${variant.title}`;
      sku = variant.sku || sku;
      options = variant.options as Record<string, unknown>;

      if (dbItem.trackInventory && variant.stockQuantity < cartItem.quantity) {
        throw new AppError(
          `Insufficient stock for "${itemTitle}". Available: ${variant.stockQuantity}`,
          400,
          "INSUFFICIENT_STOCK"
        );
      }
    } else {
      if (dbItem.trackInventory && dbItem.stockQuantity < cartItem.quantity) {
        throw new AppError(
          `Insufficient stock for "${itemTitle}". Available: ${dbItem.stockQuantity}`,
          400,
          "INSUFFICIENT_STOCK"
        );
      }
    }

    const lineTotal = unitPrice * cartItem.quantity;
    subtotal += lineTotal;

    orderLineItemsToInsert.push({
      id: generateUUID(),
      itemId: dbItem.id,
      variantId: cartItem.variantId,
      title: itemTitle,
      sku,
      unitPrice,
      quantity: cartItem.quantity,
      totalPrice: lineTotal,
      options,
    });
  }

  // 6. Evaluate Coupon / Promotion discount
  let discountAmount = 0;
  let appliedCouponCode: string | null = null;

  if (body.couponCode) {
    const code = body.couponCode.trim().toUpperCase();
    const now = new Date();

    const [promo] = await db
      .select()
      .from(promotions)
      .where(and(eq(promotions.tenantId, tenant.id), eq(promotions.code, code)))
      .limit(1);

    if (
      promo &&
      promo.isActive &&
      promo.startsAt <= now &&
      (!promo.endsAt || promo.endsAt >= now) &&
      (!promo.usageLimit || promo.usageCount < promo.usageLimit) &&
      subtotal >= promo.minOrderAmount
    ) {
      appliedCouponCode = code;
      if (promo.discountType === "PERCENTAGE") {
        discountAmount = Math.round((subtotal * promo.discountValue) / 100);
        if (promo.maxDiscountAmount && discountAmount > promo.maxDiscountAmount) {
          discountAmount = promo.maxDiscountAmount;
        }
      } else if (promo.discountType === "FIXED_AMOUNT") {
        discountAmount = Math.min(subtotal, promo.discountValue);
      }
    }
  }

  const shippingFee = 0;
  const totalAmount = Math.max(1, subtotal - discountAmount + shippingFee);

  // 7. Insert Order
  const orderId = generateUUID();
  const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

  await db.insert(orders).values({
    id: orderId,
    tenantId: tenant.id,
    orderNumber,
    customerId: null,
    customerName: body.customerName,
    customerEmail: body.customerEmail.toLowerCase().trim(),
    customerPhone: mpesaPhone,
    shippingAddress: body.shippingAddress,
    currency: tenant.currency || "KES",
    subtotal,
    discountAmount,
    shippingFee,
    totalAmount,
    couponCode: appliedCouponCode,
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    paymentMethod: "MPESA",
    notes: body.notes || null,
  });

  // 8. Insert Order Items
  for (const item of orderLineItemsToInsert) {
    await db.insert(orderItems).values({
      id: item.id,
      tenantId: tenant.id,
      orderId,
      itemId: item.itemId,
      variantId: item.variantId || null,
      title: item.title,
      sku: item.sku || null,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      options: item.options,
    });
  }

  // 9. Prepare Merchant Credentials
  const merchantCreds: MpesaCredentials = {
    consumerKey: paymentConfig.consumerKey,
    consumerSecret: paymentConfig.consumerSecret,
    passkey: paymentConfig.passkey,
    shortcode: paymentConfig.shortcode,
    shortcodeType: paymentConfig.shortcodeType,
    isSandbox: paymentConfig.isSandbox,
  };

  const primaryDomain = c.env.PRIMARY_DOMAIN || "store254.co.ke";
  const callbackSecret = c.env.MPESA_CALLBACK_SECRET || "dev-callback-secret";
  const callbackUrl = `https://${primaryDomain}/api/payments/mpesa/callback?token=${callbackSecret}`;

  // 10. Trigger Live STK Push with Merchant's own Till / Paybill
  let checkoutRequestId = `mock_${generateUUID()}`;
  let customerMessage = "Please enter your M-Pesa PIN on the prompt sent to your phone.";

  try {
    const stkResult = await initiateMpesaStkPush({
      credentials: merchantCreds,
      phoneNumber: mpesaPhone,
      amount: totalAmount,
      orderNumber,
      storeName: tenant.name,
      callbackUrl,
    });

    checkoutRequestId = stkResult.checkoutRequestId;
    customerMessage = stkResult.customerMessage;
  } catch (err: any) {
    console.error("[Merchant M-Pesa STK Push Error]", err);
    customerMessage = `Failed to send M-Pesa prompt: ${err.message}. You can retry payment.`;
  }

  // 11. Record payment transaction
  const paymentId = generateUUID();
  await db.insert(payments).values({
    id: paymentId,
    tenantId: tenant.id,
    orderId,
    paymentMethod: "MPESA",
    amount: totalAmount,
    currency: tenant.currency || "KES",
    status: "INITIATED",
    phoneNumber: mpesaPhone,
    checkoutRequestId,
  });

  return c.json(
    {
      success: true,
      message: "Order placed. Awaiting M-Pesa payment confirmation.",
      data: {
        orderId,
        orderNumber,
        subtotal,
        discountAmount,
        totalAmount,
        currency: tenant.currency || "KES",
        checkoutRequestId,
        customerMessage,
      },
    },
    201
  );
});

// Get Order Details
ordersRouter.get("/:id", async (c) => {
  const tenant = c.get("tenant")!;
  const orderId = c.req.param("id");
  const db = createDb(c.env.DB);

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.tenantId, tenant.id), eq(orders.id, orderId)))
    .limit(1);

  if (!order) {
    throw new AppError("Order not found.", 404, "ORDER_NOT_FOUND");
  }

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

  return c.json({
    success: true,
    data: {
      ...order,
      items: itemsList,
      payments: paymentsList,
    },
  });
});

// Merchant List Orders (Auth required)
ordersRouter.get("/", authMiddleware(true), requireRole(["OWNER", "ADMIN"]), async (c) => {
  const tenant = c.get("tenant")!;
  const db = createDb(c.env.DB);

  const orderList = await db
    .select()
    .from(orders)
    .where(eq(orders.tenantId, tenant.id))
    .orderBy(desc(orders.createdAt))
    .limit(50);

  return c.json({
    success: true,
    data: orderList,
  });
});
