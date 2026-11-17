import { Hono } from "hono";
import { eq, and, ne, sql } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { payments, orders, orderItems } from "../../db/schema/orders";
import { items, itemVariants } from "../../db/schema/items";
import { hashOtp, timingSafeEqual } from "../../security/crypto";
import { AppError } from "../../security/error-handler";
import { platformBillingPayments } from "../../db/schema/platform-billing";
import { tenants } from "../../db/schema/tenants";
import { users } from "../../db/schema/users";
import { EmailService } from "../../services/email.service";

export const mpesaRouter = new Hono<AppEnv>();

// Public Daraja callback for platform subscription payments. Each request has
// its own high-entropy capability and is reconciled against the exact amount.
mpesaRouter.post("/platform-callback", async (c) => {
  const token = c.req.query("token");
  if (!token || !c.env?.DB) return c.json({ ResultCode: 1, ResultDesc: "Unauthorized callback" }, 403);
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ResultCode: 1, ResultDesc: "Invalid JSON" }, 400);
  }
  const callback = body?.Body?.stkCallback;
  const checkoutRequestId = callback?.CheckoutRequestID;
  if (!callback || typeof checkoutRequestId !== "string") {
    return c.json({ ResultCode: 1, ResultDesc: "Missing STK callback" }, 400);
  }

  const db = createDb(c.env.DB);
  const [payment] = await db.select().from(platformBillingPayments)
    .where(eq(platformBillingPayments.checkoutRequestId, checkoutRequestId)).limit(1);
  if (!payment) return c.json({ ResultCode: 0, ResultDesc: "Payment request not found but acknowledged" });
  if (payment.status === "COMPLETED") return c.json({ ResultCode: 0, ResultDesc: "Already processed" });
  if (!timingSafeEqual(await hashOtp(token), payment.callbackTokenHash) ||
      (payment.merchantRequestId && callback.MerchantRequestID !== payment.merchantRequestId)) {
    return c.json({ ResultCode: 1, ResultDesc: "Unauthorized callback" }, 403);
  }

  const resultCode = Number(callback.ResultCode);
  if (resultCode !== 0 || !Array.isArray(callback.CallbackMetadata?.Item)) {
    await db.update(platformBillingPayments).set({
      status: "FAILED",
      resultCode: Number.isFinite(resultCode) ? resultCode : -1,
      resultDesc: String(callback.ResultDesc || "Payment cancelled or failed").slice(0, 500),
      updatedAt: new Date(),
    }).where(and(eq(platformBillingPayments.id, payment.id), eq(platformBillingPayments.status, "INITIATED")));
    return c.json({ ResultCode: 0, ResultDesc: "Payment failure recorded" });
  }

  const metadata = new Map<string, unknown>(callback.CallbackMetadata.Item.map((item: { Name: string; Value: unknown }) => [item.Name, item.Value]));
  const paidAmount = Number(metadata.get("Amount"));
  const receipt = String(metadata.get("MpesaReceiptNumber") || "");
  if (!Number.isFinite(paidAmount) || paidAmount !== payment.amount || !receipt) {
    await db.update(platformBillingPayments).set({
      status: "FAILED", resultCode: -1,
      resultDesc: "Payment amount or receipt mismatch; reconciliation required.", updatedAt: new Date(),
    }).where(and(eq(platformBillingPayments.id, payment.id), eq(platformBillingPayments.status, "INITIATED")));
    return c.json({ ResultCode: 0, ResultDesc: "Payment rejected for reconciliation" });
  }

  const paidAt = new Date();
  const updated = await db.update(platformBillingPayments).set({
    status: "COMPLETED", resultCode: 0, resultDesc: String(callback.ResultDesc || "Success").slice(0, 500),
    mpesaReceiptNumber: receipt, paidAt, updatedAt: paidAt,
  }).where(and(eq(platformBillingPayments.id, payment.id), eq(platformBillingPayments.status, "INITIATED")))
    .returning({ id: platformBillingPayments.id });
  if (!updated.length) return c.json({ ResultCode: 0, ResultDesc: "Already processed" });

  const [store] = await db.select().from(tenants).where(eq(tenants.id, payment.tenantId)).limit(1);
  if (store) {
    const dueBase = store.subscriptionDueAt && store.subscriptionDueAt.getTime() > paidAt.getTime()
      ? store.subscriptionDueAt.getTime()
      : paidAt.getTime();
    const dueDate = new Date(dueBase);
    const dayOfMonth = dueDate.getUTCDate();
    dueDate.setUTCDate(1);
    dueDate.setUTCMonth(dueDate.getUTCMonth() + payment.intervalMonths);
    const lastDayOfMonth = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth() + 1, 0)).getUTCDate();
    dueDate.setUTCDate(Math.min(dayOfMonth, lastDayOfMonth));
    const subscriptionDueAt = dueDate;
    await db.update(tenants).set({ status: "ACTIVE", subscriptionDueAt, updatedAt: paidAt }).where(eq(tenants.id, store.id));
    if (store.status === "SUSPENDED") {
      const [owner] = await db.select({ email: users.email }).from(users)
        .where(and(eq(users.tenantId, store.id), eq(users.role, "OWNER"))).limit(1);
      if (owner) {
        await EmailService.sendStoreActivated({
          to: owner.email, storeName: store.name, subdomain: store.subdomain,
          primaryDomain: c.env.PRIMARY_DOMAIN || "store254.co.ke",
          apiKey: c.env.RESEND_API_KEY,
          smtp: EmailService.smtpFromEnv(c.env),
        });
      }
    }
  }
  return c.json({ ResultCode: 0, ResultDesc: "Subscription payment recorded" });
});

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

  // 4. Handle Result Code (require explicit numeric 0 and array CallbackMetadata.Item)
  const resultCode =
    ResultCode === null ||
    ResultCode === undefined ||
    ResultCode === "" ||
    typeof ResultCode === "boolean"
      ? NaN
      : Number(ResultCode);

  if (resultCode === 0 && Array.isArray(CallbackMetadata?.Item)) {
    // Payment Successful
    const metadataMap = new Map<string, any>();
    for (const item of CallbackMetadata.Item) {
      if (item && typeof item === "object" && "Name" in item) {
        metadataMap.set(String((item as { Name: unknown }).Name), (item as { Value?: unknown }).Value);
      }
    }

    const paidAmount = Number(metadataMap.get("Amount"));
    const receiptNumber = String(metadataMap.get("MpesaReceiptNumber") || "").trim();
    const phoneNumber = String(metadataMap.get("PhoneNumber") || "").trim();

    // Reject malformed amounts, underpayments (paidAmount < expected), or missing receipt numbers.
    if (!Number.isFinite(paidAmount) || paidAmount < paymentRecord.amount || !receiptNumber) {
      console.error("[M-Pesa Callback Rejected] Amount or receipt validation failed.", {
        paymentId: paymentRecord.id,
        expectedAmount: paymentRecord.amount,
        receivedAmount: paidAmount,
      });
      const rejected = await db
        .update(payments)
        .set({
          status: "FAILED",
          resultCode: -1,
          resultDesc: "Payment amount or receipt mismatch",
          rawCallback: stkCallback,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(payments.id, paymentRecord.id),
            eq(payments.tenantId, paymentRecord.tenantId),
            eq(payments.status, "INITIATED")
          )
        )
        .returning({ id: payments.id });
      if (rejected.length) {
        await db
          .update(orders)
          .set({ paymentStatus: "FAILED", updatedAt: new Date() })
          .where(
            and(
              eq(orders.id, paymentRecord.orderId),
              eq(orders.tenantId, paymentRecord.tenantId),
              eq(orders.paymentStatus, "PENDING")
            )
          );
      }
      return c.json({ ResultCode: 0, ResultDesc: "Payment rejected for reconciliation" });
    }

    // Enforce unique M-Pesa receipt check before completing payment
    const [duplicateReceipt] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.mpesaReceiptNumber, receiptNumber))
      .limit(1);

    if (duplicateReceipt) {
      if (duplicateReceipt.id === paymentRecord.id) {
        return c.json({ ResultCode: 0, ResultDesc: "Already processed" });
      }
      console.error("[M-Pesa Callback Rejected] Duplicate M-Pesa receipt replay detected.", {
        paymentId: paymentRecord.id,
        existingPaymentId: duplicateReceipt.id,
      });
      await db
        .update(payments)
        .set({
          status: "FAILED",
          resultCode: -1,
          resultDesc: "Duplicate M-Pesa receipt number",
          rawCallback: stkCallback,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(payments.id, paymentRecord.id),
            eq(payments.tenantId, paymentRecord.tenantId),
            eq(payments.status, "INITIATED")
          )
        );
      return c.json({ ResultCode: 0, ResultDesc: "Duplicate receipt rejected" });
    }

    // Update Payment (DB unique partial index also guards against concurrent replay)
    let updatedPayment: { id: string }[] = [];
    try {
      updatedPayment = await db
        .update(payments)
        .set({
          status: "COMPLETED",
          mpesaReceiptNumber: receiptNumber,
          phoneNumber: phoneNumber || paymentRecord.phoneNumber,
          resultCode: 0,
          resultDesc: String(ResultDesc || "Success").slice(0, 500),
          rawCallback: stkCallback,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(payments.id, paymentRecord.id),
            eq(payments.tenantId, paymentRecord.tenantId),
            eq(payments.status, "INITIATED")
          )
        )
        .returning({ id: payments.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/unique/i.test(msg)) {
        await db
          .update(payments)
          .set({
            status: "FAILED",
            resultCode: -1,
            resultDesc: "Duplicate M-Pesa receipt number",
            rawCallback: stkCallback,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(payments.id, paymentRecord.id),
              eq(payments.tenantId, paymentRecord.tenantId),
              eq(payments.status, "INITIATED")
            )
          );
        return c.json({ ResultCode: 0, ResultDesc: "Duplicate receipt rejected" });
      }
      throw err;
    }

    if (!updatedPayment.length) return c.json({ ResultCode: 0, ResultDesc: "Already processed" });

    // Keep shipment/delivery state for COD orders; only update their payment state.
    const [order] = await db
      .select({
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        fulfillmentDetails: orders.fulfillmentDetails,
      })
      .from(orders)
      .where(and(eq(orders.id, paymentRecord.orderId), eq(orders.tenantId, paymentRecord.tenantId)))
      .limit(1);

    if (!order || order.status === "CANCELLED") {
      return c.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const paidOrder = await db
      .update(orders)
      .set({
        status:
          order.paymentMethod === "CASH_ON_DELIVERY" &&
          ["SHIPPED", "COMPLETED"].includes(order.status)
            ? order.status
            : "PAID",
        paymentStatus: "PAID",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orders.id, paymentRecord.orderId),
          eq(orders.tenantId, paymentRecord.tenantId),
          eq(orders.paymentStatus, "PENDING"),
          ne(orders.status, "CANCELLED")
        )
      )
      .returning({ id: orders.id });

    // Atomically claim inventory deduction once when transitioning to PAID
    if (paidOrder.length) {
      const claimedDeduction = await db
        .update(orders)
        .set({
          inventoryDeducted: true,
          fulfillmentDetails: {
            ...(order.fulfillmentDetails || {}),
            inventoryDeducted: true,
          },
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(orders.id, paymentRecord.orderId),
            eq(orders.tenantId, paymentRecord.tenantId),
            eq(orders.inventoryDeducted, false)
          )
        )
        .returning({ id: orders.id });

      if (claimedDeduction.length) {
        const orderLines = await db
          .select()
          .from(orderItems)
          .where(and(eq(orderItems.orderId, paymentRecord.orderId), eq(orderItems.tenantId, paymentRecord.tenantId)));

        for (const line of orderLines) {
          if (!line.itemId) continue;
          const [itemMeta] = await db
            .select({ itemType: items.itemType, trackInventory: items.trackInventory })
            .from(items)
            .where(and(eq(items.id, line.itemId), eq(items.tenantId, paymentRecord.tenantId)))
            .limit(1);
          if (!itemMeta || itemMeta.itemType !== "PHYSICAL" || !itemMeta.trackInventory) {
            continue;
          }
          if (line.variantId) {
            await db
              .update(itemVariants)
              .set({
                stockQuantity: sql`MAX(0, ${itemVariants.stockQuantity} - ${line.quantity})`,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(itemVariants.id, line.variantId),
                  eq(itemVariants.itemId, line.itemId),
                  eq(itemVariants.tenantId, paymentRecord.tenantId)
                )
              );
          } else {
            await db
              .update(items)
              .set({
                stockQuantity: sql`MAX(0, ${items.stockQuantity} - ${line.quantity})`,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(items.id, line.itemId),
                  eq(items.tenantId, paymentRecord.tenantId),
                  eq(items.trackInventory, true)
                )
              );
          }
        }
      }
    }
  } else {
    // Payment Cancelled, Timed out, Insufficient Funds, or Malformed CallbackMetadata
    const recordedCode = Number.isFinite(resultCode) && resultCode !== 0 ? resultCode : -1;
    const recordedDesc =
      resultCode === 0
        ? "Malformed callback metadata"
        : String(ResultDesc || "Payment cancelled or failed").slice(0, 500);

    const failedPayment = await db
      .update(payments)
      .set({
        status: "FAILED",
        resultCode: recordedCode,
        resultDesc: recordedDesc,
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
