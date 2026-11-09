import { describe, expect, it } from "vitest";
import { parseTenantReturnTo } from "../src/modules/auth/google-gateway.routes";
import { customerSessionCookie, clearCustomerSessionCookie } from "../src/security/session-cookie";
import { createCustomerSsoToken, verifyCustomerSsoToken } from "../src/security/jwt";
import app from "../src/index";

describe("central Google OAuth gateway", () => {
  it("only accepts HTTPS storefront subdomains on the platform domain", () => {
    expect(parseTenantReturnTo("https://alice.store254.co.ke/cart", "store254.co.ke")?.tenantSlug).toBe("alice");
    expect(parseTenantReturnTo("http://alice.store254.co.ke/", "store254.co.ke")).toBeNull();
    expect(parseTenantReturnTo("https://alice.store254.co.ke.attacker.example/", "store254.co.ke")).toBeNull();
    expect(parseTenantReturnTo("https://attacker.example/", "store254.co.ke")).toBeNull();
    expect(parseTenantReturnTo("https://alice.store254.co.ke.evil/", "store254.co.ke")).toBeNull();
    expect(parseTenantReturnTo("https://alice.store254.co.ke:8443/", "store254.co.ke")).toBeNull();
    expect(parseTenantReturnTo("https://alice.store254.co.ke@attacker.example/", "store254.co.ke")).toBeNull();
    expect(parseTenantReturnTo("https://a.store254.co.ke/", "store254.co.ke")).toBeNull();
    expect(parseTenantReturnTo("https://admin.store254.co.ke/", "store254.co.ke")).toBeNull();
  });

  it("creates and expires a secure wildcard-domain session cookie", () => {
    const cookie = customerSessionCookie("signed-token", "store254.co.ke", 3600);
    expect(cookie).toContain("__Secure-store254_sso=");
    expect(cookie).toContain("Domain=.store254.co.ke");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(clearCustomerSessionCookie("store254.co.ke")).toContain("Max-Age=0");
  });

  it("verifies the shared SSO identity without assigning it to a single tenant", async () => {
    const secret = "test-google-sso-secret-long-enough";
    const googleUser = {
      sub: "google-user-id",
      email: "customer@example.com",
      emailVerified: true,
      name: "Store Customer",
      picture: "https://example.com/avatar.png",
    };
    const token = await createCustomerSsoToken(googleUser, secret, 3600);

    await expect(verifyCustomerSsoToken(token, secret)).resolves.toMatchObject({
      sub: googleUser.sub,
      email: googleUser.email,
      emailVerified: true,
      name: googleUser.name,
    });
    await expect(verifyCustomerSsoToken(token, "wrong-secret")).resolves.toBeNull();
  });

  it("fails closed until both centralized OAuth credentials are configured", async () => {
    const response = await app.request(
      "https://store254.co.ke/auth/google/login?return_to=https%3A%2F%2Falice.store254.co.ke%2F",
      {},
      {
        PRIMARY_DOMAIN: "store254.co.ke",
        ENVIRONMENT: "development",
      } as any
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "GOOGLE_AUTH_NOT_CONFIGURED" },
    });
  });
});
