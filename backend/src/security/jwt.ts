import { sign, verify } from "hono/jwt";
import { SECURITY_LIMITS } from "../config/constants";
import type { UserContext } from "../types/context";
import type { GoogleTokenPayload } from "./google-auth";

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
const GOOGLE_SSO_ISSUER = "store254-google-sso";
const GOOGLE_SSO_AUDIENCE = "store254-storefronts";

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

export async function createCustomerSsoToken(
  googleUser: GoogleTokenPayload,
  secret: string,
  expiresInSeconds: number
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: googleUser.sub,
      email: googleUser.email,
      fullName: googleUser.name,
      avatarUrl: googleUser.picture || null,
      role: "CUSTOMER",
      iss: GOOGLE_SSO_ISSUER,
      aud: GOOGLE_SSO_AUDIENCE,
      iat: now,
      exp: now + expiresInSeconds,
    },
    secret,
    "HS256"
  );
}

export async function verifyCustomerSsoToken(
  token: string,
  secret: string
): Promise<GoogleTokenPayload | null> {
  try {
    const payload = (await verify(token, secret, "HS256")) as {
      sub?: string;
      email?: string;
      fullName?: string;
      avatarUrl?: string | null;
      role?: string;
      iss?: string;
      aud?: string;
      exp?: number;
    };
    if (
      payload.iss !== GOOGLE_SSO_ISSUER ||
      payload.aud !== GOOGLE_SSO_AUDIENCE ||
      payload.role !== "CUSTOMER" ||
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.fullName !== "string" ||
      !payload.exp ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: true,
      name: payload.fullName,
      picture: typeof payload.avatarUrl === "string" ? payload.avatarUrl : undefined,
    };
  } catch {
    return null;
  }
}
