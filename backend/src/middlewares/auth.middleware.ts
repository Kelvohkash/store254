import type { MiddlewareHandler } from "hono";
import type { AppEnv, UserContext } from "../types/context";
import { verifyAccessToken, verifyCustomerSsoToken } from "../security/jwt";
import { AppError } from "../security/error-handler";
import { requireSecret } from "../security/secrets";
import { CUSTOMER_SESSION_COOKIE, getCookieValue } from "../security/session-cookie";
import { createDb } from "../db";
import { resolveGoogleCustomerForTenant } from "../services/google-customer-auth.service";

/**
 * Authentication Middleware
 * Enforces valid JWT token and verifies strict tenant isolation boundary
 */
export function authMiddleware(required = true): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const authHeader = c.req.header("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;
    const cookieToken = bearerToken ? null : getCookieValue(c.req.header("cookie"), CUSTOMER_SESSION_COOKIE);
    const token = bearerToken || cookieToken;

    if (!token) {
      if (required) {
        throw new AppError("Authentication required. Missing Bearer token.", 401, "UNAUTHORIZED");
      }
      return next();
    }

    const secret = requireSecret(c.env?.JWT_SECRET, "JWT_SECRET");

    // Obtain current tenant context if present
    const currentTenant = c.get("tenant");

    // Verify token and ensure it matches the current tenant (prevents cross-tenant token replay)
    let user = await verifyAccessToken(token, secret, currentTenant?.id);
    if (!user && cookieToken && currentTenant && c.env?.DB) {
      const googleUser = await verifyCustomerSsoToken(cookieToken, secret);
      if (googleUser) {
        user = await resolveGoogleCustomerForTenant(createDb(c.env.DB), currentTenant, googleUser);
      }
    }

    if (!user) {
      if (required) {
        throw new AppError("Invalid or expired authentication token.", 401, "INVALID_TOKEN");
      }
      return next();
    }

    if (cookieToken && !["GET", "HEAD", "OPTIONS"].includes(c.req.method.toUpperCase())) {
      const origin = c.req.header("origin");
      const primaryDomain = (c.env?.PRIMARY_DOMAIN || "store254.co.ke").toLowerCase();
      const allowedHosts = new Set([
        `${currentTenant?.subdomain}.${primaryDomain}`,
        currentTenant?.customDomain || "",
      ]);
      let originHost = "";
      try {
        const parsedOrigin = new URL(origin || "");
        if (parsedOrigin.protocol === "https:") originHost = parsedOrigin.host.toLowerCase();
        if (
          c.env?.ENVIRONMENT === "development" &&
          (["localhost", "127.0.0.1"].includes(parsedOrigin.hostname) ||
            parsedOrigin.hostname.endsWith(".localhost"))
        ) {
          originHost = parsedOrigin.host.toLowerCase();
          allowedHosts.add(originHost);
        }
      } catch {
        originHost = "";
      }
      if (!originHost || !allowedHosts.has(originHost)) {
        throw new AppError("The request origin is not allowed for this customer session.", 403, "INVALID_SESSION_ORIGIN");
      }
    }

    c.set("user", user);
    await next();
  };
}

/**
 * Role-Based Access Control (RBAC) Guard
 */
export function requireRole(allowedRoles: UserContext["role"][]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");

    if (!user) {
      throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
    }

    if (!allowedRoles.includes(user.role)) {
      throw new AppError(
        "You do not have sufficient permissions to access this resource.",
        403,
        "FORBIDDEN"
      );
    }

    await next();
  };
}
