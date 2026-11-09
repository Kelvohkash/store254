export const CUSTOMER_SESSION_COOKIE = "__Secure-store254_sso";

export function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim() || null;
  }
  return null;
}

export function customerSessionCookie(token: string, primaryDomain: string, maxAge: number): string {
  return `${CUSTOMER_SESSION_COOKIE}=${token}; Domain=.${primaryDomain}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCustomerSessionCookie(primaryDomain: string): string {
  return `${CUSTOMER_SESSION_COOKIE}=; Domain=.${primaryDomain}; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
