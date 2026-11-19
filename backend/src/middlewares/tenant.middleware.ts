import type { MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv, TenantContext } from "../types/context";
import { createDb } from "../db";
import { tenants } from "../db/schema/tenants";
import { AppError } from "../security/error-handler";
import { sanitizeSubdomain } from "../security/sanitize";

export interface TenantMiddlewareOptions {
  required?: boolean;
}

export interface TenantLookup {
  resolvedSubdomain: string | null;
  resolvedCustomDomain: string | null;
}

/**
 * The API is hosted on a shared hostname, so browser storefront requests must
 * identify their tenant with X-Tenant-Slug. Direct storefront-host requests
 * continue to resolve from Host and cannot be overridden by that header.
 */
export function resolveTenantLookup(
  hostname: string,
  primaryDomain: string,
  requestedSlug: string | undefined,
  isDevelopment = true
): TenantLookup {
  const normalizedHost = hostname.toLowerCase();
  const normalizedDomain = primaryDomain.toLowerCase();
  const apiHost = `api.${normalizedDomain}`;
  const isAnyLocalHost =
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost.endsWith(".localhost");
  const isLocalHost = isDevelopment && isAnyLocalHost;
  const isSharedApiHost =
    normalizedHost === apiHost ||
    normalizedHost === "api.internal";

  // Shared API requests (including internal worker service bindings) and local dev
  // identify the tenant via X-Tenant-Slug.
  if ((isSharedApiHost || isLocalHost) && requestedSlug) {
    return {
      resolvedSubdomain: sanitizeSubdomain(requestedSlug),
      resolvedCustomDomain: null,
    };
  }

  // Local development subdomains without explicit selector (e.g. alicebabycare.localhost)
  if (isDevelopment && normalizedHost.endsWith(".localhost")) {
    const localSub = normalizedHost.slice(0, -".localhost".length);
    if (localSub && localSub !== "www" && localSub !== "api") {
      return {
        resolvedSubdomain: sanitizeSubdomain(localSub),
        resolvedCustomDomain: null,
      };
    }
    return { resolvedSubdomain: null, resolvedCustomDomain: null };
  }

  const suffix = `.${normalizedDomain}`;
  if (normalizedHost.endsWith(suffix)) {
    return {
      resolvedSubdomain: sanitizeSubdomain(normalizedHost.slice(0, -suffix.length)),
      resolvedCustomDomain: null,
    };
  }

  if (
    normalizedHost &&
    normalizedHost !== normalizedDomain &&
    normalizedHost !== "api.internal" &&
    !isAnyLocalHost
  ) {
    return { resolvedSubdomain: null, resolvedCustomDomain: normalizedHost };
  }

  return { resolvedSubdomain: null, resolvedCustomDomain: null };
}

/**
 * Multi-Tenant Subdomain & Custom Domain Resolution Middleware
 * Resolves storefront-host requests from Host, and shared API requests from a
 * validated tenant slug header. Authentication still binds tenant tokens to
 * the resolved tenant ID, preventing cross-tenant token replay.
 */
export function tenantMiddleware(
  options: TenantMiddlewareOptions = { required: true }
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";
    const isDevelopment = c.env?.ENVIRONMENT === "development";
    // Resolve host: for internal worker-to-worker service binding calls (api.internal),
    // trust X-Forwarded-Host forwarded by our frontend edge worker.
    // For direct external calls, resolve strictly from Host to prevent header spoofing.
    const rawHostHeader = c.req.header("host") || new URL(c.req.url).host || "";
    const rawHostname = rawHostHeader.split(":")[0].toLowerCase();
    const isInternalServiceHost = rawHostname === "api.internal";
    const forwardedHost = c.req.header("x-forwarded-host");
    const hostname =
      isInternalServiceHost && forwardedHost
        ? forwardedHost.split(":")[0].toLowerCase()
        : rawHostname;

    const { resolvedSubdomain, resolvedCustomDomain } = resolveTenantLookup(
      hostname,
      primaryDomain,
      c.req.header("x-tenant-slug"),
      isDevelopment
    );

    // Root platform request (e.g. www.store254.co.ke, or platform landing/registration)
    if (!resolvedSubdomain && !resolvedCustomDomain) {
      if (options.required) {
        throw new AppError(
          "Tenant context required. Please access via a valid store subdomain.",
          400,
          "TENANT_REQUIRED"
        );
      }
      return next();
    }

    if (!c.env?.DB) {
      if (options.required) {
        throw new AppError("Database binding not initialized.", 500, "DB_NOT_INITIALIZED");
      }
      return next();
    }

    const db = createDb(c.env.DB);

    // Look up tenant safely in D1 database
    const queryCondition = resolvedSubdomain
      ? eq(tenants.subdomain, resolvedSubdomain)
      : eq(tenants.customDomain, resolvedCustomDomain!);

    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        subdomain: tenants.subdomain,
        customDomain: tenants.customDomain,
        businessType: tenants.businessType,
        currency: tenants.currency,
        status: tenants.status,
        locationId: tenants.locationId,
        locationLabel: tenants.locationLabel,
        settings: tenants.settings,
      })
      .from(tenants)
      .where(queryCondition)
      .limit(1);

    if (!tenant) {
      if (options.required) {
        throw new AppError(
          `Store "${resolvedSubdomain || resolvedCustomDomain}" was not found.`,
          404,
          "TENANT_NOT_FOUND"
        );
      }
      return next();
    }

    const requestPath = new URL(c.req.url).pathname;
    const requestMethod = c.req.method.toUpperCase();
    const restrictedStatusPath =
      (requestPath === "/api/auth/login" && requestMethod === "POST") ||
      (requestPath === "/api/auth/me" && requestMethod === "GET") ||
      (requestPath === "/api/auth/logout" && requestMethod === "POST") ||
      (requestPath === "/api/billing/subscription" && requestMethod === "GET") ||
      (requestPath === "/api/billing/subscription/payment-prompt" && requestMethod === "POST") ||
      (/^\/api\/billing\/subscription\/payments\/[^/]+$/.test(requestPath) && requestMethod === "GET");

    if ((tenant.status === "SUSPENDED" || tenant.status === "PENDING") && !restrictedStatusPath) {
      if (tenant.status === "PENDING") {
        throw new AppError(
          `The storefront "${tenant.name}" (${tenant.subdomain}.store254.co.ke) is pending activation. Store254 marketplace services remain online.`,
          403,
          "TENANT_PENDING",
          {
            storeName: tenant.name,
            subdomain: tenant.subdomain,
            customDomain: tenant.customDomain || null,
          }
        );
      }
      throw new AppError(
        `The storefront "${tenant.name}" (${tenant.subdomain}.store254.co.ke) is temporarily paused. Store254 marketplace services remain online.`,
        403,
        "TENANT_SUSPENDED",
        {
          storeName: tenant.name,
          subdomain: tenant.subdomain,
          customDomain: tenant.customDomain || null,
        }
      );
    }

    const tenantContext: TenantContext = {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      customDomain: tenant.customDomain,
      businessType: tenant.businessType,
      currency: tenant.currency,
      status: tenant.status,
      locationId: tenant.locationId ?? null,
      locationLabel: tenant.locationLabel ?? null,
      settings: (tenant.settings as Record<string, unknown>) || {},
    };

    c.set("tenant", tenantContext);
    c.set("subdomain", tenant.subdomain);

    await next();
  };
}
