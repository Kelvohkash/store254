import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { payments, orders, orderItems } from "../../db/schema/orders";
import { items, itemVariants } from "../../db/schema/items";
import { hashOtp, timingSafeEqual } from "../../security/crypto";
import { AppError } from "../../security/error-handler";

export const mpesaRouter = new Hono<AppEnv>();

/**
 * Safaricom STK Push Server-to-Server Callback
 * Public webhook authenticated by a high-entropy, per-payment capability.
 */
mpesaRouter.post("/callback", async (c) => {
  const token = c.req.query("token");
  if (!token) {
    console.warn("[M-Pesa Callback Rejected] Missing per-payment capability token.");
    return c.json({ ResultCode: 1, ResultDesc: "Unauthorized callback" }, 403);
  }

  if (!c.env?.DB) {
    return c.json({ ResultCode: 1, ResultDesc: "DB not ready" }, 500);
  }

  const db = createDb(c.env.DB);
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ResultCode: 1, ResultDesc: "Invalid JSON" }, 400);
  }

  const stkCallback = body?.Body?.stkCallback;
  if (!stkCallback) {
    return c.json({ ResultCode: 1, ResultDesc: "Missing stkCallback body" }, 400);
  }

  const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } =
    stkCallback;
  if (typeof CheckoutRequestID !== "string" || !CheckoutRequestID) {
    return c.json({ ResultCode: 1, ResultDesc: "Missing CheckoutRequestID" }, 400);
  }

  // 2. Lookup Payment Record by CheckoutRequestID
  const [paymentRecord] = await db
    .select()
    .from(payments)
    .where(eq(payments.checkoutRequestId, CheckoutRequestID))
    .limit(1);

  if (!paymentRecord) {
    console.warn(`[M-Pesa Callback] No payment found for CheckoutRequestID: ${CheckoutRequestID}`);
    // Acknowledge Safaricom to stop retries
    return c.json({ ResultCode: 0, ResultDesc: "Payment record not found but acknowledged" });
  }

  // Already-final callbacks are harmless retries; never allow a retry to mutate state.
  if (paymentRecord.status === "COMPLETED") {
    return c.json({ ResultCode: 0, ResultDesc: "Already processed" });
  }

  if (!paymentRecord.callbackTokenHash ||
      !timingSafeEqual(await hashOtp(token), paymentRecord.callbackTokenHash)) {
    console.warn("[M-Pesa Callback Rejected] Invalid or missing per-payment capability.");
    return c.json({ ResultCode: 1, ResultDesc: "Unauthorized callback" }, 403);
  }
  if (paymentRecord.merchantRequestId && MerchantRequestID !== paymentRecord.merchantRequestId) {
    return c.json({ ResultCode: 1, ResultDesc: "Request ID mismatch" }, 403);
  }

  // 4. Handle Result Code
  if (ResultCode === 0 && CallbackMetadata?.Item) {
    // Payment Successful
    const metadataItems: { Name: string; Value: any }[] = CallbackMetadata.Item;
    const metadataMap = new Map<string, any>();
    for (const item of metadataItems) {
      metadataMap.set(item.Name, item.Value);
    }

    const paidAmount = Number(metadataMap.get("Amount"));
    const receiptNumber = String(metadataMap.get("MpesaReceiptNumber") || "");
    const phoneNumber = String(metadataMap.get("PhoneNumber") || "");

    // Any underpayment, overpayment, or malformed amount must remain unpaid.
    if (!Number.isFinite(paidAmount) || paidAmount !== paymentRecord.amount || !receiptNumber) {
      console.error("[M-Pesa Callback Rejected] Amount or receipt validation failed.", {
        paymentId: paymentRecord.id,
        expectedAmount: paymentRecord.amount,
        receivedAmount: paidAmount,
      });
      const rejected = await db.update(payments).set({
        status: "FAILED", resultCode: -1, resultDesc: "Payment amount or receipt mismatch",
        rawCallback: stkCallback, updatedAt: new Date(),
      }).where(and(eq(payments.id, paymentRecord.id), eq(payments.tenantId, paymentRecord.tenantId), eq(payments.status, "INITIATED")))
        .returning({ id: payments.id });
      if (rejected.length) {
        await db.update(orders).set({ paymentStatus: "FAILED", updatedAt: new Date() }).where(and(
          eq(orders.id, paymentRecord.orderId),
          eq(orders.tenantId, paymentRecord.tenantId),
          eq(orders.paymentStatus, "PENDING")
        ));
      }
      return c.json({ ResultCode: 0, ResultDesc: "Payment rejected for reconciliation" });
    }

    // Update Payment
    const updatedPayment = await db
      .update(payments)
      .set({
        status: "COMPLETED",
        mpesaReceiptNumber: receiptNumber,
        phoneNumber: phoneNumber || paymentRecord.phoneNumber,
        resultCode: 0,
        resultDesc: ResultDesc || "Success",
        rawCallback: stkCallback,
        updatedAt: new Date(),
      })
      .where(and(eq(payments.id, paymentRecord.id), eq(payments.tenantId, paymentRecord.tenantId), eq(payments.status, "INITIATED")))
      .returning({ id: payments.id });
    if (!updatedPayment.length) return c.json({ ResultCode: 0, ResultDesc: "Already processed" });

    // Keep shipment/delivery state for COD orders; only update their payment state.
    const [order] = await db
      .select({ status: orders.status, paymentMethod: orders.paymentMethod })
      .from(orders)
      .where(and(eq(orders.id, paymentRecord.orderId), eq(orders.tenantId, paymentRecord.tenantId)))
      .limit(1);

    const paidOrder = await db
      .update(orders)
      .set({
        status:
          order?.paymentMethod === "CASH_ON_DELIVERY" &&
          ["SHIPPED", "COMPLETED"].includes(order.status)
            ? order.status
            : "PAID",
        paymentStatus: "PAID",
        updatedAt: new Date(),
      })
      .where(and(
        eq(orders.id, paymentRecord.orderId),
        eq(orders.tenantId, paymentRecord.tenantId),
        eq(orders.paymentStatus, "PENDING")
      ))
      .returning({ id: orders.id });

    // Deduct inventory once, only when this callback made the order paid.
    if (paidOrder.length) {
    const orderLines = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, paymentRecord.orderId), eq(orderItems.tenantId, paymentRecord.tenantId)));

    for (const line of orderLines) {
      if (line.variantId) {
        const [v] = await db
          .select({ stock: itemVariants.stockQuantity })
          .from(itemVariants)
          .where(and(eq(itemVariants.id, line.variantId), eq(itemVariants.tenantId, paymentRecord.tenantId)))
          .limit(1);
        if (v) {
          await db
            .update(itemVariants)
            .set({ stockQuantity: Math.max(0, v.stock - line.quantity) })
            .where(and(eq(itemVariants.id, line.variantId), eq(itemVariants.tenantId, paymentRecord.tenantId)));
        }
      } else if (line.itemId) {
        const [i] = await db
          .select({ stock: items.stockQuantity })
          .from(items)
          .where(and(eq(items.id, line.itemId), eq(items.tenantId, paymentRecord.tenantId)))
          .limit(1);
        if (i) {
          await db
            .update(items)
            .set({ stockQuantity: Math.max(0, i.stock - line.quantity) })
            .where(and(eq(items.id, line.itemId), eq(items.tenantId, paymentRecord.tenantId)));
        }
      }
    }
    }
  } else {
    // Payment Cancelled, Timed out, or Insufficient Funds
    const failedPayment = await db
      .update(payments)
      .set({
        status: "FAILED",
        resultCode: ResultCode,
        resultDesc: ResultDesc || "Payment cancelled or failed",
        rawCallback: stkCallback,
        updatedAt: new Date(),
      })
      .where(and(eq(payments.id, paymentRecord.id), eq(payments.tenantId, paymentRecord.tenantId), eq(payments.status, "INITIATED")))
      .returning({ id: payments.id });

    if (failedPayment.length) {
      await db
        .update(orders)
        .set({ paymentStatus: "FAILED", updatedAt: new Date() })
        .where(and(
          eq(orders.id, paymentRecord.orderId),
          eq(orders.tenantId, paymentRecord.tenantId),
          eq(orders.paymentStatus, "PENDING")
        ));
    }
  }

  return c.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// Status requires a separate high-entropy capability returned at checkout. It never polls Daraja.
mpesaRouter.get("/status/:checkoutRequestId", async (c) => {
  const checkoutRequestId = c.req.param("checkoutRequestId");
  if (!c.env?.DB) {
    throw new AppError("DB not ready", 500);
  }
  const db = createDb(c.env.DB);

  const [paymentRecord] = await db
    .select({
      id: payments.id,
      status: payments.status,
      mpesaReceiptNumber: payments.mpesaReceiptNumber,
      statusTokenHash: payments.statusTokenHash,
    })
    .from(payments)
    .where(eq(payments.checkoutRequestId, checkoutRequestId))
    .limit(1);

  if (!paymentRecord) {
    throw new AppError("Transaction not found.", 404, "TRANSACTION_NOT_FOUND");
  }
  const presented = c.req.header("x-payment-status-token");
  if (!presented || !paymentRecord.statusTokenHash ||
      !timingSafeEqual(await hashOtp(presented), paymentRecord.statusTokenHash)) {
    throw new AppError("Transaction not found.", 404, "TRANSACTION_NOT_FOUND");
  }

  return c.json({
    success: true,
    data: {
      status: paymentRecord.status,
      mpesaReceiptNumber: paymentRecord.mpesaReceiptNumber,
    },
  });
});
