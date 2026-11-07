import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, sql, like, or } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { tenants } from "../../db/schema/tenants";
import { users } from "../../db/schema/users";
import { items } from "../../db/schema/items";
import { orders } from "../../db/schema/orders";
import { tenantPaymentConfigs } from "../../db/schema/payment-configs";
import { AppError } from "../../security/error-handler";
import { timingSafeEqual } from "../../security/crypto";
import { EmailService } from "../../services/email.service";

export const platformAdminRouter = new Hono<AppEnv>();

// Super Admin Authentication Guard (API Key or Master Secret)
platformAdminRouter.use("*", async (c, next) => {
  const adminKey = c.req.header("x-admin-key") || c.req.header("authorization")?.replace("Bearer ", "");
  const expectedKey = c.env?.ADMIN_API_KEY || "store254-superadmin-secret-key-change-in-prod";

  if (!adminKey || !timingSafeEqual(adminKey, expectedKey)) {
    throw new AppError("Super Admin authentication failed. Invalid or missing admin key.", 401, "UNAUTHORIZED_ADMIN");
  }

  await next();
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

  return c.json({
    success: true,
    data: storeList,
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
  const itemList = await db.select({ id: items.id }).from(items).where(eq(items.tenantId, store.id));
  const orderList = await db.select({ id: orders.id, total: orders.totalAmount, status: orders.status }).from(orders).where(eq(orders.tenantId, store.id));

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

// 5. Delete Store (Permanent Cascade)
platformAdminRouter.delete("/stores/:id", async (c) => {
  const storeId = c.req.param("id");
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);

  const [store] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, storeId))
    .limit(1);

  if (!store) {
    throw new AppError("Store not found.", 404, "STORE_NOT_FOUND");
  }

  // Deleting tenant cascades to all categories, items, orders, users, and payments
  await db.delete(tenants).where(eq(tenants.id, storeId));

  return c.json({
    success: true,
    message: `Store "${store.name}" and all associated data permanently deleted.`,
  });
});

// 6. Platform Overview & Metrics
platformAdminRouter.get("/stats", async (c) => {
  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);

  const allStores = await db.select({ status: tenants.status }).from(tenants);
  const allOrders = await db.select({ totalAmount: orders.totalAmount, status: orders.status }).from(orders);

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
