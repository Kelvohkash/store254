import { z } from "zod";
import { eq, and, inArray, gte, sql } from "drizzle-orm";
import type { AppEnv, UserContext } from "../../types/context";
import type { createDb } from "../../db";
import { orders, orderItems, payments } from "../../db/schema/orders";
import { items, itemVariants } from "../../db/schema/items";
import { tenantPaymentConfigs } from "../../db/schema/payment-configs";
import { generateUUID, generateSecureToken, hashOtp } from "../../security/crypto";
import { AppError } from "../../security/error-handler";
import {
  normalizeKenyanPhone,
  initiateMpesaStkPush,
  type MpesaCredentials,
} from "../../security/mpesa";
import { decryptPaymentConfig, encryptPaymentConfig } from "../../security/payment-credentials";
import { requireSecret } from "../../security/secrets";

export const checkoutItemSchema = z.object({
  itemId: z.string().trim().min(1).max(128),
  variantId: z.string().trim().min(1).max(128).optional(),
  quantity: z.number().int().positive().default(1),
});

export const serviceBookingDetailsSchema = z.object({
  bookingDate: z.string().optional(),
  timeSlot: z.string().optional(),
  serviceMode: z.enum(["IN_PERSON_SHOP", "ON_SITE_CLIENT", "VIRTUAL_ONLINE", "FLEXIBLE"]).optional(),
  serviceLocation: z.string().max(300).optional(),
  specialInstructions: z.string().max(500).optional(),
});

export const checkoutSchema = z.object({
  customerName: z.string().min(2).max(100),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(9).max(15),
  paymentMethod: z.enum(["MPESA", "CASH_ON_DELIVERY"]).default("MPESA"),
  deliveryAddress: z.string().trim().min(5).max(300).optional(),
  shippingAddress: z.record(z.unknown()).default({}),
  bookingDetails: serviceBookingDetailsSchema.optional(),
  items: z.array(checkoutItemSchema).min(1, "Cart cannot be empty"),
  notes: z.string().max(500).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export interface CheckoutTenantInfo {
  id: string;
  name: string;
  currency?: string | null;
}

export async function getDecryptedPaymentConfig(
  db: ReturnType<typeof createDb>,
  config: typeof tenantPaymentConfigs.$inferSelect,
  encryptionKey: string | undefined
) {
  const secret = requireSecret(encryptionKey, "PAYMENT_CONFIG_ENCRYPTION_KEY");
  const decrypted = await decryptPaymentConfig(config, secret);
  const values = [config.passkey, config.consumerKey, config.consumerSecret];
  if (values.some((value) => Boolean(value) && !value!.startsWith("enc:v1:"))) {
    const encrypted = await encryptPaymentConfig(config, secret);
    await db
      .update(tenantPaymentConfigs)
      .set({
        passkey: encrypted.passkey,
        consumerKey: encrypted.consumerKey,
        consumerSecret: encrypted.consumerSecret,
        updatedAt: new Date(),
      })
      .where(and(eq(tenantPaymentConfigs.id, config.id), eq(tenantPaymentConfigs.tenantId, config.tenantId)));
  }
  return decrypted;
}

export async function createOrderForTenant(
  db: ReturnType<typeof createDb>,
  env: AppEnv["Bindings"] | undefined,
  tenant: CheckoutTenantInfo,
  user: UserContext | null | undefined,
  body: CheckoutInput
) {
  // 1. Online payments require an enabled merchant gateway; COD does not.
  let paymentConfig: typeof tenantPaymentConfigs.$inferSelect | undefined;
  if (body.paymentMethod === "MPESA") {
    [paymentConfig] = await db
      .select()
      .from(tenantPaymentConfigs)
      .where(
        and(
          eq(tenantPaymentConfigs.tenantId, tenant.id),
          eq(tenantPaymentConfigs.provider, "MPESA")
        )
      )
      .limit(1);

    if (paymentConfig) {
      paymentConfig = await getDecryptedPaymentConfig(db, paymentConfig, env?.PAYMENT_CONFIG_ENCRYPTION_KEY);
    }

    if (!paymentConfig || !paymentConfig.isEnabled) {
      throw new AppError(
        "Online M-Pesa payment is currently not enabled for this store. You can switch to Cash on Delivery or contact the store owner.",
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
  }

  // 2. Normalize contact number, requiring a Kenyan M-Pesa number for STK Push.
  const normalizedPhone = normalizeKenyanPhone(body.customerPhone);
  if (body.paymentMethod === "MPESA" && !normalizedPhone) {
    throw new AppError(
      "Invalid Kenyan phone number for M-Pesa. Use formats like 0712345678, 0112345678, or 254712345678.",
      400,
      "INVALID_PHONE_NUMBER"
    );
  }
  const customerPhone = normalizedPhone || body.customerPhone.trim();

  // 3. Fetch requested catalog items for this tenant
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

  // 5. Separate Product vs Service rules, validate stock (products only) & delivery/booking rules
  let subtotal = 0;
  let hasPhysical = false;
  let hasService = false;
  const orderLineItemsToInsert: {
    id: string;
    itemId: string;
    itemType: string;
    trackInventory: boolean;
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

    const isService = dbItem.itemType === "SERVICE";
    const isPhysical = dbItem.itemType === "PHYSICAL";
    if (isService) {
      hasService = true;
      const serviceMeta = (dbItem.metadata as Record<string, any> | null)?.serviceConfig;
      if (serviceMeta && serviceMeta.available === false) {
        throw new AppError(`Service "${dbItem.title}" is currently paused for bookings.`, 400, "SERVICE_PAUSED");
      }
    } else if (isPhysical) {
      hasPhysical = true;
    }

    let unitPrice = dbItem.basePrice;
    let itemTitle = dbItem.title;
    let sku = dbItem.sku || undefined;
    let options: Record<string, unknown> = {
      ...((dbItem.attributes as Record<string, unknown>) || {}),
      itemType: dbItem.itemType,
    };

    if (cartItem.variantId) {
      const variant = variantMap.get(cartItem.variantId);
      if (!variant || variant.itemId !== dbItem.id) {
        throw new AppError(isService ? "Selected service package not found." : "Selected product variant not found.", 400, "VARIANT_NOT_FOUND");
      }
      unitPrice = variant.price;
      itemTitle = `${dbItem.title} - ${variant.title}`;
      sku = variant.sku || sku;
      options = {
        ...((variant.options as Record<string, unknown>) || {}),
        itemType: dbItem.itemType,
      };

      // Stock only applies to physical inventory — services never track stock
      if (isPhysical && dbItem.trackInventory && variant.stockQuantity < cartItem.quantity) {
        throw new AppError(
          `Insufficient stock for "${itemTitle}". Available: ${variant.stockQuantity}`,
          400,
          "INSUFFICIENT_STOCK"
        );
      }
    } else if (isPhysical && dbItem.trackInventory && dbItem.stockQuantity < cartItem.quantity) {
      throw new AppError(
        `Insufficient stock for "${itemTitle}". Available: ${dbItem.stockQuantity}`,
        400,
        "INSUFFICIENT_STOCK"
      );
    }

    const lineTotal = unitPrice * cartItem.quantity;
    subtotal += lineTotal;

    orderLineItemsToInsert.push({
      id: generateUUID(),
      itemId: dbItem.id,
      itemType: dbItem.itemType,
      trackInventory: isPhysical && Boolean(dbItem.trackInventory),
      variantId: cartItem.variantId,
      title: itemTitle,
      sku,
      unitPrice,
      quantity: cartItem.quantity,
      totalPrice: lineTotal,
      options,
    });
  }

  const isServiceOnly = hasService && !hasPhysical;

  if (hasPhysical && body.paymentMethod === "CASH_ON_DELIVERY" && !body.deliveryAddress) {
    throw new AppError(
      "A delivery address is required for pay on delivery.",
      400,
      "DELIVERY_ADDRESS_REQUIRED"
    );
  }

  if (
    isServiceOnly &&
    body.bookingDetails?.serviceMode === "ON_SITE_CLIENT" &&
    !(body.bookingDetails?.serviceLocation || body.deliveryAddress || "").trim()
  ) {
    throw new AppError(
      "Please provide a service location for your on-site appointment.",
      400,
      "SERVICE_LOCATION_REQUIRED"
    );
  }

  const shippingFee = 0;
  const totalAmount = Math.max(1, subtotal + shippingFee);
  const currency = tenant.currency || "KES";
  const orderKind = isServiceOnly ? "SERVICE_BOOKING" : hasService ? "MIXED" : "PRODUCT_ORDER";
  const shouldDeductInventoryNow = body.paymentMethod === "CASH_ON_DELIVERY" && orderLineItemsToInsert.some((l) => l.trackInventory);

  // 6. Insert Order
  const orderId = generateUUID();
  const orderNumber = `${isServiceOnly ? "BKG" : "ORD"}-${Date.now().toString().slice(-6)}`;

  await db.insert(orders).values({
    id: orderId,
    tenantId: tenant.id,
    orderNumber,
    customerId: user?.id || null,
    customerName: body.customerName,
    customerEmail: body.customerEmail.toLowerCase().trim(),
    customerPhone,
    shippingAddress: isServiceOnly
      ? {}
      : body.deliveryAddress
      ? { ...body.shippingAddress, address: body.deliveryAddress }
      : body.shippingAddress,
    bookingDetails: body.bookingDetails || {},
    currency,
    subtotal,
    shippingFee,
    totalAmount,
    status: body.paymentMethod === "CASH_ON_DELIVERY" ? "PROCESSING" : "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    paymentMethod: body.paymentMethod,
    fulfillmentDetails: {
      orderKind,
      ...(shouldDeductInventoryNow ? { inventoryDeducted: true } : {}),
    } as Record<string, unknown>,
    notes: body.notes || null,
  });

  // 7. Insert Order Items & deduct inventory ONLY for tracked physical items on COD orders
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

    if (body.paymentMethod === "CASH_ON_DELIVERY" && item.trackInventory) {
      if (item.variantId) {
        await db
          .update(itemVariants)
          .set({
            stockQuantity: sql`MAX(0, ${itemVariants.stockQuantity} - ${item.quantity})`,
          })
          .where(
            and(
              eq(itemVariants.id, item.variantId),
              eq(itemVariants.tenantId, tenant.id),
              gte(itemVariants.stockQuantity, item.quantity)
            )
          );
      } else {
        await db
          .update(items)
          .set({
            stockQuantity: sql`MAX(0, ${items.stockQuantity} - ${item.quantity})`,
          })
          .where(
            and(
              eq(items.id, item.itemId),
              eq(items.tenantId, tenant.id),
              gte(items.stockQuantity, item.quantity)
            )
          );
      }
    }
  }

  if (body.paymentMethod === "CASH_ON_DELIVERY") {
    return {
      message: isServiceOnly
        ? "Service booking confirmed. Please pay in person when your appointment is delivered."
        : "Order placed. Please pay the delivery person when your order arrives.",
      data: {
        orderId,
        orderNumber,
        orderKind,
        subtotal,
        totalAmount,
        currency,
        paymentMethod: body.paymentMethod,
        paymentStatus: "PENDING",
        status: "PROCESSING",
        customerMessage: isServiceOnly
          ? `Your booking is confirmed. Please pay ${currency} ${totalAmount.toLocaleString()} at your service appointment.`
          : `Your order is confirmed. Please pay ${currency} ${totalAmount.toLocaleString()} on delivery.`,
      },
    };
  }

  if (
    !paymentConfig?.consumerKey ||
    !paymentConfig.consumerSecret ||
    !paymentConfig.passkey ||
    !paymentConfig.shortcode
  ) {
    throw new AppError("M-Pesa payment configuration is unavailable.", 500, "PAYMENT_CONFIG_INCOMPLETE");
  }

  const merchantCreds: MpesaCredentials = {
    consumerKey: paymentConfig.consumerKey,
    consumerSecret: paymentConfig.consumerSecret,
    passkey: paymentConfig.passkey,
    shortcode: paymentConfig.shortcode,
    shortcodeType: paymentConfig.shortcodeType,
    isSandbox: paymentConfig.isSandbox,
  };

  const primaryDomain = env?.PRIMARY_DOMAIN || "store254.co.ke";
  const callbackToken = generateSecureToken();
  const statusToken = generateSecureToken();
  const callbackUrl = `https://${primaryDomain}/api/payments/mpesa/callback?token=${callbackToken}`;

  let checkoutRequestId = `mock_${generateUUID()}`;
  let merchantRequestId: string | null = null;
  let customerMessage = "Please enter your M-Pesa PIN on the prompt sent to your phone.";

  try {
    const stkResult = await initiateMpesaStkPush({
      credentials: merchantCreds,
      phoneNumber: customerPhone,
      amount: totalAmount,
      orderNumber,
      storeName: tenant.name,
      callbackUrl,
    });

    checkoutRequestId = stkResult.checkoutRequestId;
    merchantRequestId = stkResult.merchantRequestId;
    customerMessage = stkResult.customerMessage;
  } catch (err: any) {
    console.error("[Merchant M-Pesa STK Push Error]", err);
    customerMessage = `Failed to send M-Pesa prompt: ${err.message}. You can retry payment.`;
  }

  const paymentId = generateUUID();
  await db.insert(payments).values({
    id: paymentId,
    tenantId: tenant.id,
    orderId,
    paymentMethod: "MPESA",
    amount: totalAmount,
    currency,
    status: "INITIATED",
    merchantRequestId,
    phoneNumber: customerPhone,
    checkoutRequestId,
    callbackTokenHash: await hashOtp(callbackToken),
    statusTokenHash: await hashOtp(statusToken),
  });

  return {
    message: "Order placed. Awaiting M-Pesa payment confirmation.",
    data: {
      orderId,
      orderNumber,
      subtotal,
      totalAmount,
      currency,
      checkoutRequestId,
      paymentStatusToken: statusToken,
      customerMessage,
    },
  };
}
