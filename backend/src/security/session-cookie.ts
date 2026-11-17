import { SECURITY_LIMITS } from "../config/constants";

export const CUSTOMER_SESSION_COOKIE = "__Secure-store254_sso";
export const TENANT_SESSION_COOKIE = "__Host-store254_tenant_session";
export const DEV_TENANT_SESSION_COOKIE = "store254_tenant_session";

export function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim() || null;
  }
  return null;
}

export function getTenantSessionCookieName(isDevelopment = false): string {
  return isDevelopment ? DEV_TENANT_SESSION_COOKIE : TENANT_SESSION_COOKIE;
}

export function getTenantSessionCookieValue(cookieHeader: string | undefined): string | null {
  return (
    getCookieValue(cookieHeader, TENANT_SESSION_COOKIE) ||
    getCookieValue(cookieHeader, DEV_TENANT_SESSION_COOKIE)
  );
}

export function customerSessionCookie(token: string, primaryDomain: string, maxAge: number): string {
  return `${CUSTOMER_SESSION_COOKIE}=${token}; Domain=.${primaryDomain}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCustomerSessionCookie(primaryDomain: string): string {
  return `${CUSTOMER_SESSION_COOKIE}=; Domain=.${primaryDomain}; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function tenantSessionCookie(
  token: string,
  isDevelopment = false,
  maxAge = SECURITY_LIMITS.ACCESS_TOKEN_EXPIRY_SECONDS
): string {
  const cookieName = getTenantSessionCookieName(isDevelopment);
  if (isDevelopment) {
    return `${cookieName}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
  }
  return `${cookieName}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearTenantSessionCookie(isDevelopment = false): string {
  const cookieName = getTenantSessionCookieName(isDevelopment);
  if (isDevelopment) {
    return `${cookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  }
  return `${cookieName}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
