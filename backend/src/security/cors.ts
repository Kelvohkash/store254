import { cors } from "hono/cors";
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
    if (isDev && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
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

    const corsMiddleware = cors({
      origin: (origin) => {
        if (!origin) return null;
        if (isAllowedOrigin(origin, primaryDomain, isDev, allowedOrigins)) {
          return origin;
        }
        return null;
      },
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-Request-ID",
        "X-Tenant-Slug",
        "X-Custom-Domain",
      ],
      exposeHeaders: ["X-Request-ID", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
      credentials: true,
      maxAge: 86400, // 24 hours preflight cache
    });

    return corsMiddleware(c, next);
  };
}
