import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, gt } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { platformBillingPayments, platformBillingSettings } from "../../db/schema/platform-billing";
import { tenants } from "../../db/schema/tenants";
import { users } from "../../db/schema/users";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware";
import { AppError } from "../../security/error-handler";
import { generateSecureToken, generateUUID, hashOtp } from "../../security/crypto";
import { normalizeKenyanPhone, initiateMpesaStkPush } from "../../security/mpesa";
import { requireSecret } from "../../security/secrets";
import { rateLimiter } from "../../security/rate-limiter";

export const tenantBillingRouter = new Hono<AppEnv>();

tenantBillingRouter.use("*", authMiddleware(true), requireRole(["OWNER", "ADMIN"]));

const paymentPromptSchema = z.object({
  phoneNumber: z.string().trim().min(9).max(20).optional(),
});

tenantBillingRouter.get("/subscription", async (c) => {
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const tenant = c.get("tenant")!;
  const db = createDb(c.env.DB);
  const [[store], [owner], [settings], [latestPayment]] = await Promise.all([
    db.select({
      status: tenants.status,
      subscriptionAmount: tenants.subscriptionAmount,
      subscriptionDueAt: tenants.subscriptionDueAt,
    }).from(tenants).where(eq(tenants.id, tenant.id)).limit(1),
    db.select({ phone: users.phone }).from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.role, "OWNER"))).limit(1),
    db.select().from(platformBillingSettings)
      .where(eq(platformBillingSettings.id, "platform")).limit(1),
    db.select({
      id: platformBillingPayments.id,
      status: platformBillingPayments.status,
      amount: platformBillingPayments.amount,
      phoneNumber: platformBillingPayments.phoneNumber,
      receipt: platformBillingPayments.mpesaReceiptNumber,
      resultDesc: platformBillingPayments.resultDesc,
      createdAt: platformBillingPayments.createdAt,
    }).from(platformBillingPayments)
      .where(eq(platformBillingPayments.tenantId, tenant.id))
      .orderBy(desc(platformBillingPayments.createdAt)).limit(1),
  ]);
  const darajaConfigured = Boolean(
    c.env.MPESA_CONSUMER_KEY && c.env.MPESA_CONSUMER_SECRET &&
    c.env.MPESA_PASSKEY && c.env.MPESA_SHORTCODE
  );

  const effectiveAmount = store?.subscriptionAmount && store.subscriptionAmount > 0
    ? store.subscriptionAmount
    : (settings?.amount && settings.amount > 0 ? settings.amount : null);

  return c.json({
    success: true,
    data: {
      storeName: tenant.name,
      storeStatus: store?.status || tenant.status,
      subscriptionDueAt: store?.subscriptionDueAt || null,
      ownerPhone: owner?.phone || null,
      amount: effectiveAmount,
      intervalMonths: settings?.intervalMonths || 1,
      darajaConfigured,
      latestPayment: latestPayment || null,
    },
  });
});

tenantBillingRouter.post(
  "/subscription/payment-prompt",
  rateLimiter({ max: 5, windowMs: 60 * 1000 }),
  zValidator("json", paymentPromptSchema),
  async (c) => {
    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const tenant = c.get("tenant")!;
    if (!["ACTIVE", "SUSPENDED"].includes(tenant.status)) {
      throw new AppError("Subscription payment is available after the store is approved.", 409, "STORE_NOT_APPROVED");
    }
    const db = createDb(c.env.DB);
    const [owner] = await db.select({ phone: users.phone }).from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.role, "OWNER"))).limit(1);
    const phoneNumber = normalizeKenyanPhone(c.req.valid("json").phoneNumber || owner?.phone || "");
    if (!phoneNumber) {
      throw new AppError("Enter a valid Kenyan M-Pesa number for the store owner.", 400, "OWNER_PHONE_REQUIRED");
    }

    const [[storeRow], [billingSettings]] = await Promise.all([
      db.select({ subscriptionAmount: tenants.subscriptionAmount })
        .from(tenants).where(eq(tenants.id, tenant.id)).limit(1),
      db.select().from(platformBillingSettings)
        .where(eq(platformBillingSettings.id, "platform")).limit(1),
    ]);
    const effectiveAmount = storeRow?.subscriptionAmount && storeRow.subscriptionAmount > 0
      ? storeRow.subscriptionAmount
      : (billingSettings?.amount || 0);
    if (effectiveAmount < 1) {
      throw new AppError("Subscription billing is not configured yet. Contact Store254 support.", 409, "PLATFORM_BILLING_NOT_CONFIGURED");
    }

    const [pendingPrompt] = await db.select({ id: platformBillingPayments.id })
      .from(platformBillingPayments)
      .where(and(
        eq(platformBillingPayments.tenantId, tenant.id),
        eq(platformBillingPayments.status, "INITIATED"),
        gt(platformBillingPayments.createdAt, new Date(Date.now() - 5 * 60 * 1000))
      )).limit(1);
    if (pendingPrompt) {
      throw new AppError("An M-Pesa prompt is already pending. Check its status before sending another.", 409, "BILLING_PROMPT_PENDING");
    }

    const credentials = {
      consumerKey: requireSecret(c.env.MPESA_CONSUMER_KEY, "MPESA_CONSUMER_KEY"),
      consumerSecret: requireSecret(c.env.MPESA_CONSUMER_SECRET, "MPESA_CONSUMER_SECRET"),
      passkey: requireSecret(c.env.MPESA_PASSKEY, "MPESA_PASSKEY"),
      shortcode: requireSecret(c.env.MPESA_SHORTCODE, "MPESA_SHORTCODE"),
      shortcodeType: billingSettings?.shortcodeType || "PAYBILL",
      isSandbox: c.env.MPESA_IS_SANDBOX === "true",
    };

    const paymentId = generateUUID();
    const callbackToken = generateSecureToken();
    const now = new Date();
    const intervalMonths = billingSettings?.intervalMonths || 1;
    await db.insert(platformBillingPayments).values({
      id: paymentId,
      tenantId: tenant.id,
      amount: effectiveAmount,
      intervalMonths,
      phoneNumber,
      status: "INITIATED",
      callbackTokenHash: await hashOtp(callbackToken),
      createdAt: now,
      updatedAt: now,
    });

    try {
      const primaryDomain = c.env.PRIMARY_DOMAIN || "store254.co.ke";
      const callbackUrl = `https://api.${primaryDomain}/api/payments/mpesa/platform-callback?token=${encodeURIComponent(callbackToken)}`;
      const stk = await initiateMpesaStkPush({
        phoneNumber,
        amount: effectiveAmount,
        orderNumber: `SUB${paymentId.replace(/-/g, "").slice(0, 7)}`,
        storeName: "Store254 subscription",
        callbackUrl,
        credentials,
      });
      await db.update(platformBillingPayments).set({
        merchantRequestId: stk.merchantRequestId,
        checkoutRequestId: stk.checkoutRequestId,
        updatedAt: new Date(),
      }).where(eq(platformBillingPayments.id, paymentId));
    } catch (error) {
      await db.update(platformBillingPayments).set({
        status: "FAILED",
        resultDesc: error instanceof Error ? error.message.slice(0, 500) : "Safaricom rejected the payment request.",
        updatedAt: new Date(),
      }).where(eq(platformBillingPayments.id, paymentId));
      console.error("[Tenant Subscription] STK push could not be started", { paymentId, error });
      throw new AppError("Safaricom could not start the M-Pesa prompt. Check the payment number and try again.", 502, "MPESA_PROMPT_FAILED");
    }

    return c.json({
      success: true,
      message: `M-Pesa payment prompt sent to ${phoneNumber}.`,
      data: { paymentId, amount: effectiveAmount, phoneNumber },
    }, 202);
  }
);

tenantBillingRouter.get("/subscription/payments/:id", async (c) => {
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const tenant = c.get("tenant")!;
  const db = createDb(c.env.DB);
  const [payment] = await db.select({
    id: platformBillingPayments.id,
    status: platformBillingPayments.status,
    amount: platformBillingPayments.amount,
    phoneNumber: platformBillingPayments.phoneNumber,
    receipt: platformBillingPayments.mpesaReceiptNumber,
    resultDesc: platformBillingPayments.resultDesc,
  }).from(platformBillingPayments)
    .where(and(
      eq(platformBillingPayments.id, c.req.param("id")),
      eq(platformBillingPayments.tenantId, tenant.id)
    )).limit(1);
  if (!payment) throw new AppError("Payment request not found.", 404, "BILLING_PAYMENT_NOT_FOUND");
  return c.json({ success: true, data: payment });
});
