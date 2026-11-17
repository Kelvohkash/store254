import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "./types/context";
import { SECURITY_LIMITS } from "./config/constants";

// Security Frameworks
import { enterpriseSecurityHeaders } from "./security/headers";
import { multiTenantCors } from "./security/cors";
import { rateLimiter } from "./security/rate-limiter";
import { globalErrorHandler, notFoundHandler } from "./security/error-handler";

// Middlewares
import { requestIdMiddleware } from "./middlewares/request-id.middleware";
import { tenantMiddleware } from "./middlewares/tenant.middleware";

// Feature Modules
import { platformRouter, sanitizePublicTenantSettings } from "./modules/platform/platform.routes";
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
import { isSafeMediaSegment, tenantSettingsRouter } from "./modules/tenant/tenant.routes";
import { tenantBillingRouter } from "./modules/tenant/billing.routes";
import { seoPlatformRouter, seoTenantRouter } from "./modules/seo/seo.routes";

const app = new Hono<AppEnv>();

const defaultBodyLimit = bodyLimit({
  maxSize: SECURITY_LIMITS.MAX_BODY_BYTES,
  onError: (c) =>
    c.json(
      {
        success: false,
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "Request payload exceeds the 1 MB maximum size.",
        },
      },
      413
    ),
});

// 1. Global Correlation ID & Request Tracking
app.use("*", requestIdMiddleware());

// 2. OWASP-Grade Enterprise Security Headers
app.use("*", enterpriseSecurityHeaders());

// 3. Dynamic Multi-Tenant CORS Engine
app.use("*", multiTenantCors());

// 4. Global Anti-Abuse Rate Limiter
app.use("*", rateLimiter());

// 5. Global Request Body Size Limit (1 MB default; media upload route enforces 6 MB)
app.use("*", async (c, next) => {
  if (c.req.path === "/api/store/settings/media") {
    return next();
  }
  return defaultBodyLimit(c, next);
});

// 6. Global Error & 404 Handlers
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
  const tenantId = c.req.param("tenantId");
  const fileName = c.req.param("fileName");
  if (!isSafeMediaSegment(tenantId) || !isSafeMediaSegment(fileName)) {
    return c.json(
      {
        success: false,
        error: { code: "INVALID_MEDIA_PATH", message: "Invalid media path." },
      },
      400
    );
  }
  if (!c.env?.MEDIA_BUCKET) {
    return c.json({ success: false, message: "Media storage not configured" }, 404);
  }
  const key = `${tenantId}/${fileName}`;
  const ifNoneMatch = c.req.header("if-none-match");
  const edgeCache = (caches as unknown as { default?: Cache }).default;
  const cacheKey = new Request(`https://media-cache.internal/v2/${key}`, { method: "GET" });

  if (edgeCache) {
    const cached = await edgeCache.match(cacheKey);
    if (cached && cached.status === 200 && cached.headers.get("content-length") !== "0") {
      const cachedEtag = cached.headers.get("etag");
      if (ifNoneMatch && cachedEtag && ifNoneMatch === cachedEtag) {
        return new Response(null, { status: 304, headers: new Headers(cached.headers) });
      }
      return new Response(c.req.method === "HEAD" ? null : cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: new Headers(cached.headers),
      });
    }
  }

  const object = await c.env.MEDIA_BUCKET.get(key);
  if (!object) {
    return c.json({ success: false, message: "Media file not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  headers.set("cross-origin-resource-policy", "cross-origin");
  headers.set("access-control-allow-origin", "*");
  headers.set("accept-ranges", "bytes");
  if (typeof object.size === "number") {
    headers.set("content-length", String(object.size));
  }

  if (ifNoneMatch && ifNoneMatch === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  const response = new Response(object.body, { headers });
  if (edgeCache && c.req.method === "GET") {
    c.executionCtx?.waitUntil?.(edgeCache.put(cacheKey, response.clone()));
  }
  if (c.req.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  return response;
});

// -------------------------------------------------------------
// Tenant-Scoped Endpoints (Requires Subdomain or X-Tenant-Slug)
// -------------------------------------------------------------
const tenantScope = new Hono<AppEnv>();
tenantScope.use("*", tenantMiddleware({ required: true }));

// Storefront public metadata
tenantScope.get("/store", (c) => {
  const tenant = c.get("tenant")!;
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  return c.json({
    success: true,
    data: {
      ...tenant,
      settings: sanitizePublicTenantSettings(tenant.settings),
    },
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
