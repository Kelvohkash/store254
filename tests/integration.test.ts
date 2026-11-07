import { describe, it, expect } from "vitest";
import app from "../src/index";
import { createAccessToken, verifyAccessToken } from "../src/security/jwt";
import type { UserContext } from "../src/types/context";

describe("Store254 End-to-End Workflow & Security Tests", () => {
  const jwtSecret = "test-jwt-secret-key-12345678901234567890";
  const adminKey = "test-superadmin-key-123456";

  const mockEnv = {
    PRIMARY_DOMAIN: "store254.co.ke",
    MPESA_CALLBACK_SECRET: "test-callback-secret",
    ENVIRONMENT: "development" as const,
    JWT_SECRET: jwtSecret,
    ADMIN_API_KEY: adminKey,
  };

  it("should prevent cross-tenant JWT token reuse (Strict Tenant Isolation)", async () => {
    const userA: UserContext = {
      id: "user-101",
      tenantId: "tenant-alice-baby-care",
      email: "alice@store254.co.ke",
      role: "OWNER",
    };

    const tokenA = await createAccessToken(userA, jwtSecret);
    expect(tokenA).toBeDefined();

    const verifiedA = await verifyAccessToken(tokenA, jwtSecret, "tenant-alice-baby-care");
    expect(verifiedA).not.toBeNull();
    expect(verifiedA?.email).toBe(userA.email);

    // Malicious attempt to use Tenant A's token on Tenant B
    const crossTenantAttempt = await verifyAccessToken(tokenA, jwtSecret, "tenant-bob-electronics");
    expect(crossTenantAttempt).toBeNull();
  });

  it("should block reserved subdomains on platform onboarding", async () => {
    const reservedNames = ["admin", "api", "auth", "billing", "www", "store254", "support"];

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

  it("should reject Super Admin routes without valid X-Admin-Key", async () => {
    // Attempt to access admin stores list without key
    const res = await app.request("https://store254.co.ke/api/platform/admin/stores", {}, mockEnv as any);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED_ADMIN");
  });

  it("should block unauthorized M-Pesa callbacks lacking the security token", async () => {
    const res = await app.request(
      "https://store254.co.ke/api/payments/mpesa/callback",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Body: { stkCallback: { ResultCode: 0 } } }),
      },
      mockEnv as any
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ResultCode).toBe(1);
  });
});
