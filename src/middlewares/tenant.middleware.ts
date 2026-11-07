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

/**
 * Multi-Tenant Subdomain & Custom Domain Resolution Middleware
 * Resolves tenant dynamically from Host header, X-Tenant-Slug, or query parameter
 */
export function tenantMiddleware(
  options: TenantMiddlewareOptions = { required: true }
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";
    const hostHeader = c.req.header("host") || "";
    const hostname = hostHeader.split(":")[0].toLowerCase();

    // 1. Try explicit header/query override (useful for developer testing and mobile apps)
    const explicitSlug =
      c.req.header("x-tenant-slug") || c.req.query("tenant") || c.req.header("x-custom-domain");

    let resolvedSubdomain: string | null = null;
    let resolvedCustomDomain: string | null = null;

    if (explicitSlug) {
      if (explicitSlug.includes(".")) {
        resolvedCustomDomain = explicitSlug.toLowerCase();
      } else {
        resolvedSubdomain = sanitizeSubdomain(explicitSlug);
      }
    } else if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      // 2. Extract subdomain from host: e.g. "alicebabycare.store254.co.ke"
      const suffix = `.${primaryDomain.toLowerCase()}`;
      if (hostname.endsWith(suffix)) {
        const extracted = hostname.slice(0, -suffix.length);
        resolvedSubdomain = sanitizeSubdomain(extracted);
      } else if (hostname !== primaryDomain.toLowerCase()) {
        // 3. Custom domain (e.g. "alicebabycare.com")
        resolvedCustomDomain = hostname;
      }
    }

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

    if (tenant.status === "SUSPENDED") {
      throw new AppError(
        "This store has been temporarily suspended. Please contact support.",
        403,
        "TENANT_SUSPENDED"
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
      settings: (tenant.settings as Record<string, unknown>) || {},
    };

    c.set("tenant", tenantContext);
    c.set("subdomain", tenant.subdomain);

    await next();
  };
}
