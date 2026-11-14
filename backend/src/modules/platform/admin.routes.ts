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

function assertAdminOrigin(c: Context<AppEnv>): void {
  const origin = c.req.header("origin");
  // Allow direct navigation or same-origin requests without explicit Origin header
  if (!origin) {
    const secFetchSite = c.req.header("sec-fetch-site");
    if (secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none") {
      return;
    }
  }

  if (origin) {
    try {
      const url = new URL(origin);
      const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";

      if (
        c.env?.ENVIRONMENT === "development" &&
        (url.hostname === "localhost" ||
          url.hostname === "127.0.0.1" ||
          url.hostname.endsWith(".localhost"))
      ) {
        return;
      }

      // Admin sessions may be initiated only from platform UI domains.
      if (
        (url.protocol === "https:" || c.env?.ENVIRONMENT === "development") &&
        (url.hostname === primaryDomain || url.hostname === `www.${primaryDomain}`)
      ) {
        return;
      }

      // Check additional configured frontend origins
      const configured = (c.env?.FRONTEND_ORIGINS || "").split(",").map((s) => s.trim());
      if (
        (url.protocol === "https:" || c.env?.ENVIRONMENT === "development") &&
        configured.includes(url.origin)
      ) {
        return;
      }
    } catch {
      throw new AppError("A valid platform origin is required.", 403, "INVALID_ORIGIN");
    }

    throw new AppError("A valid platform origin is required.", 403, "INVALID_ORIGIN");
  }

  const secFetchSite = c.req.header("sec-fetch-site");
  if (secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none") {
    return;
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
      const payload = await verify(token, jwtSecret, "HS256");
      if (payload && payload.role === "SUPER_ADMIN" && payload.iss === "store254-platform") {
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
  rateLimiter({ max: 15, windowMs: 15 * 60 * 1000 }),
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
        iss: "store254-platform",
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
      const payload = await verify(token, jwtSecret, "HS256");
      if (payload && payload.role === "SUPER_ADMIN" && payload.iss === "store254-platform") {
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

  if (search) {
    const q = search.toLowerCase();
    storeList = storeList.filter(
      (s) => s.name.toLowerCase().includes(q) || s.subdomain.toLowerCase().includes(q)
    );
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
  const ownerByTenant = new Map(owners.map((owner) => [owner.tenantId, owner]));

  return c.json({
    success: true,
    data: storeList.map((store) => {
      const owner = ownerByTenant.get(store.id);
      return {
        ...store,
        ownerPhone: owner?.phone || null,
        ownerEmail: owner?.email || null,
        ownerName: owner?.fullName || null,
      };
    }),
    pagination: {
      page,
      limit,
      count: storeList.length,
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

  return c.json({
    success: true,
    data: {
      store,
      owner,
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
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);
  const [settings] = await db
    .select()
    .from(platformBillingSettings)
    .where(eq(platformBillingSettings.id, "platform"))
    .limit(1);
  const darajaConfigured = Boolean(
    c.env.MPESA_CONSUMER_KEY && c.env.MPESA_CONSUMER_SECRET &&
    c.env.MPESA_PASSKEY && c.env.MPESA_SHORTCODE
  );

  return c.json({
    success: true,
    data: {
      amount: settings?.amount && settings.amount > 0 ? settings.amount : null,
      intervalMonths: 1,
      shortcodeType: settings?.shortcodeType || "PAYBILL",
      darajaConfigured,
      darajaMode: c.env.MPESA_IS_SANDBOX === "true" ? "SANDBOX" : "PRODUCTION",
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

  return c.json({ success: true, data: { encryptedConfigurations: updated } });
});
