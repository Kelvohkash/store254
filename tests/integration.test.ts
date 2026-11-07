import { describe, it, expect } from "vitest";
import app from "../src/index";
import { createAccessToken, verifyAccessToken } from "../src/security/jwt";
import type { UserContext } from "../src/types/context";

describe("Store254 End-to-End Workflow & Security Tests", () => {
  const jwtSecret = "test-jwt-secret-key-12345678901234567890";
  const mockEnv = {
    PRIMARY_DOMAIN: "store254.co.ke",
    MPESA_CALLBACK_SECRET: "test-callback-secret",
    ENVIRONMENT: "development" as const,
    JWT_SECRET: jwtSecret,
  };

  it("should prevent cross-tenant JWT token reuse (Strict Tenant Isolation)", async () => {
    const userA: UserContext = {
      id: "user-101",
      tenantId: "tenant-alice-baby-care",
      email: "alice@store254.co.ke",
      role: "OWNER",
    };

    // Create token bound to Tenant A
    const tokenA = await createAccessToken(userA, jwtSecret);
    expect(tokenA).toBeDefined();

    // Verify token for Tenant A -> SUCCESS
    const verifiedA = await verifyAccessToken(tokenA, jwtSecret, "tenant-alice-baby-care");
    expect(verifiedA).not.toBeNull();
    expect(verifiedA?.email).toBe(userA.email);

    // Verify token for Tenant B (Malicious cross-tenant attempt) -> MUST BE REJECTED
    const crossTenantAttempt = await verifyAccessToken(tokenA, jwtSecret, "tenant-bob-electronics");
    expect(crossTenantAttempt).toBeNull();
  });

  it("should block reserved subdomains on platform registration", async () => {
    const reservedNames = ["admin", "api", "auth", "billing", "www", "store254"];

    for (const name of reservedNames) {
      const res = await app.request(
        `https://store254.co.ke/api/platform/check-subdomain?subdomain=${name}`,
        {},
        mockEnv as any
      );
      const body = await res.json();
      expect(body.data.available).toBe(false);
    }
  });

  it("should reject unauthenticated access to protected payment settings", async () => {
    // Attempt to access payment settings without Bearer token
    const res = await app.request(
      "https://alicebabycare.store254.co.ke/api/payments/settings",
      {
        headers: {
          "X-Tenant-Slug": "alicebabycare",
        },
      },
      mockEnv as any
    );

    // Without DB or unauthenticated -> safely rejects with non-200
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("should block unauthorized M-Pesa callbacks without secret token", async () => {
    // Safaricom callback webhook called without required token
    const res = await app.request(
      "https://store254.co.ke/api/payments/mpesa/callback",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Body: {
            stkCallback: {
              MerchantRequestID: "req-1",
              CheckoutRequestID: "ws_CO_123",
              ResultCode: 0,
            },
          },
        }),
      },
      mockEnv as any
    );

    // Must be rejected with 403 Forbidden
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ResultCode).toBe(1);
    expect(body.ResultDesc).toContain("Unauthorized");
  });
});
