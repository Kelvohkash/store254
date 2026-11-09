import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types/context";

/**
 * Validates whether an origin is authorized
 */
function configuredOrigins(primaryDomain: string, configured: string | undefined): Set<string> {
  const defaults = [`https://${primaryDomain}`, `https://www.${primaryDomain}`];
  const origins = [...defaults, ...(configured || "").split(",")];

  return new Set(
    origins
      .map((value) => {
        try {
          return new URL(value.trim()).origin;
        } catch {
          return "";
        }
      })
      .filter(Boolean)
  );
}

function isAllowedOrigin(
  origin: string,
  primaryDomain: string,
  isDev: boolean,
  allowedOrigins: Set<string>
): boolean {
  if (!origin) return false;

  try {
    const url = new URL(origin);

    // Allow local development ports
    if (
      isDev &&
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname.endsWith(".localhost"))
    ) {
      return true;
    }

    // Must be HTTPS in production
    if (!isDev && url.protocol !== "https:") {
      return false;
    }

    if (allowedOrigins.has(url.origin)) return true;

    // Tenant storefront origins are single-level subdomains of the platform domain.
    const suffix = `.${primaryDomain}`;
    if (url.hostname.endsWith(suffix)) {
      const subdomain = url.hostname.slice(0, -suffix.length);
      // Valid subdomain format: alphanumeric, no nested dots
      return /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i.test(subdomain);
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Dynamic Multi-Tenant CORS Middleware
 */
export function multiTenantCors(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const primaryDomain = c.env?.PRIMARY_DOMAIN || "store254.co.ke";
    const isDev = c.env?.ENVIRONMENT === "development";
    const allowedOrigins = configuredOrigins(primaryDomain, c.env?.FRONTEND_ORIGINS);

    const origin = c.req.header("Origin") || "";
    if (isAllowedOrigin(origin, primaryDomain, isDev, allowedOrigins)) {
      // Reflect only validated storefront origins. Explicitly handling OPTIONS
      // keeps preflight requests outside tenant/auth middleware and guarantees
      // the same CORS headers on both success and error responses.
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Credentials", "true");
      c.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      c.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Request-ID, X-Tenant-Slug, X-Custom-Domain"
      );
      c.header("Access-Control-Expose-Headers", "X-Request-ID, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset");
      c.header("Access-Control-Max-Age", "86400");
      c.header("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers");

      if (c.req.method === "OPTIONS") {
        return c.body(null, 204);
      }
    }

    await next();
  };
}
