import type { MiddlewareHandler } from "hono";
import type { AppEnv, UserContext } from "../types/context";
import { verifyAccessToken } from "../security/jwt";
import { AppError } from "../security/error-handler";

/**
 * Authentication Middleware
 * Enforces valid JWT token and verifies strict tenant isolation boundary
 */
export function authMiddleware(required = true): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const authHeader = c.req.header("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      if (required) {
        throw new AppError("Authentication required. Missing Bearer token.", 401, "UNAUTHORIZED");
      }
      return next();
    }

    const token = authHeader.substring(7).trim();
    const secret = c.env.JWT_SECRET || "default-dev-secret-change-in-production";

    // Obtain current tenant context if present
    const currentTenant = c.get("tenant");

    // Verify token and ensure it matches the current tenant (prevents cross-tenant token replay)
    const user = await verifyAccessToken(token, secret, currentTenant?.id);

    if (!user) {
      if (required) {
        throw new AppError("Invalid or expired authentication token.", 401, "INVALID_TOKEN");
      }
      return next();
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
