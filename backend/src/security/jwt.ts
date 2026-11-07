import { sign, verify } from "hono/jwt";
import { SECURITY_LIMITS } from "../config/constants";
import type { UserContext } from "../types/context";

export interface JWTPayload {
  sub: string; // user id
  tenantId: string;
  email: string;
  role: UserContext["role"];
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

const JWT_ISSUER = "store254-auth";
const JWT_AUDIENCE = "store254-api";

/**
 * Creates a signed JWT access token strictly bound to a tenant
 */
export async function createAccessToken(
  user: UserContext,
  secret: string,
  expiresInSeconds = SECURITY_LIMITS.ACCESS_TOKEN_EXPIRY_SECONDS
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    sub: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: now,
    exp: now + expiresInSeconds,
  };

  return await sign(payload, secret, "HS256");
}

/**
 * Validates a JWT access token and checks tenant boundary
 */
export async function verifyAccessToken(
  token: string,
  secret: string,
  expectedTenantId?: string
): Promise<UserContext | null> {
  try {
    const payload = (await verify(token, secret, "HS256")) as unknown as JWTPayload;

    // Validate claims
    if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return null;
    }

    // Cross-tenant protection: if expectedTenantId is provided, reject mismatched tokens
    if (expectedTenantId && payload.tenantId !== expectedTenantId) {
      return null;
    }

    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
