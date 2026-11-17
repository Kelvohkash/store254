import type { MiddlewareHandler } from "hono";
import { and, eq } from "drizzle-orm";
import type { AppEnv, UserContext } from "../types/context";
import { verifyAccessToken, verifyCustomerSsoToken } from "../security/jwt";
import { AppError } from "../security/error-handler";
import { requireSecret } from "../security/secrets";
import {
  CUSTOMER_SESSION_COOKIE,
  getCookieValue,
  getTenantSessionCookieValue,
} from "../security/session-cookie";
import { createDb } from "../db";
import { users } from "../db/schema/users";
import { resolveGoogleCustomerForTenant } from "../services/google-customer-auth.service";

export const STAFF_PERMISSIONS = [
  "manage_products",
  "manage_categories",
  "manage_orders",
  "delete_orders",
  "manage_settings",
  "manage_payments",
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

/**
 * Reads assigned permission keys for a staff user from tenant.settings.staffPermissions.
 */
export function getStaffPermissions(
  tenantSettings: Record<string, unknown> | undefined | null,
  userId: string
): string[] {
  if (!tenantSettings || typeof tenantSettings !== "object") return [];
  const rawMap = (tenantSettings as Record<string, unknown>).staffPermissions;
  if (!rawMap || typeof rawMap !== "object") return [];
  const list = (rawMap as Record<string, unknown>)[userId];
  if (!Array.isArray(list)) return [];
  return list.filter(
    (p): p is string =>
      typeof p === "string" && (STAFF_PERMISSIONS as readonly string[]).includes(p)
  );
}

/**
 * Checks whether a user owns/admins the store or holds at least one required staff permission.
 */
export function hasPermission(
  user: UserContext | undefined,
  ...requiredPermissions: string[]
): boolean {
  if (!user) return false;
  if (user.role === "OWNER" || user.role === "ADMIN") return true;
  if (user.role !== "STAFF") return false;
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  if (perms.includes("*")) return true;
  if (requiredPermissions.length === 0) return true;
  return requiredPermissions.some((perm) => perms.includes(perm));
}

/**
 * Authentication Middleware
 * Enforces valid JWT token and verifies strict tenant isolation boundary
 */
export function authMiddleware(required = true): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const authHeader = c.req.header("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;
    const cookieHeader = c.req.header("cookie");
    const tenantCookieToken = bearerToken ? null : getTenantSessionCookieValue(cookieHeader);
    const ssoCookieToken = bearerToken ? null : getCookieValue(cookieHeader, CUSTOMER_SESSION_COOKIE);
    const customerSessionPath = [
      "/api/auth/me",
      "/api/orders/checkout",
      "/api/orders/my-orders",
    ].includes(c.req.path) || /^\/api\/orders\/[^/]+\/confirm-delivery$/.test(c.req.path);
    const cookieToken = customerSessionPath
      ? ssoCookieToken || tenantCookieToken
      : tenantCookieToken || ssoCookieToken;
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
    let accessUser = await verifyAccessToken(token, secret, currentTenant?.id);
    let user: UserContext | null = accessUser;
    let authenticatedViaAccessToken = Boolean(accessUser);

    if (!user && ssoCookieToken && currentTenant && c.env?.DB) {
      const googleUser = await verifyCustomerSsoToken(ssoCookieToken, secret);
      if (googleUser) {
        user = await resolveGoogleCustomerForTenant(createDb(c.env.DB), currentTenant, googleUser);
        authenticatedViaAccessToken = false;
      }
    }

    if (!user) {
      if (required) {
        throw new AppError("Invalid or expired authentication token.", 401, "INVALID_TOKEN");
      }
      return next();
    }

    // Verify live account status, tokenVersion revocation, and role permissions against D1
    if (currentTenant && c.env?.DB && authenticatedViaAccessToken) {
      const db = createDb(c.env.DB);
      const [userRecord] = await db
        .select({
          id: users.id,
          status: users.status,
          role: users.role,
          tokenVersion: users.tokenVersion,
        })
        .from(users)
        .where(and(eq(users.id, user.id), eq(users.tenantId, currentTenant.id)))
        .limit(1);

      if (!userRecord || userRecord.status !== "ACTIVE") {
        if (required) {
          throw new AppError(
            user.role === "STAFF"
              ? "Your staff account is inactive or no longer exists."
              : "Your account is inactive or no longer exists.",
            403,
            "ACCOUNT_INACTIVE"
          );
        }
        return next();
      }

      const tokenVer = Number(accessUser?.tokenVersion ?? 0);
      if (tokenVer !== userRecord.tokenVersion) {
        if (required) {
          throw new AppError(
            "Authentication token has been revoked. Please sign in again.",
            401,
            "INVALID_TOKEN"
          );
        }
        return next();
      }
    }

    if (user.role === "STAFF" && currentTenant) {
      user.permissions = getStaffPermissions(currentTenant.settings, user.id);
    } else if (user.role === "OWNER" || user.role === "ADMIN") {
      user.permissions = ["*"];
    }

    if (cookieToken && !["GET", "HEAD", "OPTIONS"].includes(c.req.method.toUpperCase())) {
      const origin = c.req.header("origin");
      const secFetchSite = c.req.header("sec-fetch-site");
      if (!origin && secFetchSite === "same-origin") {
        c.set("user", user);
        await next();
        return;
      }
      const primaryDomain = (c.env?.PRIMARY_DOMAIN || "store254.co.ke").toLowerCase();
      const allowedHosts = new Set<string>();
      if (currentTenant?.subdomain) {
        allowedHosts.add(`${currentTenant.subdomain}.${primaryDomain}`);
      }
      if (currentTenant?.customDomain) {
        allowedHosts.add(currentTenant.customDomain.toLowerCase());
      }
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

/**
 * Permission-Based Guard for Store Owners, Admins, and Permitted Staff
 */
export function requirePermission(...requiredPermissions: string[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");

    if (!user) {
      throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
    }

    if (!hasPermission(user, ...requiredPermissions)) {
      throw new AppError(
        "You do not have permission to perform this action.",
        403,
        "INSUFFICIENT_PERMISSIONS"
      );
    }

    await next();
  };
}
