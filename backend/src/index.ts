import { Hono } from "hono";
import type { AppEnv } from "./types/context";

// Security Frameworks
import { enterpriseSecurityHeaders } from "./security/headers";
import { multiTenantCors } from "./security/cors";
import { rateLimiter } from "./security/rate-limiter";
import { globalErrorHandler, notFoundHandler } from "./security/error-handler";

// Middlewares
import { requestIdMiddleware } from "./middlewares/request-id.middleware";
import { tenantMiddleware } from "./middlewares/tenant.middleware";

// Feature Modules
import { platformRouter } from "./modules/platform/platform.routes";
import { platformAdminRouter } from "./modules/platform/admin.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { googleGatewayRouter } from "./modules/auth/google-gateway.routes";
import { categoriesRouter } from "./modules/catalog/categories.routes";
import { attributesRouter } from "./modules/catalog/attributes.routes";
import { itemsRouter } from "./modules/catalog/items.routes";
import { reviewsRouter } from "./modules/catalog/reviews.routes";
import { filtersRouter } from "./modules/filters/filters.routes";
import { ordersRouter } from "./modules/orders/orders.routes";
import { paymentSettingsRouter } from "./modules/payments/settings.routes";
import { mpesaRouter } from "./modules/payments/mpesa.routes";
import { tenantSettingsRouter } from "./modules/tenant/tenant.routes";
import { tenantBillingRouter } from "./modules/tenant/billing.routes";
import { seoPlatformRouter, seoTenantRouter } from "./modules/seo/seo.routes";

const app = new Hono<AppEnv>();

// 1. Global Correlation ID & Request Tracking
app.use("*", requestIdMiddleware());

// 2. OWASP-Grade Enterprise Security Headers
app.use("*", enterpriseSecurityHeaders());

// 3. Dynamic Multi-Tenant CORS Engine
app.use("*", multiTenantCors());

// 4. Global Anti-Abuse Rate Limiter
app.use("*", rateLimiter());

// 5. Global Error & 404 Handlers
app.onError(globalErrorHandler);
app.notFound(notFoundHandler);

// -------------------------------------------------------------
// Root Platform Endpoints (Public platform, no tenant needed)
// -------------------------------------------------------------

// API Root Status
app.get("/", (c) => {
  return c.json({
    service: "store254-backend-api",
    version: "1.0.0",
    status: "online",
    environment: c.env?.ENVIRONMENT || "production",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "store254-engine",
    environment: c.env?.ENVIRONMENT || "production",
    timestamp: new Date().toISOString(),
  });
});

// Platform registration, landing page, SEO discovery, and superadmin management
app.route("/api/platform/admin", platformAdminRouter);
app.route("/api/platform", seoPlatformRouter);
app.route("/api/platform", platformRouter);
app.route("/auth/google", googleGatewayRouter);

// Public Safaricom M-Pesa Callback Webhook (Not tied to a single tenant subdomain)
app.route("/api/payments/mpesa", mpesaRouter);

// Public R2 Media Serving Endpoint
app.get("/api/media/:tenantId/:fileName", async (c) => {
  if (!c.env?.MEDIA_BUCKET) {
    return c.json({ success: false, message: "Media storage not configured" }, 404);
  }
  const key = `${c.req.param("tenantId")}/${c.req.param("fileName")}`;
  const object = await c.env.MEDIA_BUCKET.get(key);
  if (!object) {
    return c.json({ success: false, message: "Media file not found" }, 404);
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
});

// -------------------------------------------------------------
// Tenant-Scoped Endpoints (Requires Subdomain or X-Tenant-Slug)
// -------------------------------------------------------------
const tenantScope = new Hono<AppEnv>();
tenantScope.use("*", tenantMiddleware({ required: true }));

// Storefront public metadata
tenantScope.get("/store", (c) => {
  const tenant = c.get("tenant")!;
  c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  return c.json({
    success: true,
    data: tenant,
  });
});

// Store Profile & Custom Domain Management (Owners/Admins)
tenantScope.route("/seo", seoTenantRouter);
tenantScope.route("/store/settings", tenantSettingsRouter);
tenantScope.route("/billing", tenantBillingRouter);

// Tenant Sub-routes
tenantScope.route("/auth", authRouter);
tenantScope.route("/categories", categoriesRouter);
tenantScope.route("/attributes", attributesRouter);
tenantScope.route("/items", itemsRouter);
tenantScope.route("/items", reviewsRouter);
tenantScope.route("/filters", filtersRouter);
tenantScope.route("/orders", ordersRouter);
tenantScope.route("/payments/settings", paymentSettingsRouter);

app.route("/api", tenantScope);

export default app;
