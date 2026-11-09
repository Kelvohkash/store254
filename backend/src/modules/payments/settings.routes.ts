import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { tenantPaymentConfigs } from "../../db/schema/payment-configs";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware";
import { generateUUID } from "../../security/crypto";
import { AppError } from "../../security/error-handler";
import { getMpesaOAuthToken } from "../../security/mpesa";
import { decryptPaymentConfig, encryptPaymentConfig } from "../../security/payment-credentials";
import { requireSecret } from "../../security/secrets";

export const paymentSettingsRouter = new Hono<AppEnv>();

// Protect all payment settings routes to Store Owners and Admins only
paymentSettingsRouter.use("*", authMiddleware(true), requireRole(["OWNER", "ADMIN"]));

const updateMpesaSettingsSchema = z.object({
  isEnabled: z.boolean().default(false),
  shortcodeType: z.enum(["PAYBILL", "BUY_GOODS"]).default("PAYBILL"),
  shortcode: z.string().min(5).max(12).optional(),
  passkey: z.string().min(10).optional(),
  consumerKey: z.string().min(10).optional(),
  consumerSecret: z.string().min(10).optional(),
  isSandbox: z.boolean().default(false),
});

// Helper to mask secret strings
// Get Merchant Payment Gateway Settings
paymentSettingsRouter.get("/", async (c) => {
  const tenant = c.get("tenant")!;
  const db = createDb(c.env.DB);

  let [config] = await db
    .select()
    .from(tenantPaymentConfigs)
    .where(
      and(
        eq(tenantPaymentConfigs.tenantId, tenant.id),
        eq(tenantPaymentConfigs.provider, "MPESA")
      )
    )
    .limit(1);

  if (!config) {
    return c.json({
      success: true,
      data: {
        provider: "MPESA",
        isEnabled: false, // Disabled by default
        shortcodeType: "PAYBILL",
        shortcode: null,
        consumerKey: null,
        isConfigured: false,
        isSandbox: false,
      },
    });
  }

  // Migrate legacy plaintext merchant credentials opportunistically when an
  // authorized owner/admin opens settings.
  const encryptionKey = requireSecret(
    c.env?.PAYMENT_CONFIG_ENCRYPTION_KEY,
    "PAYMENT_CONFIG_ENCRYPTION_KEY"
  );
  const protectedConfig = await encryptPaymentConfig(config, encryptionKey);
  if (
    protectedConfig.passkey !== config.passkey ||
    protectedConfig.consumerKey !== config.consumerKey ||
    protectedConfig.consumerSecret !== config.consumerSecret
  ) {
    await db
      .update(tenantPaymentConfigs)
      .set({
        passkey: protectedConfig.passkey,
        consumerKey: protectedConfig.consumerKey,
        consumerSecret: protectedConfig.consumerSecret,
        updatedAt: new Date(),
      })
      .where(eq(tenantPaymentConfigs.id, config.id));
    config = { ...config, ...protectedConfig };
  }

  return c.json({
    success: true,
    data: {
      provider: config.provider,
      isEnabled: config.isEnabled,
      shortcodeType: config.shortcodeType,
      shortcode: config.shortcode,
      hasConsumerKey: Boolean(config.consumerKey),
      hasPasskey: Boolean(config.passkey),
      hasConsumerSecret: Boolean(config.consumerSecret),
      isConfigured: Boolean(config.shortcode && config.consumerKey && config.passkey && config.consumerSecret),
      isSandbox: config.isSandbox,
      updatedAt: config.updatedAt,
    },
  });
});

// Update & Enable/Disable Merchant Payment Gateway
paymentSettingsRouter.put("/", zValidator("json", updateMpesaSettingsSchema), async (c) => {
  const tenant = c.get("tenant")!;
  const body = c.req.valid("json");
  const db = createDb(c.env.DB);
  const encryptionKey = requireSecret(
    c.env?.PAYMENT_CONFIG_ENCRYPTION_KEY,
    "PAYMENT_CONFIG_ENCRYPTION_KEY"
  );

  const [existing] = await db
    .select()
    .from(tenantPaymentConfigs)
    .where(
      and(
        eq(tenantPaymentConfigs.tenantId, tenant.id),
        eq(tenantPaymentConfigs.provider, "MPESA")
      )
    )
    .limit(1);

  // If enabling, verify all required Safaricom credentials are provided
  if (body.isEnabled) {
    const finalShortcode = body.shortcode || existing?.shortcode;
    const finalPasskey = body.passkey || existing?.passkey;
    const finalKey = body.consumerKey || existing?.consumerKey;
    const finalSecret = body.consumerSecret || existing?.consumerSecret;

    if (!finalShortcode || !finalPasskey || !finalKey || !finalSecret) {
      throw new AppError(
        "Cannot enable M-Pesa. Shortcode, Passkey, Consumer Key, and Consumer Secret are all required.",
        400,
        "CREDENTIALS_INCOMPLETE"
      );
    }
  }

  const configId = existing ? existing.id : generateUUID();
  const nextCredentials = await encryptPaymentConfig(
    {
      passkey: body.passkey !== undefined ? body.passkey : existing?.passkey,
      consumerKey: body.consumerKey !== undefined ? body.consumerKey : existing?.consumerKey,
      consumerSecret: body.consumerSecret !== undefined ? body.consumerSecret : existing?.consumerSecret,
    },
    encryptionKey
  );

  if (existing) {
    await db
      .update(tenantPaymentConfigs)
      .set({
        isEnabled: body.isEnabled,
        shortcodeType: body.shortcodeType,
        shortcode: body.shortcode !== undefined ? body.shortcode : existing.shortcode,
        passkey: nextCredentials.passkey || null,
        consumerKey: nextCredentials.consumerKey || null,
        consumerSecret: nextCredentials.consumerSecret || null,
        isSandbox: body.isSandbox,
        updatedAt: new Date(),
      })
      .where(eq(tenantPaymentConfigs.id, existing.id));
  } else {
    await db.insert(tenantPaymentConfigs).values({
      id: configId,
      tenantId: tenant.id,
      provider: "MPESA",
      isEnabled: body.isEnabled,
      shortcodeType: body.shortcodeType,
      shortcode: body.shortcode || null,
      passkey: nextCredentials.passkey || null,
      consumerKey: nextCredentials.consumerKey || null,
      consumerSecret: nextCredentials.consumerSecret || null,
      isSandbox: body.isSandbox,
    });
  }

  return c.json({
    success: true,
    message: body.isEnabled
      ? "M-Pesa payment gateway configured and enabled successfully."
      : "M-Pesa payment settings saved (currently disabled).",
    data: {
      isEnabled: body.isEnabled,
      shortcodeType: body.shortcodeType,
      shortcode: body.shortcode || existing?.shortcode,
    },
  });
});

// Test Merchant Safaricom Connection
paymentSettingsRouter.post("/test-connection", async (c) => {
  const tenant = c.get("tenant")!;
  const db = createDb(c.env.DB);

  const [config] = await db
    .select()
    .from(tenantPaymentConfigs)
    .where(
      and(
        eq(tenantPaymentConfigs.tenantId, tenant.id),
        eq(tenantPaymentConfigs.provider, "MPESA")
      )
    )
    .limit(1);

  if (!config || !config.consumerKey || !config.consumerSecret) {
    throw new AppError(
      "No M-Pesa credentials configured yet to test.",
      400,
      "MISSING_CREDENTIALS"
    );
  }

  const encryptionKey = requireSecret(
    c.env?.PAYMENT_CONFIG_ENCRYPTION_KEY,
    "PAYMENT_CONFIG_ENCRYPTION_KEY"
  );
  const decryptedConfig = await decryptPaymentConfig(config, encryptionKey);

  try {
    const token = await getMpesaOAuthToken({
      consumerKey: decryptedConfig.consumerKey || "",
      consumerSecret: decryptedConfig.consumerSecret || "",
      passkey: decryptedConfig.passkey || "",
      shortcode: config.shortcode || "",
      isSandbox: config.isSandbox,
    });

    return c.json({
      success: true,
      message: "Connection to Safaricom Daraja API succeeded!",
      data: {
        status: "CONNECTED",
        tokenReceived: Boolean(token),
        isSandbox: config.isSandbox,
      },
    });
  } catch (err: any) {
    return c.json(
      {
        success: false,
        error: {
          code: "CONNECTION_FAILED",
          message: `Safaricom rejected credentials: ${err.message}`,
        },
      },
      400
    );
  }
});
