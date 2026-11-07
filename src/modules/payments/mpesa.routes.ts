import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { payments, orders, orderItems } from "../../db/schema/orders";
import { items, itemVariants } from "../../db/schema/items";
import { tenantPaymentConfigs } from "../../db/schema/payment-configs";
import { verifyCallbackToken, queryMpesaStkStatus } from "../../security/mpesa";
import { AppError } from "../../security/error-handler";

export const mpesaRouter = new Hono<AppEnv>();

/**
 * Safaricom STK Push Server-to-Server Callback
 * Public Webhook: Secured by HMAC Callback Secret Token
 */
mpesaRouter.post("/callback", async (c) => {
  const token = c.req.query("token");
  const expectedSecret = c.env?.MPESA_CALLBACK_SECRET || "dev-callback-secret";

  // 1. Strict Token Verification
  if (!verifyCallbackToken(token, expectedSecret)) {
    console.warn("[M-Pesa Callback Rejected] Invalid or missing security token.");
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

  // 3. Idempotency Check: Don't process twice if already marked completed
  if (paymentRecord.status === "COMPLETED") {
    return c.json({ ResultCode: 0, ResultDesc: "Already processed" });
  }

  // 4. Handle Result Code
  if (ResultCode === 0 && CallbackMetadata?.Item) {
    // Payment Successful
    const metadataItems: { Name: string; Value: any }[] = CallbackMetadata.Item;
    const metadataMap = new Map<string, any>();
    for (const item of metadataItems) {
      metadataMap.set(item.Name, item.Value);
    }

    const paidAmount = Number(metadataMap.get("Amount") || 0);
    const receiptNumber = String(metadataMap.get("MpesaReceiptNumber") || "");
    const transactionDateRaw = String(metadataMap.get("TransactionDate") || "");
    const phoneNumber = String(metadataMap.get("PhoneNumber") || "");

    // Verify Amount matches
    if (paidAmount < paymentRecord.amount) {
      console.error(
        `[Fraud Warning] Amount mismatch! Expected ${paymentRecord.amount}, received ${paidAmount}`
      );
    }

    // Update Payment
    await db
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
      .where(eq(payments.id, paymentRecord.id));

    // Update Order to PAID
    await db
      .update(orders)
      .set({
        status: "PAID",
        paymentStatus: "PAID",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, paymentRecord.orderId));

    // Deduct physical inventory
    const orderLines = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, paymentRecord.orderId));

    for (const line of orderLines) {
      if (line.variantId) {
        const [v] = await db
          .select({ stock: itemVariants.stockQuantity })
          .from(itemVariants)
          .where(eq(itemVariants.id, line.variantId))
          .limit(1);
        if (v) {
          await db
            .update(itemVariants)
            .set({ stockQuantity: Math.max(0, v.stock - line.quantity) })
            .where(eq(itemVariants.id, line.variantId));
        }
      } else if (line.itemId) {
        const [i] = await db
          .select({ stock: items.stockQuantity })
          .from(items)
          .where(eq(items.id, line.itemId))
          .limit(1);
        if (i) {
          await db
            .update(items)
            .set({ stockQuantity: Math.max(0, i.stock - line.quantity) })
            .where(eq(items.id, line.itemId));
        }
      }
    }
  } else {
    // Payment Cancelled, Timed out, or Insufficient Funds
    await db
      .update(payments)
      .set({
        status: "FAILED",
        resultCode: ResultCode,
        resultDesc: ResultDesc || "Payment cancelled or failed",
        rawCallback: stkCallback,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentRecord.id));

    await db
      .update(orders)
      .set({
        paymentStatus: "FAILED",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, paymentRecord.orderId));
  }

  return c.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// Polling Endpoint for Frontend Checkout Screen
mpesaRouter.get("/status/:checkoutRequestId", async (c) => {
  const checkoutRequestId = c.req.param("checkoutRequestId");
  if (!c.env?.DB) {
    throw new AppError("DB not ready", 500);
  }
  const db = createDb(c.env.DB);

  const [paymentRecord] = await db
    .select({
      id: payments.id,
      tenantId: payments.tenantId,
      orderId: payments.orderId,
      status: payments.status,
      amount: payments.amount,
      mpesaReceiptNumber: payments.mpesaReceiptNumber,
      resultCode: payments.resultCode,
      resultDesc: payments.resultDesc,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(eq(payments.checkoutRequestId, checkoutRequestId))
    .limit(1);

  if (!paymentRecord) {
    throw new AppError("Transaction not found.", 404, "TRANSACTION_NOT_FOUND");
  }

  // If still INITIATED and more than 15 seconds have passed, query Safaricom actively
  const elapsedMs = Date.now() - new Date(paymentRecord.createdAt).getTime();
  if (paymentRecord.status === "INITIATED" && elapsedMs > 15_000) {
    const [config] = await db
      .select()
      .from(tenantPaymentConfigs)
      .where(
        and(
          eq(tenantPaymentConfigs.tenantId, paymentRecord.tenantId),
          eq(tenantPaymentConfigs.provider, "MPESA")
        )
      )
      .limit(1);

    if (config?.consumerKey && config?.consumerSecret && config?.passkey && config?.shortcode) {
      try {
        const queryRes = await queryMpesaStkStatus(checkoutRequestId, {
          consumerKey: config.consumerKey,
          consumerSecret: config.consumerSecret,
          passkey: config.passkey,
          shortcode: config.shortcode,
          isSandbox: config.isSandbox,
        });

        if (queryRes.resultCode === "0") {
          // Reconcile as COMPLETED
          await db
            .update(payments)
            .set({ status: "COMPLETED", resultCode: 0, updatedAt: new Date() })
            .where(eq(payments.id, paymentRecord.id));

          await db
            .update(orders)
            .set({ status: "PAID", paymentStatus: "PAID", updatedAt: new Date() })
            .where(eq(orders.id, paymentRecord.orderId));

          return c.json({
            success: true,
            data: {
              status: "COMPLETED",
              orderId: paymentRecord.orderId,
              amount: paymentRecord.amount,
              mpesaReceiptNumber: paymentRecord.mpesaReceiptNumber,
            },
          });
        }
      } catch {
        // Query failed; leave in current status
      }
    }
  }

  return c.json({
    success: true,
    data: {
      status: paymentRecord.status,
      orderId: paymentRecord.orderId,
      amount: paymentRecord.amount,
      mpesaReceiptNumber: paymentRecord.mpesaReceiptNumber,
      resultCode: paymentRecord.resultCode,
      resultDesc: paymentRecord.resultDesc,
    },
  });
});
