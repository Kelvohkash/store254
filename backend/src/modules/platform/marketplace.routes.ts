import { Hono, type Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray, notLike, sql } from "drizzle-orm";
import type { AppEnv, UserContext } from "../../types/context";
import { createDb } from "../../db";
import { tenants } from "../../db/schema/tenants";
import { items, itemVariants } from "../../db/schema/items";
import { categories } from "../../db/schema/categories";
import { reviews } from "../../db/schema/reviews";
import { orders, orderItems, payments } from "../../db/schema/orders";
import { tenantPaymentConfigs } from "../../db/schema/payment-configs";
import {
  kenyaConstituencies,
  kenyaCounties,
  kenyaLocations,
} from "../../db/schema";
import { AppError } from "../../security/error-handler";
import { rateLimiter } from "../../security/rate-limiter";
import { hashOtp, timingSafeEqual } from "../../security/crypto";
import { verifyCustomerSsoToken } from "../../security/jwt";
import {
  CUSTOMER_SESSION_COOKIE,
  getCookieValue,
} from "../../security/session-cookie";
import type { GoogleTokenPayload } from "../../security/google-auth";
import { resolveGoogleCustomerForTenant } from "../../services/google-customer-auth.service";
import {
  checkoutSchema,
  createOrderForTenant,
} from "../orders/checkout.service";
import { sanitizePublicTenantSettings } from "./platform.routes";
import { sanitizePublicItemMetadata } from "../catalog/items.routes";
import { getStaticLocationById } from "./kenya-static-data";
import { resolveStorePinCoords } from "./locations.service";

export const marketplaceRouter = new Hono<AppEnv>();

const platformCheckoutSchema = z
  .object({
    storeId: z.string().trim().min(1, "Store ID is required."),
  })
  .and(checkoutSchema);

export async function readPlatformGoogleUser(
  c: Context<AppEnv>
): Promise<GoogleTokenPayload | null> {
  const jwtSecret = c.env?.JWT_SECRET;
  if (!jwtSecret) return null;
  const ssoToken = getCookieValue(
    c.req.header("cookie"),
    CUSTOMER_SESSION_COOKIE
  );
  if (!ssoToken) return null;
  try {
    return await verifyCustomerSsoToken(ssoToken, jwtSecret);
  } catch {
    return null;
  }
}

export function assertAllowedPlatformOrigin(c: Context<AppEnv>): void {
  const originHeader = c.req.header("origin") || c.req.header("referer");
  if (!originHeader) {
    if (c.req.header("sec-fetch-site") === "same-origin") {
      return;
    }
    throw new AppError("Origin is required for platform mutations.", 403, "FORBIDDEN_ORIGIN");
  }

  try {
    const parsed = new URL(originHeader);
    const primaryDomain = (c.env?.PRIMARY_DOMAIN || "store254.co.ke").toLowerCase();
    const isDev = c.env?.ENVIRONMENT === "development";
    const hostname = parsed.hostname.toLowerCase();

    if (
      isDev &&
      (hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.endsWith(".localhost"))
    ) {
      return;
    }

    const isAllowed =
      parsed.protocol === "https:" &&
      (hostname === primaryDomain || hostname === `www.${primaryDomain}`);

    if (!isAllowed) {
      throw new AppError("Origin is not authorized for platform requests.", 403, "FORBIDDEN_ORIGIN");
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Invalid request origin.", 403, "FORBIDDEN_ORIGIN");
  }
}

// 1. In-Page Quick-View Item Details (Zero Subdomain Hop)
marketplaceRouter.get(
  "/items/:id",
  rateLimiter({ max: 90, windowMs: 60 * 1000 }),
  async (c) => {
    const itemId = c.req.param("id");
    if (!c.env?.DB) throw new AppError("Database not ready.", 500);
    const db = createDb(c.env.DB);

    const [row] = await db
      .select({
        item: items,
        tenant: {
          id: tenants.id,
          name: tenants.name,
          subdomain: tenants.subdomain,
          customDomain: tenants.customDomain,
          businessType: tenants.businessType,
          currency: tenants.currency,
          status: tenants.status,
          settings: tenants.settings,
          locationId: tenants.locationId,
          locationLabel: tenants.locationLabel,
          countyId: tenants.countyId,
          constituencyId: tenants.constituencyId,
        },
        categoryName: categories.name,
      })
      .from(items)
      .innerJoin(tenants, eq(items.tenantId, tenants.id))
      .leftJoin(categories, eq(items.categoryId, categories.id))
      .where(
        and(
          eq(items.id, itemId),
          eq(items.status, "PUBLISHED"),
          eq(tenants.status, "ACTIVE"),
          notLike(tenants.id, "tenant-demo-%")
        )
      )
      .limit(1);

    if (!row) {
      throw new AppError("Product or service not found.", 404, "ITEM_NOT_FOUND");
    }

    const [variantsList, reviewsList, paymentRows, locationRows] = await Promise.all([
      db
        .select()
        .from(itemVariants)
        .where(
          and(
            eq(itemVariants.tenantId, row.tenant.id),
            eq(itemVariants.itemId, row.item.id)
          )
        ),
      db
        .select({
          id: reviews.id,
          customerName: reviews.customerName,
          rating: reviews.rating,
          comment: reviews.comment,
          isVerifiedBuyer: reviews.isVerifiedBuyer,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .where(
          and(
            eq(reviews.tenantId, row.tenant.id),
            eq(reviews.itemId, row.item.id)
          )
        )
        .orderBy(desc(reviews.createdAt))
        .limit(8),
      db
        .select({
          provider: tenantPaymentConfigs.provider,
          isEnabled: tenantPaymentConfigs.isEnabled,
        })
        .from(tenantPaymentConfigs)
        .where(
          and(
            eq(tenantPaymentConfigs.tenantId, row.tenant.id),
            eq(tenantPaymentConfigs.provider, "MPESA")
          )
        )
        .limit(1),
      row.tenant.locationId
        ? db
            .select({
              locationName: kenyaLocations.name,
              countyName: kenyaCounties.name,
              constituencyName: kenyaConstituencies.name,
              latitude: kenyaLocations.latitude,
              longitude: kenyaLocations.longitude,
            })
            .from(kenyaLocations)
            .leftJoin(kenyaCounties, eq(kenyaLocations.countyId, kenyaCounties.id))
            .leftJoin(
              kenyaConstituencies,
              eq(kenyaLocations.constituencyId, kenyaConstituencies.id)
            )
            .where(eq(kenyaLocations.id, row.tenant.locationId))
            .limit(1)
        : Promise.resolve([]),
    ]);

    const reviewCount = reviewsList.length;
    const avgRating =
      reviewCount > 0
        ? Math.round(
            (reviewsList.reduce((acc, r) => acc + r.rating, 0) / reviewCount) * 10
          ) / 10
        : 0;

    const rawSettings =
      row.tenant.settings &&
      typeof row.tenant.settings === "object" &&
      !Array.isArray(row.tenant.settings)
        ? (row.tenant.settings as Record<string, unknown>)
        : {};
    const settings = sanitizePublicTenantSettings(row.tenant.settings);
    const socialLinks =
      settings.socialLinks && typeof settings.socialLinks === "object"
        ? (settings.socialLinks as Record<string, unknown>)
        : {};
    const locMeta = locationRows[0];
    const mpesaEnabled = Boolean(paymentRows[0]?.isEnabled);

    let rawItemMeta: unknown = row.item.metadata;
    if (typeof rawItemMeta === "string") {
      try {
        rawItemMeta = JSON.parse(rawItemMeta);
      } catch {
        rawItemMeta = {};
      }
    }
    const itemMeta =
      rawItemMeta && typeof rawItemMeta === "object" && !Array.isArray(rawItemMeta)
        ? (rawItemMeta as Record<string, unknown>)
        : {};
    const isSingleListing = itemMeta.isSingleListing === true;
    const singleStaticLoc =
      isSingleListing && typeof itemMeta.locationId === "string"
        ? getStaticLocationById(itemMeta.locationId)
        : undefined;
    const singleSellerName =
      isSingleListing && typeof itemMeta.sellerName === "string" && itemMeta.sellerName.trim()
        ? itemMeta.sellerName.trim()
        : null;
    const singleSellerPhone =
      isSingleListing && typeof itemMeta.sellerPhone === "string" && itemMeta.sellerPhone.trim()
        ? itemMeta.sellerPhone.trim()
        : null;
    const singleSellerWhatsapp =
      isSingleListing && typeof itemMeta.sellerWhatsapp === "string" && itemMeta.sellerWhatsapp.trim()
        ? itemMeta.sellerWhatsapp.trim()
        : singleSellerPhone;
    const singleLocationLabel =
      isSingleListing && typeof itemMeta.locationLabel === "string" && itemMeta.locationLabel.trim()
        ? itemMeta.locationLabel.trim()
        : null;

    return c.json({
      success: true,
      data: {
        item: {
          id: row.item.id,
          title: row.item.title,
          slug: row.item.slug,
          description: row.item.description,
          itemType: row.item.itemType,
          basePrice: row.item.basePrice,
          compareAtPrice: row.item.compareAtPrice,
          trackInventory: row.item.trackInventory,
          stockQuantity: row.item.stockQuantity,
          images: row.item.images || [],
          attributes: row.item.attributes || {},
          metadata: sanitizePublicItemMetadata(itemMeta),
          categoryName: row.categoryName || null,
        },
        variants: variantsList,
        reviews: reviewsList,
        ratingSummary: {
          count: reviewCount,
          average: avgRating,
        },
        store: {
          id: row.tenant.id,
          name: singleSellerName || row.tenant.name,
          subdomain: row.tenant.subdomain,
          customDomain: row.tenant.customDomain,
          businessType: row.tenant.businessType,
          currency: row.tenant.currency || "KES",
          locationLabel:
            singleLocationLabel ||
            row.tenant.locationLabel ||
            locMeta?.locationName ||
            null,
          countyName: locMeta?.countyName || singleStaticLoc?.countyName || null,
          constituencyName: locMeta?.constituencyName || singleStaticLoc?.constituencyName || null,
          logoUrl:
            typeof settings.logoUrl === "string" ? settings.logoUrl : null,
          whatsapp: isSingleListing
            ? singleSellerWhatsapp
            : typeof socialLinks.whatsapp === "string"
            ? socialLinks.whatsapp
            : typeof rawSettings.whatsapp === "string"
            ? rawSettings.whatsapp
            : null,
          phone: isSingleListing
            ? singleSellerPhone
            : typeof settings.contactPhone === "string"
            ? settings.contactPhone
            : typeof rawSettings.phone === "string"
            ? rawSettings.phone
            : null,
          locationCoords: isSingleListing
            ? singleStaticLoc
              ? {
                  lat: singleStaticLoc.latitude,
                  lng: singleStaticLoc.longitude,
                  isExactPin: false,
                  label: singleLocationLabel || singleStaticLoc.name,
                  directionsNote: null,
                  physicalAddress: null,
                }
              : null
            : resolveStorePinCoords(
                row.tenant,
                locMeta
                  ? {
                      latitude: locMeta.latitude,
                      longitude: locMeta.longitude,
                      name: locMeta.locationName,
                    }
                  : null
              ),
          mpesaEnabled,
        },
      },
    });
  }
);

// 2. Platform-Wide Direct Checkout (Per Merchant Order, No Subdomain Hop)
marketplaceRouter.post(
  "/checkout",
  rateLimiter({ max: 20, windowMs: 60 * 1000 }),
  async (c, next) => {
    assertAllowedPlatformOrigin(c);
    await next();
  },
  zValidator("json", platformCheckoutSchema),
  async (c) => {
    const body = c.req.valid("json");
    if (!c.env?.DB) throw new AppError("Database not ready.", 500);
    const db = createDb(c.env.DB);

    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        subdomain: tenants.subdomain,
        currency: tenants.currency,
        status: tenants.status,
      })
      .from(tenants)
      .where(
        and(
          eq(tenants.id, body.storeId),
          eq(tenants.status, "ACTIVE"),
          notLike(tenants.id, "tenant-demo-%")
        )
      )
      .limit(1);

    if (!tenant) {
      throw new AppError(
        "This merchant store is no longer available.",
        404,
        "STORE_NOT_FOUND"
      );
    }

    let userContext: UserContext | null = null;
    const googleUser = await readPlatformGoogleUser(c);
    if (googleUser) {
      const resolved = await resolveGoogleCustomerForTenant(
        db,
        { id: tenant.id, status: tenant.status },
        googleUser
      );
      userContext = {
        id: resolved.id,
        tenantId: tenant.id,
        email: resolved.email,
        role: "CUSTOMER",
      };
    }

    const checkoutResult = await createOrderForTenant(
      db,
      c.env,
      tenant,
      userContext,
      body
    );

    return c.json(
      {
        success: true,
        message: checkoutResult.message,
        data: {
          ...checkoutResult.data,
          storeId: tenant.id,
          storeName: tenant.name,
          storeSubdomain: tenant.subdomain,
        },
      },
      201
    );
  }
);

// 3. Live Order & M-Pesa Payment Status Polling from Root Marketplace
marketplaceRouter.get(
  "/orders/:id/status",
  rateLimiter({ max: 60, windowMs: 60 * 1000 }),
  async (c) => {
    const orderId = c.req.param("id");
    const statusToken =
      c.req.query("token") || c.req.header("x-payment-status-token") || "";
    if (!c.env?.DB) throw new AppError("Database not ready.", 500);
    const db = createDb(c.env.DB);

    const [orderRow] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        paymentMethod: orders.paymentMethod,
        customerEmail: orders.customerEmail,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        storeName: tenants.name,
        storeSubdomain: tenants.subdomain,
      })
      .from(orders)
      .innerJoin(tenants, eq(orders.tenantId, tenants.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!orderRow) {
      throw new AppError("Order not found.", 404, "ORDER_NOT_FOUND");
    }

    const [latestPayment] = await db
      .select({
        id: payments.id,
        status: payments.status,
        mpesaReceiptNumber: payments.mpesaReceiptNumber,
        checkoutRequestId: payments.checkoutRequestId,
        statusTokenHash: payments.statusTokenHash,
      })
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt))
      .limit(1);

    const googleUser = await readPlatformGoogleUser(c);
    const matchesGoogleOwner =
      Boolean(googleUser?.email) &&
      googleUser!.email.toLowerCase() === orderRow.customerEmail.toLowerCase();

    let matchesToken = false;
    if (statusToken && latestPayment?.statusTokenHash) {
      matchesToken = timingSafeEqual(
        await hashOtp(statusToken),
        latestPayment.statusTokenHash
      );
    }

    if (!matchesToken && !matchesGoogleOwner) {
      throw new AppError("Order not found.", 404, "ORDER_NOT_FOUND");
    }

    return c.json({
      success: true,
      data: {
        orderId: orderRow.id,
        orderNumber: orderRow.orderNumber,
        status: orderRow.status,
        paymentStatus: orderRow.paymentStatus,
        paymentMethod: orderRow.paymentMethod,
        totalAmount: orderRow.totalAmount,
        currency: orderRow.currency,
        storeName: orderRow.storeName,
        storeSubdomain: orderRow.storeSubdomain,
        mpesaStatus: latestPayment?.status || null,
        mpesaReceiptNumber: latestPayment?.mpesaReceiptNumber || null,
      },
    });
  }
);

// 4. Unified Platform Buyer Orders Across All Store254 Merchants
marketplaceRouter.get(
  "/my-orders",
  rateLimiter({ max: 30, windowMs: 60 * 1000 }),
  async (c) => {
    const googleUser = await readPlatformGoogleUser(c);
    if (!googleUser) {
      throw new AppError(
        "Please sign in with Google to view your orders across Store254 shops.",
        401,
        "UNAUTHORIZED"
      );
    }

    if (!c.env?.DB) throw new AppError("Database not ready.", 500);
    const db = createDb(c.env.DB);
    const buyerEmail = googleUser.email.toLowerCase().trim();

    const orderRows = await db
      .select({
        id: orders.id,
        tenantId: orders.tenantId,
        orderNumber: orders.orderNumber,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        paymentMethod: orders.paymentMethod,
        subtotal: orders.subtotal,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        shippingAddress: orders.shippingAddress,
        fulfillmentDetails: orders.fulfillmentDetails,
        createdAt: orders.createdAt,
        storeName: tenants.name,
        storeSubdomain: tenants.subdomain,
      })
      .from(orders)
      .innerJoin(tenants, eq(orders.tenantId, tenants.id))
      .where(sql`lower(${orders.customerEmail}) = ${buyerEmail}`)
      .orderBy(desc(orders.createdAt))
      .limit(40);

    if (orderRows.length === 0) {
      return c.json({ success: true, data: [] });
    }

    const orderIds = orderRows.map((o) => o.id);
    const [allItems, allPayments] = await Promise.all([
      db
        .select({
          orderId: orderItems.orderId,
          title: orderItems.title,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
          totalPrice: orderItems.totalPrice,
        })
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds)),
      db
        .select({
          orderId: payments.orderId,
          status: payments.status,
          mpesaReceiptNumber: payments.mpesaReceiptNumber,
        })
        .from(payments)
        .where(inArray(payments.orderId, orderIds)),
    ]);

    const itemsByOrder = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const bucket = itemsByOrder.get(item.orderId) || [];
      bucket.push(item);
      itemsByOrder.set(item.orderId, bucket);
    }

    const paymentByOrder = new Map<string, (typeof allPayments)[number]>();
    for (const pay of allPayments) {
      if (!paymentByOrder.has(pay.orderId) || pay.mpesaReceiptNumber) {
        paymentByOrder.set(pay.orderId, pay);
      }
    }

    return c.json({
      success: true,
      data: orderRows.map((order) => {
        const pay = paymentByOrder.get(order.id);
        return {
          ...order,
          mpesaReceiptNumber: pay?.mpesaReceiptNumber || null,
          items: itemsByOrder.get(order.id) || [],
        };
      }),
    });
  }
);
