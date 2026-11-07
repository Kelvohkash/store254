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
function maskSecret(val: string | null | undefined): string | null {
  if (!val) return null;
  if (val.length <= 8) return "********";
  return val.substring(0, 4) + "••••••••" + val.substring(val.length - 4);
}

// Get Merchant Payment Gateway Settings
paymentSettingsRouter.get("/", async (c) => {
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

  return c.json({
    success: true,
    data: {
      provider: config.provider,
      isEnabled: config.isEnabled,
      shortcodeType: config.shortcodeType,
      shortcode: config.shortcode,
      consumerKey: maskSecret(config.consumerKey),
      passkey: maskSecret(config.passkey),
      isConfigured: Boolean(config.shortcode && config.consumerKey && config.passkey),
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

  if (existing) {
    await db
      .update(tenantPaymentConfigs)
      .set({
        isEnabled: body.isEnabled,
        shortcodeType: body.shortcodeType,
        shortcode: body.shortcode !== undefined ? body.shortcode : existing.shortcode,
        passkey: body.passkey !== undefined ? body.passkey : existing.passkey,
        consumerKey: body.consumerKey !== undefined ? body.consumerKey : existing.consumerKey,
        consumerSecret:
          body.consumerSecret !== undefined ? body.consumerSecret : existing.consumerSecret,
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
      passkey: body.passkey || null,
      consumerKey: body.consumerKey || null,
      consumerSecret: body.consumerSecret || null,
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

  try {
    const token = await getMpesaOAuthToken({
      consumerKey: config.consumerKey,
      consumerSecret: config.consumerSecret,
      passkey: config.passkey || "",
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
