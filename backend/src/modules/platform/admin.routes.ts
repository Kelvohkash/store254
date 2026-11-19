import { Hono, type Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, inArray, ne } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { tenants } from "../../db/schema/tenants";
import { users } from "../../db/schema/users";
import { items } from "../../db/schema/items";
import { orders } from "../../db/schema/orders";
import { tenantPaymentConfigs } from "../../db/schema/payment-configs";
import { AppError } from "../../security/error-handler";
import { hashOtp, timingSafeEqual } from "../../security/crypto";
import { sanitizeSubdomain } from "../../security/sanitize";
import { EmailService } from "../../services/email.service";
import { sign, verify } from "hono/jwt";
import { rateLimiter } from "../../security/rate-limiter";
import { requireSecret } from "../../security/secrets";
import { encryptPaymentConfig } from "../../security/payment-credentials";
import { platformBillingSettings } from "../../db/schema/platform-billing";
import { copyrightReports } from "../../db/schema/copyright-reports";
import {
  executeImageTakedown,
  extractMediaReference,
  matchesReportedImage,
} from "../../services/copyright-takedown.service";

export const platformAdminRouter = new Hono<AppEnv>();

const adminLoginSchema = z.object({
  username: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(256),
});

const platformBillingSettingsSchema = z.object({
  amount: z.number().int().min(0).max(10_000_000).default(0),
  shortcodeType: z.enum(["PAYBILL", "BUY_GOODS"]),
});
const storeBillingPriceSchema = z.object({
  amount: z.number().int().min(1).max(10_000_000).nullable(),
});
const amendSubdomainSchema = z.object({
  subdomain: z.string().trim().min(2).max(32),
});

function cleanContactString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractPhoneFromWhatsapp(whatsapp: string | null): string | null {
  if (!whatsapp) return null;
  const trimmed = whatsapp.trim();
  if (!trimmed) return null;
  if (!/^[a-z][a-z\d+.-]*:/i.test(trimmed)) {
    return trimmed.replace(/\D/g, "").length >= 6 ? trimmed : null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host === "wa.me") {
      const digits = url.pathname.replace(/\D/g, "");
      return digits.length >= 6 ? `+${digits}` : null;
    }
    if (host === "api.whatsapp.com" || host === "whatsapp.com" || host === "www.whatsapp.com") {
      const digits = (url.searchParams.get("phone") || "").replace(/\D/g, "");
      return digits.length >= 6 ? `+${digits}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function extractStoreContact(rawSettings: unknown): {
  contactPhone: string | null;
  whatsapp: string | null;
  contactEmail: string | null;
} {
  let parsed: unknown = rawSettings;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { contactPhone: null, whatsapp: null, contactEmail: null };
  }
  const obj = parsed as Record<string, unknown>;
  const rawSocials = obj.socialLinks;
  const socialLinks =
    rawSocials && typeof rawSocials === "object" && !Array.isArray(rawSocials)
      ? (rawSocials as Record<string, unknown>)
      : {};
  return {
    contactPhone: cleanContactString(obj.contactPhone) || cleanContactString(obj.phone),
    whatsapp: cleanContactString(socialLinks.whatsapp),
    contactEmail: cleanContactString(obj.contactEmail),
  };
}

function normalizePhoneDigitsForSearch(phone: string | null): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length === 10 && (digits[1] === "7" || digits[1] === "1")) {
    return `254${digits.slice(1)}`;
  }
  if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) {
    return `254${digits}`;
  }
  return digits;
}

async function matchesSecret(provided: string, expected: string): Promise<boolean> {
  const [providedHash, expectedHash] = await Promise.all([hashOtp(provided), hashOtp(expected)]);
  return timingSafeEqual(providedHash, expectedHash);
}

function getCookie(c: Context<AppEnv>, name: string): string | null {
  const cookieHeader = c.req.header("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

function setAdminSessionCookie(c: Context<AppEnv>, token: string): void {
  const maxAge = 24 * 60 * 60; // 24 hours
  c.header(
    "Set-Cookie",
    `__Host-store254_admin_session=${token}; Path=/; Max-Age=${maxAge}; SameSite=Strict; Secure; HttpOnly`
  );
}

function clearAdminSessionCookie(c: Context<AppEnv>): void {
  c.header(
    "Set-Cookie",
    `__Host-store254_admin_session=; Path=/; Max-Age=0; SameSite=Strict; Secure; HttpOnly`
  );
}

const ADMIN_JWT_ISSUER = "store254-platform";
const ADMIN_JWT_AUDIENCE = "store254-platform-admin";

async function verifySuperAdminJwt(token: string, jwtSecret: string) {
  const payload = await verify(token, jwtSecret, "HS256");
  const now = Math.floor(Date.now() / 1000);
  if (
    !payload ||
    payload.role !== "SUPER_ADMIN" ||
    payload.iss !== ADMIN_JWT_ISSUER ||
    payload.aud !== ADMIN_JWT_AUDIENCE ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= now
  ) {
    return null;
  }
  return payload;
}

function assertAdminOrigin(c: Context<AppEnv>): void {
  const origin = c.req.header("origin");
  if (!origin) {
    const secFetchSite = c.req.header("sec-fetch-site");
    if (secFetchSite === "same-origin") {
      return;
    }
    throw new AppError("A valid platform origin is required.", 403, "INVALID_ORIGIN");
  }

  try {
    const url = new URL(origin);
    const primaryDomain = (c.env?.PRIMARY_DOMAIN || "store254.co.ke").toLowerCase();
    const isDev = c.env?.ENVIRONMENT === "development";

    if (
      isDev &&
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname.endsWith(".localhost"))
    ) {
      return;
    }

    // Admin sessions may be initiated only from apex/www platform UI domains.
    if (
      (url.protocol === "https:" || isDev) &&
      (url.hostname.toLowerCase() === primaryDomain || url.hostname.toLowerCase() === `www.${primaryDomain}`)
    ) {
      return;
    }

    // Check additional configured frontend origins (explicit non-empty matches only)
    const configured = (c.env?.FRONTEND_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if ((url.protocol === "https:" || isDev) && configured.includes(url.origin)) {
      return;
    }
  } catch {
    throw new AppError("A valid platform origin is required.", 403, "INVALID_ORIGIN");
  }

  throw new AppError("A valid platform origin is required.", 403, "INVALID_ORIGIN");
}

// 0. Super Admin Status & Identity Endpoint (Publicly callable to inspect session)
platformAdminRouter.get("/me", async (c) => {
  assertAdminOrigin(c);
  const jwtSecret = c.env?.PLATFORM_ADMIN_JWT_SECRET;
  const token = getCookie(c, "__Host-store254_admin_session");

  if (token && jwtSecret) {
    try {
      const payload = await verifySuperAdminJwt(token, jwtSecret);
      if (payload) {
        return c.json({
          success: true,
          authenticated: true,
          user: {
            username: (payload.email as string) || "super-admin",
            role: "SUPER_ADMIN",
          },
        });
      }
    } catch {
      // invalid token
    }
  }

  return c.json({
    success: true,
    authenticated: false,
  });
});

// Super Admin Login (username/password Cloudflare secrets, then HttpOnly session)
platformAdminRouter.post(
  "/login",
  rateLimiter({
    max: 5,
    windowMs: 15 * 60 * 1000,
    binding: "AUTH_STRICT_RATE_LIMITER",
    accountKeyFields: ["username"],
  }),
  zValidator("json", adminLoginSchema),
  async (c) => {
    assertAdminOrigin(c);
    const body = c.req.valid("json");
    const jwtSecret = requireSecret(c.env?.PLATFORM_ADMIN_JWT_SECRET, "PLATFORM_ADMIN_JWT_SECRET");
    const adminUsername = c.env?.PLATFORM_ADMIN_USERNAME;
    const adminPassword = c.env?.PLATFORM_ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      throw new AppError("Super Admin login is not configured.", 500, "ADMIN_AUTH_NOT_CONFIGURED");
    }

    const [usernameMatches, passwordMatches] = await Promise.all([
      matchesSecret(body.username.toLowerCase(), adminUsername.trim().toLowerCase()),
      matchesSecret(body.password, adminPassword),
    ]);
    if (!usernameMatches || !passwordMatches) {
      throw new AppError("Invalid username or password.", 401, "UNAUTHORIZED_ADMIN");
    }

    const now = Math.floor(Date.now() / 1000);
    const token = await sign(
      {
        sub: "super-admin",
        email: adminUsername.trim(),
        role: "SUPER_ADMIN",
        iss: ADMIN_JWT_ISSUER,
        aud: ADMIN_JWT_AUDIENCE,
        iat: now,
        exp: now + 24 * 60 * 60, // 24 hours
      },
      jwtSecret,
      "HS256"
    );

    setAdminSessionCookie(c, token);

    return c.json({
      success: true,
      message: "Super Admin authenticated successfully.",
      data: {
        username: adminUsername.trim(),
        role: "SUPER_ADMIN",
      },
    });
  }
);

// Super Admin Sign Out
platformAdminRouter.post("/logout", async (c) => {
  assertAdminOrigin(c);
  clearAdminSessionCookie(c);
  return c.json({ success: true, message: "Super Admin signed out successfully." });
});

// ─── Super Admin Authentication Guard for All Subsequent Routes ──────────────
platformAdminRouter.use("*", async (c, next) => {
  assertAdminOrigin(c);

  const jwtSecret = c.env?.PLATFORM_ADMIN_JWT_SECRET;

  const token = getCookie(c, "__Host-store254_admin_session");

  if (token && jwtSecret) {
    try {
      const payload = await verifySuperAdminJwt(token, jwtSecret);
      if (payload) {
        c.set("user", {
          id: (payload.sub as string) || "super-admin",
          tenantId: "platform",
          email: (payload.email as string) || "super-admin@store254.co.ke",
          role: "SUPER_ADMIN" as any,
        });
        return next();
      }
    } catch {
      // Invalid token
    }
  }

  throw new AppError(
    "Super Admin access required. Please sign in with your username and password.",
    401,
    "UNAUTHORIZED_ADMIN"
  );
});

// 1. List All Stores (with status filtering and search)
platformAdminRouter.get("/stores", async (c) => {
  const statusFilter = c.req.query("status"); // PENDING, ACTIVE, SUSPENDED
  const search = c.req.query("search");
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  if (!c.env?.DB) {
    throw new AppError("Database not ready", 500);
  }

  const db = createDb(c.env.DB);

  let query = db
    .select({
      id: tenants.id,
      name: tenants.name,
      subdomain: tenants.subdomain,
      customDomain: tenants.customDomain,
      businessType: tenants.businessType,
      currency: tenants.currency,
      status: tenants.status,
      settings: tenants.settings,
      subscriptionAmount: tenants.subscriptionAmount,
      subscriptionDueAt: tenants.subscriptionDueAt,
      createdAt: tenants.createdAt,
      updatedAt: tenants.updatedAt,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt))
    .limit(limit)
    .offset(offset);

  let storeList = await query;

  if (statusFilter) {
    storeList = storeList.filter((s) => s.status === statusFilter.toUpperCase());
  }

  const owners = storeList.length
    ? await db
        .select({
          tenantId: users.tenantId,
          phone: users.phone,
          email: users.email,
          fullName: users.fullName,
        })
        .from(users)
        .where(and(inArray(users.tenantId, storeList.map((store) => store.id)), eq(users.role, "OWNER")))
    : [];
  const ownerByTenant = new Map<string, (typeof owners)[number]>();
  for (const owner of owners) {
    const existing = ownerByTenant.get(owner.tenantId);
    if (!existing || (!cleanContactString(existing.phone) && cleanContactString(owner.phone))) {
      ownerByTenant.set(owner.tenantId, owner);
    }
  }

  let mappedStores = storeList.map((store) => {
    const { settings, ...storeFields } = store;
    const owner = ownerByTenant.get(store.id);
    const contact = extractStoreContact(settings);
    const ownerPhone = cleanContactString(owner?.phone);
    const phone =
      contact.contactPhone || ownerPhone || extractPhoneFromWhatsapp(contact.whatsapp) || null;
    return {
      ...storeFields,
      phone,
      contactPhone: contact.contactPhone,
      whatsapp: contact.whatsapp,
      ownerPhone,
      ownerEmail: owner?.email || contact.contactEmail || null,
      ownerName: owner?.fullName || null,
    };
  });

  if (search) {
    const q = search.trim().toLowerCase();
    const isPhoneLikeQuery = /^[+\d\s()-]{4,}$/.test(search.trim());
    const qRawDigits = search.replace(/\D/g, "");
    const qNormalizedDigits = normalizePhoneDigitsForSearch(search);

    mappedStores = mappedStores.filter((s) => {
      const textMatch = [
        s.name,
        s.subdomain,
        s.customDomain,
        s.ownerName,
        s.ownerEmail,
        s.phone,
        s.contactPhone,
        s.ownerPhone,
        s.whatsapp,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
      if (textMatch) return true;
      if (!isPhoneLikeQuery) return false;
      const phoneDigits = [s.phone, s.contactPhone, s.ownerPhone, s.whatsapp]
        .filter(Boolean)
        .flatMap((val) => {
          const raw = String(val).replace(/\D/g, "");
          const norm = normalizePhoneDigitsForSearch(val);
          return [raw, norm].filter(Boolean);
        });
      return phoneDigits.some(
        (digits) =>
          (qRawDigits && digits.includes(qRawDigits)) ||
          (qNormalizedDigits && digits.includes(qNormalizedDigits))
      );
    });
  }

  return c.json({
    success: true,
    data: mappedStores,
    pagination: {
      page,
      limit,
      count: mappedStores.length,
    },
  });
});

// 2. Get Single Store Details & Metrics
platformAdminRouter.get("/stores/:id", async (c) => {
  const storeId = c.req.param("id");
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);

  const [store] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, storeId))
    .limit(1);

  if (!store) {
    throw new AppError("Store not found.", 404, "STORE_NOT_FOUND");
  }

  // Fetch store owner details
  const [owner] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      role: users.role,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.tenantId, store.id), eq(users.role, "OWNER")))
    .limit(1);

  // Fetch payment configuration status
  const [paymentConfig] = await db
    .select({
      provider: tenantPaymentConfigs.provider,
      isEnabled: tenantPaymentConfigs.isEnabled,
      shortcodeType: tenantPaymentConfigs.shortcodeType,
      shortcode: tenantPaymentConfigs.shortcode,
      isSandbox: tenantPaymentConfigs.isSandbox,
      updatedAt: tenantPaymentConfigs.updatedAt,
    })
    .from(tenantPaymentConfigs)
    .where(eq(tenantPaymentConfigs.tenantId, store.id))
    .limit(1);

  // Counts
  const itemList = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.tenantId, store.id));
  const orderList = await db
    .select({ id: orders.id, total: orders.totalAmount, status: orders.status })
    .from(orders)
    .where(eq(orders.tenantId, store.id));

  const contact = extractStoreContact(store.settings);
  const ownerPhone = cleanContactString(owner?.phone);

  return c.json({
    success: true,
    data: {
      store,
      owner,
      contact: {
        phone:
          contact.contactPhone || ownerPhone || extractPhoneFromWhatsapp(contact.whatsapp) || null,
        contactPhone: contact.contactPhone,
        ownerPhone,
        whatsapp: contact.whatsapp,
        email: owner?.email || contact.contactEmail || null,
      },
      paymentConfig: paymentConfig || { isEnabled: false, status: "NOT_CONFIGURED" },
      metrics: {
        totalItems: itemList.length,
        totalOrders: orderList.length,
        paidOrders: orderList.filter((o) => o.status === "PAID").length,
      },
    },
  });
});

// 3. Activate a Pending Store (Super Admin Approval)
platformAdminRouter.patch("/stores/:id/activate", async (c) => {
  const storeId = c.req.param("id");
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);

  const [store] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, storeId))
    .limit(1);

  if (!store) {
    throw new AppError("Store not found.", 404, "STORE_NOT_FOUND");
  }

  // Update status to ACTIVE
  await db
    .update(tenants)
    .set({
      status: "ACTIVE",
      subscriptionDueAt: store.subscriptionDueAt || new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, store.id));

  // Find owner to send confirmation email
  const [owner] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.tenantId, store.id), eq(users.role, "OWNER")))
    .limit(1);

  const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";

  if (owner) {
    await EmailService.sendStoreActivated({
      to: owner.email,
      storeName: store.name,
      subdomain: store.subdomain,
      primaryDomain,
      apiKey: c.env?.RESEND_API_KEY,
      smtp: EmailService.smtpFromEnv(c.env),
    });
  }

  return c.json({
    success: true,
    message: `Store "${store.name}" has been approved and activated! Notification email sent.`,
    data: {
      id: store.id,
      name: store.name,
      subdomain: store.subdomain,
      status: "ACTIVE",
      storeUrl: `https://${store.subdomain}.${primaryDomain}`,
    },
  });
});

// 4. Deactivate / Suspend Store (Policy Violations / Non-payment)
platformAdminRouter.patch("/stores/:id/deactivate", async (c) => {
  const storeId = c.req.param("id");
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);

  const [store] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, storeId))
    .limit(1);

  if (!store) {
    throw new AppError("Store not found.", 404, "STORE_NOT_FOUND");
  }

  await db
    .update(tenants)
    .set({
      status: "SUSPENDED",
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, store.id));

  return c.json({
    success: true,
    message: `Store "${store.name}" has been suspended. Storefront and API access disabled.`,
    data: {
      id: store.id,
      status: "SUSPENDED",
    },
  });
});

// Reactivate a previously suspended storefront (separate from first approval).
platformAdminRouter.patch("/stores/:id/reactivate", async (c) => {
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);
  const [store] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, c.req.param("id")))
    .limit(1);

  if (!store) throw new AppError("Store not found.", 404, "STORE_NOT_FOUND");
  if (store.status !== "SUSPENDED") {
    throw new AppError("Only suspended stores can be reactivated.", 409, "STORE_NOT_SUSPENDED");
  }

  await db.update(tenants)
    .set({ status: "ACTIVE", updatedAt: new Date() })
    .where(and(eq(tenants.id, store.id), eq(tenants.status, "SUSPENDED")));

  const [owner] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.tenantId, store.id), eq(users.role, "OWNER")))
    .limit(1);
  const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";
  if (owner) {
    await EmailService.sendStoreActivated({
      to: owner.email,
      storeName: store.name,
      subdomain: store.subdomain,
      primaryDomain,
      apiKey: c.env?.RESEND_API_KEY,
      smtp: EmailService.smtpFromEnv(c.env),
    });
  }

  return c.json({
    success: true,
    message: `Store "${store.name}" has been reactivated.`,
    data: { id: store.id, name: store.name, status: "ACTIVE", storeUrl: `https://${store.subdomain}.${primaryDomain}` },
  });
});

platformAdminRouter.patch("/stores/:id/billing/trial", async (c) => {
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);
  const [store] = await db.select().from(tenants).where(eq(tenants.id, c.req.param("id"))).limit(1);
  if (!store) throw new AppError("Store not found.", 404, "STORE_NOT_FOUND");
  if (store.status !== "ACTIVE") throw new AppError("A free month can only be added to an active store.", 409, "STORE_NOT_ACTIVE");

  const now = new Date();
  const base = store.subscriptionDueAt && store.subscriptionDueAt > now ? store.subscriptionDueAt : now;
  const trialEnd = new Date(base);
  const dayOfMonth = trialEnd.getUTCDate();
  trialEnd.setUTCDate(1);
  trialEnd.setUTCMonth(trialEnd.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(trialEnd.getUTCFullYear(), trialEnd.getUTCMonth() + 1, 0)).getUTCDate();
  trialEnd.setUTCDate(Math.min(dayOfMonth, lastDay));
  await db.update(tenants).set({ subscriptionDueAt: trialEnd, updatedAt: now }).where(eq(tenants.id, store.id));
  return c.json({ success: true, message: `One free month has been added for ${store.name}.`, data: { id: store.id, subscriptionDueAt: trialEnd } });
});

platformAdminRouter.patch("/stores/:id/billing/price", zValidator("json", storeBillingPriceSchema), async (c) => {
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const { amount } = c.req.valid("json");
  const db = createDb(c.env.DB);
  const [store] = await db.select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, c.req.param("id")))
    .limit(1);
  if (!store) throw new AppError("Store not found.", 404, "STORE_NOT_FOUND");

  await db.update(tenants)
    .set({ subscriptionAmount: amount, updatedAt: new Date() })
    .where(eq(tenants.id, store.id));

  return c.json({
    success: true,
    message: amount
      ? `Monthly price for "${store.name}" set to KES ${amount.toLocaleString("en-KE")}.`
      : `Custom price cleared for "${store.name}". It will use the default platform fee if configured.`,
    data: { id: store.id, subscriptionAmount: amount },
  });
});

platformAdminRouter.get("/billing/settings", async (c) => {
  const darajaConfigured = Boolean(
    c.env?.MPESA_CONSUMER_KEY && c.env?.MPESA_CONSUMER_SECRET &&
    c.env?.MPESA_PASSKEY && c.env?.MPESA_SHORTCODE
  );
  const darajaMode = c.env?.MPESA_IS_SANDBOX === "true" ? "SANDBOX" : "PRODUCTION";

  let settings: { amount: number | null; shortcodeType: string } | undefined;
  let warning: string | undefined;

  if (c.env?.DB) {
    try {
      const db = createDb(c.env.DB);
      [settings] = await db
        .select({
          amount: platformBillingSettings.amount,
          shortcodeType: platformBillingSettings.shortcodeType,
        })
        .from(platformBillingSettings)
        .where(eq(platformBillingSettings.id, "platform"))
        .limit(1);
    } catch (err) {
      const msg = `${err instanceof Error ? err.message : String(err ?? "")}`;
      warning = /exceeded D1's free tier|daily row (?:read|write) limit/i.test(msg)
        ? "Cloudflare D1 free-tier daily limit reached (resets at 00:00 UTC). Showing Worker Daraja config only."
        : "Saved billing amount is temporarily unavailable from database.";
      console.warn("[Admin Billing] Settings DB query failed:", msg);
    }
  }

  return c.json({
    success: true,
    data: {
      amount: settings?.amount && settings.amount > 0 ? settings.amount : null,
      intervalMonths: 1,
      shortcodeType: settings?.shortcodeType || "PAYBILL",
      darajaConfigured,
      darajaMode,
      ...(warning ? { warning } : {}),
    },
  });
});

platformAdminRouter.put("/billing/settings", zValidator("json", platformBillingSettingsSchema), async (c) => {
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const { amount, shortcodeType } = c.req.valid("json");
  const db = createDb(c.env.DB);
  await db.insert(platformBillingSettings).values({
    id: "platform", amount, intervalMonths: 1, shortcodeType, updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: platformBillingSettings.id,
    set: { amount, intervalMonths: 1, shortcodeType, updatedAt: new Date() },
  });

  return c.json({
    success: true,
    message: "Platform billing settings saved.",
    data: { amount: amount > 0 ? amount : null, intervalMonths: 1, shortcodeType },
  });
});

// 5. Amend Store Subdomain (Super Admin)
platformAdminRouter.patch(
  "/stores/:id/subdomain",
  zValidator("json", amendSubdomainSchema),
  async (c) => {
    const storeId = c.req.param("id");
    const { subdomain: rawSubdomain } = c.req.valid("json");
    if (!c.env?.DB) throw new AppError("Database not ready", 500);

    const cleaned = sanitizeSubdomain(rawSubdomain);
    if (!cleaned) {
      throw new AppError(
        "Subdomain is reserved or invalid. Use 2-32 lowercase letters, numbers, or internal hyphens.",
        400,
        "INVALID_SUBDOMAIN"
      );
    }

    const db = createDb(c.env.DB);
    const [store] = await db
      .select({ id: tenants.id, name: tenants.name, subdomain: tenants.subdomain })
      .from(tenants)
      .where(eq(tenants.id, storeId))
      .limit(1);

    if (!store) {
      throw new AppError("Store not found.", 404, "STORE_NOT_FOUND");
    }

    if (store.subdomain === cleaned) {
      return c.json({
        success: true,
        message: `Subdomain is already "${cleaned}.store254.co.ke".`,
        data: { id: store.id, name: store.name, subdomain: cleaned, previousSubdomain: store.subdomain },
      });
    }

    const [conflict] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(and(eq(tenants.subdomain, cleaned), ne(tenants.id, storeId)))
      .limit(1);

    if (conflict) {
      throw new AppError(
        `Subdomain "${cleaned}" is already claimed by another business.`,
        409,
        "SUBDOMAIN_TAKEN"
      );
    }

    await db
      .update(tenants)
      .set({ subdomain: cleaned, updatedAt: new Date() })
      .where(eq(tenants.id, storeId));

    return c.json({
      success: true,
      message: `Subdomain for "${store.name}" updated to ${cleaned}.store254.co.ke.`,
      data: {
        id: store.id,
        name: store.name,
        subdomain: cleaned,
        previousSubdomain: store.subdomain,
      },
    });
  }
);

// 6. Delete Store (Permanent Cascade + R2 Media Purge)
platformAdminRouter.delete("/stores/:id", async (c) => {
  const storeId = c.req.param("id");
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);

  const [store] = await db
    .select({ id: tenants.id, name: tenants.name, subdomain: tenants.subdomain })
    .from(tenants)
    .where(eq(tenants.id, storeId))
    .limit(1);

  if (!store) {
    throw new AppError("Store not found.", 404, "STORE_NOT_FOUND");
  }

  // Deleting tenant cascades to all categories, items, orders, users, and payments
  await db.delete(tenants).where(eq(tenants.id, storeId));

  // Best-effort purge of tenant's uploaded R2 media assets
  if (c.env?.MEDIA_BUCKET) {
    try {
      let cursor: string | undefined;
      do {
        const listed = await c.env.MEDIA_BUCKET.list({ prefix: `${storeId}/`, cursor });
        const keys = listed.objects.map((obj) => obj.key);
        if (keys.length > 0) {
          await c.env.MEDIA_BUCKET.delete(keys);
        }
        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);
    } catch {
      // Do not fail store deletion response if R2 cleanup partially fails
    }
  }

  return c.json({
    success: true,
    message: `Store "${store.name}" (${store.subdomain}.store254.co.ke) and all associated data permanently deleted.`,
  });
});

// 6. Platform Overview & Metrics
platformAdminRouter.get("/stats", async (c) => {
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);

  const allStores = await db.select({ status: tenants.status }).from(tenants);
  const allOrders = await db
    .select({ totalAmount: orders.totalAmount, status: orders.status })
    .from(orders);

  const pendingStores = allStores.filter((s) => s.status === "PENDING").length;
  const activeStores = allStores.filter((s) => s.status === "ACTIVE").length;
  const suspendedStores = allStores.filter((s) => s.status === "SUSPENDED").length;

  const paidOrders = allOrders.filter((o) => o.status === "PAID");
  const platformGMV = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  return c.json({
    success: true,
    data: {
      stores: {
        total: allStores.length,
        pendingApproval: pendingStores,
        active: activeStores,
        suspended: suspendedStores,
      },
      orders: {
        totalOrders: allOrders.length,
        completedOrders: paidOrders.length,
        platformGMV_KES: platformGMV,
      },
    },
  });
});

// One-time super-admin-only migration for legacy plaintext merchant credentials.
// It is safe to run repeatedly; already encrypted values remain unchanged.
platformAdminRouter.post("/maintenance/encrypt-payment-configs", async (c) => {
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const secret = requireSecret(
    c.env?.PAYMENT_CONFIG_ENCRYPTION_KEY,
    "PAYMENT_CONFIG_ENCRYPTION_KEY"
  );
  const db = createDb(c.env.DB);
  const configs = await db.select().from(tenantPaymentConfigs);
  let updated = 0;

  for (const config of configs) {
    const encrypted = await encryptPaymentConfig(config, secret);
    const changed =
      encrypted.passkey !== config.passkey ||
      encrypted.consumerKey !== config.consumerKey ||
      encrypted.consumerSecret !== config.consumerSecret;
    if (!changed) continue;

    await db
      .update(tenantPaymentConfigs)
      .set({
        passkey: encrypted.passkey,
        consumerKey: encrypted.consumerKey,
        consumerSecret: encrypted.consumerSecret,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tenantPaymentConfigs.id, config.id),
          eq(tenantPaymentConfigs.tenantId, config.tenantId)
        )
      );
    updated++;
  }

  return c.json({
    success: true,
    data: { encryptedConfigurations: updated },
  });
});

const takedownActionSchema = z.object({
  suspendStore: z.boolean().optional().default(false),
  resolutionNotes: z.string().trim().max(500).optional(),
});

const dismissReportSchema = z.object({
  resolutionNotes: z.string().trim().max(500).optional(),
});

const directMediaTakedownSchema = z.object({
  reportedImageUrl: z.string().trim().min(3, "Image URL is required").max(1000),
  storeSubdomain: z.string().trim().max(64).optional(),
  suspendStore: z.boolean().optional().default(false),
  resolutionNotes: z.string().trim().max(500).optional(),
});

// 7. Copyright Reports & Image Takedowns (Super Admin Moderation)
platformAdminRouter.get("/copyright-reports", async (c) => {
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);
  const statusFilter = (c.req.query("status") || "ALL").toUpperCase();

  const allReports = await db
    .select()
    .from(copyrightReports)
    .orderBy(desc(copyrightReports.createdAt))
    .limit(500);

  const counts = {
    all: allReports.length,
    open: allReports.filter((r) => r.status === "OPEN").length,
    takenDown: allReports.filter((r) => r.status === "TAKEN_DOWN").length,
    dismissed: allReports.filter((r) => r.status === "DISMISSED").length,
  };

  const filtered =
    statusFilter === "OPEN" || statusFilter === "TAKEN_DOWN" || statusFilter === "DISMISSED"
      ? allReports.filter((r) => r.status === statusFilter)
      : allReports;

  const tenantIds = Array.from(
    new Set(filtered.map((r) => r.tenantId).filter((id): id is string => Boolean(id)))
  );
  const tenantRows =
    tenantIds.length > 0
      ? await db
          .select({
            id: tenants.id,
            name: tenants.name,
            subdomain: tenants.subdomain,
            status: tenants.status,
            settings: tenants.settings,
          })
          .from(tenants)
          .where(inArray(tenants.id, tenantIds))
      : [];
  const tenantMap = new Map(tenantRows.map((t) => [t.id, t]));

  const ownerRows =
    tenantIds.length > 0
      ? await db
          .select({
            tenantId: users.tenantId,
            phone: users.phone,
          })
          .from(users)
          .where(and(inArray(users.tenantId, tenantIds), eq(users.role, "OWNER")))
      : [];
  const ownerPhoneByTenant = new Map<string, string>();
  for (const owner of ownerRows) {
    const cleaned = cleanContactString(owner.phone);
    if (cleaned && !ownerPhoneByTenant.has(owner.tenantId)) {
      ownerPhoneByTenant.set(owner.tenantId, cleaned);
    }
  }

  const data = filtered.map((r) => {
    const store = r.tenantId ? tenantMap.get(r.tenantId) : null;
    const storeContact = store ? extractStoreContact(store.settings) : null;
    const ownerPhone = r.tenantId ? ownerPhoneByTenant.get(r.tenantId) || null : null;
    const storePhone =
      storeContact?.contactPhone ||
      ownerPhone ||
      extractPhoneFromWhatsapp(storeContact?.whatsapp || null) ||
      null;
    return {
      ...r,
      storeName: store?.name || null,
      storeSubdomain: r.storeSubdomain || store?.subdomain || null,
      storeStatus: store?.status || null,
      storePhone,
      storeWhatsapp: storeContact?.whatsapp || null,
    };
  });

  return c.json({
    success: true,
    data,
    counts,
  });
});

platformAdminRouter.post(
  "/copyright-reports/:id/takedown",
  zValidator("json", takedownActionSchema),
  async (c) => {
    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const reportId = c.req.param("id");
    const body = c.req.valid("json");
    const db = createDb(c.env.DB);

    const [report] = await db
      .select()
      .from(copyrightReports)
      .where(eq(copyrightReports.id, reportId))
      .limit(1);

    if (!report) {
      throw new AppError("Copyright report not found.", 404, "REPORT_NOT_FOUND");
    }

    const result = await executeImageTakedown(db, c.env.MEDIA_BUCKET, {
      reportedImageUrl: report.reportedImageUrl,
      tenantIdHint: report.tenantId,
      itemIdHint: report.itemId,
      suspendStore: body.suspendStore,
      reasonNote: body.resolutionNotes || report.reason,
      reportId: report.id,
    });

    const now = new Date();
    const note =
      body.resolutionNotes ||
      `Removed image from ${result.itemsUpdated} item(s) and ${result.settingsCleared} store branding field(s)${
        result.r2Deleted ? " + purged R2 file" : ""
      }${result.storeSuspended ? " + suspended store" : ""}.`;

    await db
      .update(copyrightReports)
      .set({
        status: "TAKEN_DOWN",
        resolutionNotes: note,
        resolvedBy: "SUPER_ADMIN",
        resolvedAt: now,
      })
      .where(eq(copyrightReports.id, reportId));

    return c.json({
      success: true,
      message: note,
      data: { reportId, ...result },
    });
  }
);

platformAdminRouter.post(
  "/copyright-reports/:id/dismiss",
  zValidator("json", dismissReportSchema),
  async (c) => {
    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const reportId = c.req.param("id");
    const body = c.req.valid("json");
    const db = createDb(c.env.DB);

    const [report] = await db
      .select({ id: copyrightReports.id })
      .from(copyrightReports)
      .where(eq(copyrightReports.id, reportId))
      .limit(1);

    if (!report) {
      throw new AppError("Copyright report not found.", 404, "REPORT_NOT_FOUND");
    }

    await db
      .update(copyrightReports)
      .set({
        status: "DISMISSED",
        resolutionNotes: body.resolutionNotes || "Dismissed after Super Admin review.",
        resolvedBy: "SUPER_ADMIN",
        resolvedAt: new Date(),
      })
      .where(eq(copyrightReports.id, reportId));

    return c.json({
      success: true,
      message: "Copyright report marked as dismissed.",
    });
  }
);

platformAdminRouter.post(
  "/media/takedown",
  zValidator("json", directMediaTakedownSchema),
  async (c) => {
    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const body = c.req.valid("json");
    const db = createDb(c.env.DB);

    let tenantIdHint: string | null = null;
    if (body.storeSubdomain) {
      const cleaned = sanitizeSubdomain(body.storeSubdomain);
      if (cleaned) {
        const [tenantRow] = await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.subdomain, cleaned))
          .limit(1);
        tenantIdHint = tenantRow?.id || null;
      }
    }

    const result = await executeImageTakedown(db, c.env.MEDIA_BUCKET, {
      reportedImageUrl: body.reportedImageUrl,
      tenantIdHint,
      suspendStore: body.suspendStore,
      reasonNote: body.resolutionNotes || "Direct Super Admin copyright takedown.",
    });

    const mediaRef = extractMediaReference(body.reportedImageUrl);
    const openReports = await db
      .select()
      .from(copyrightReports)
      .where(eq(copyrightReports.status, "OPEN"));

    const now = new Date();
    for (const openRep of openReports) {
      if (matchesReportedImage(openRep.reportedImageUrl, body.reportedImageUrl, mediaRef)) {
        await db
          .update(copyrightReports)
          .set({
            status: "TAKEN_DOWN",
            resolutionNotes: body.resolutionNotes || "Resolved via direct Super Admin image takedown.",
            resolvedBy: "SUPER_ADMIN",
            resolvedAt: now,
          })
          .where(eq(copyrightReports.id, openRep.id));
      }
    }

    return c.json({
      success: true,
      message: `Image takedown executed (${result.itemsUpdated} item(s) updated, ${result.settingsCleared} branding field(s) cleared${
        result.r2Deleted ? ", R2 object deleted" : ""
      }${result.storeSuspended ? ", store suspended" : ""}).`,
      data: result,
    });
  }
);
