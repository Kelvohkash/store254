import { describe, it, expect } from "vitest";
import app from "../src/index";
import { createAccessToken, verifyAccessToken } from "../src/security/jwt";
import type { UserContext } from "../src/types/context";

describe("Store254 End-to-End Workflow & Security Tests", () => {
  const jwtSecret = "test-jwt-secret-key-12345678901234567890";
  const adminUsername = "test-superadmin";
  const adminPassword = "test-superadmin-password-123456";

  const mockEnv = {
    PRIMARY_DOMAIN: "store254.co.ke",
    MPESA_CALLBACK_SECRET: "test-callback-secret",
    ENVIRONMENT: "development" as const,
    JWT_SECRET: jwtSecret,
    PLATFORM_ADMIN_USERNAME: adminUsername,
    PLATFORM_ADMIN_PASSWORD: adminPassword,
    PLATFORM_ADMIN_JWT_SECRET: "test-platform-admin-jwt-secret-1234567890",
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

  it("should reject Super Admin routes without an authenticated session", async () => {
    const res = await app.request(
      "https://store254.co.ke/api/platform/admin/stores",
      { headers: { Origin: "https://store254.co.ke" } },
      mockEnv as any
    );
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED_ADMIN");
  });

  it("should reject admin reads from tenant storefront origins", async () => {
    const res = await app.request(
      "https://store254.co.ke/api/platform/admin/stores",
      { headers: { Origin: "https://alice.store254.co.ke" } },
      mockEnv as any
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_ORIGIN");
  });

  it("should issue an HttpOnly session cookie for username/password admin login", async () => {
    const res = await app.request(
      "https://store254.co.ke/api/platform/admin/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
        },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      },
      mockEnv as any
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    expect(res.headers.get("set-cookie")).toContain("SameSite=Strict");
    expect(res.headers.get("set-cookie")).not.toContain("Domain=");
    const body = await res.json();
    expect(body.data.username).toBe(adminUsername);
    expect(JSON.stringify(body)).not.toContain(adminPassword);

    const cookie = res.headers.get("set-cookie")?.split(";")[0];
    const statusRes = await app.request(
      "https://store254.co.ke/api/platform/admin/me",
      { headers: { Origin: "https://store254.co.ke", Cookie: cookie || "" } },
      mockEnv as any
    );
    const statusBody = await statusRes.json();
    expect(statusBody.authenticated).toBe(true);
    expect(statusBody.user.username).toBe(adminUsername);
  });

  it("should reject admin login requests from untrusted origins", async () => {
    const res = await app.request(
      "https://store254.co.ke/api/platform/admin/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://attacker.pages.dev",
        },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      },
      mockEnv as any
    );

    expect(res.status).toBe(403);
  });

  it("should fail closed when no valid username/password pair is provided", async () => {
    const res = await app.request(
      "https://store254.co.ke/api/platform/admin/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
        },
        body: JSON.stringify({ username: "wrong-user", password: "wrong-password" }),
      },
      mockEnv as any
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED_ADMIN");
  });

  it("should fail closed when platform admin credentials are not configured", async () => {
    const res = await app.request(
      "https://store254.co.ke/api/platform/admin/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
        },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      },
      { ...mockEnv, PLATFORM_ADMIN_USERNAME: undefined, PLATFORM_ADMIN_PASSWORD: undefined } as any
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("ADMIN_AUTH_NOT_CONFIGURED");
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

  it("should escape HTML and redact OTPs in EmailService console logs", async () => {
    const { EmailService } = await import("../src/services/email.service");
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));
    try {
      await EmailService.sendPasswordResetOtp({
        to: "user@example.com",
        fullName: '<script>alert("xss")</script>',
        otpCode: "987654",
        expiresMinutes: 15,
      });
    } finally {
      console.log = origLog;
    }

    const combined = logs.join("\n");
    expect(combined).toContain("[REDACTED]");
    expect(combined).not.toContain("987654");
    expect(combined).not.toContain('<script>alert("xss")</script>');
  });

  it("should extract SMTP credentials from Worker bindings and skip SMTP cleanly when unconfigured", async () => {
    const { EmailService } = await import("../src/services/email.service");
    const creds = EmailService.smtpFromEnv({
      GMAIL_SMTP_USER: "mailer@example.com",
      GMAIL_SMTP_PASS: "example-app-pass",
      GMAIL_SENDER: "Store254 <noreply@example.com>",
    });
    expect(creds).toEqual({
      user: "mailer@example.com",
      pass: "example-app-pass",
      sender: "Store254 <noreply@example.com>",
    });

    const origVitest = process.env.VITEST;
    const origNodeEnv = process.env.NODE_ENV;
    const origUser = process.env.GMAIL_SMTP_USER;
    const origPass = process.env.GMAIL_SMTP_PASS;
    const warnings: string[] = [];
    const logs: string[] = [];
    const origWarn = console.warn;
    const origLog = console.log;
    console.warn = (...args: unknown[]) => warnings.push(args.join(" "));
    console.log = (...args: unknown[]) => logs.push(args.join(" "));

    try {
      delete process.env.VITEST;
      delete process.env.NODE_ENV;
      delete process.env.GMAIL_SMTP_USER;
      delete process.env.GMAIL_SMTP_PASS;

      const sent = await EmailService.sendPasswordResetLink({
        to: "owner@example.com",
        fullName: "Test Owner",
        resetLink: "https://store254.co.ke/admin.html?reset_token=tok123",
        otpCode: "112233",
        expiresMinutes: 30,
        smtp: EmailService.smtpFromEnv({}),
      });

      expect(sent).toBe(true);
      expect(warnings.some((w) => w.includes("Gmail SMTP not configured"))).toBe(true);
      expect(logs.join("\n")).toContain("[REDACTED]");
      expect(logs.join("\n")).not.toContain("112233");
    } finally {
      console.warn = origWarn;
      console.log = origLog;
      if (origVitest !== undefined) process.env.VITEST = origVitest;
      if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
      if (origUser !== undefined) process.env.GMAIL_SMTP_USER = origUser;
      if (origPass !== undefined) process.env.GMAIL_SMTP_PASS = origPass;
    }
  });

  it("should require County, Constituency, and Town/Shopping Centre on store registration", async () => {
    const res = await app.request(
      "https://store254.co.ke/api/platform/register-store",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
        },
        body: JSON.stringify({
          storeName: "Test Shop",
          subdomain: "testshopke99",
          businessType: "GENERAL",
          ownerEmail: "owner@testshopke.co.ke",
          ownerPassword: "StrongPassword123!",
          ownerFullName: "Jane Wanjiku",
        }),
      },
      mockEnv as any
    );

    expect(res.status).toBe(400);
  });

  it("should report Google Maps configuration status and fail closed when API key is missing", async () => {
    const statusWithoutKey = await app.request(
      "https://store254.co.ke/api/platform/locations/google-status",
      {},
      mockEnv as any
    );
    expect(statusWithoutKey.status).toBe(200);
    const bodyWithoutKey = await statusWithoutKey.json();
    expect(bodyWithoutKey.googleMapsConfigured).toBe(false);

    const statusWithKey = await app.request(
      "https://store254.co.ke/api/platform/locations/google-status",
      {},
      { ...mockEnv, GOOGLE_MAPS_API_KEY: "test-key" } as any
    );
    expect(statusWithKey.status).toBe(200);
    const bodyWithKey = await statusWithKey.json();
    expect(bodyWithKey.googleMapsConfigured).toBe(true);

    const autoRes = await app.request(
      "https://store254.co.ke/api/platform/locations/google-autocomplete",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "Sarit Centre" }),
      },
      mockEnv as any
    );
    expect(autoRes.status).toBe(503);
  });

  it("should compute accurate Haversine distances and include GMP Solution ID", async () => {
    const { haversineKm, slugifyLocation, GOOGLE_MAPS_SOLUTION_ID } = await import(
      "../src/modules/platform/locations.service"
    );

    expect(GOOGLE_MAPS_SOLUTION_ID).toBe("gmp_git_agentskills_v1");
    expect(slugifyLocation("Murang'a South Centre")).toBe("muranga-south-centre");

    // Westlands (-1.2647, 36.8019) to Nairobi CBD (-1.2833, 36.8167) ~ 2.6 km
    const dist = haversineKm(-1.2647, 36.8019, -1.2833, 36.8167);
    expect(dist).toBeGreaterThan(2.0);
    expect(dist).toBeLessThan(3.5);
  });

  it("should require Google sign-in before store creation and reject mismatched ownerEmail", async () => {
    const validRegistrationBody = {
      storeName: "Test Verified Shop",
      subdomain: "verifiedshopke99",
      businessType: "GENERAL",
      ownerEmail: "verified.owner@gmail.com",
      ownerPassword: "StrongPassword123!",
      ownerFullName: "Jane Wanjiku",
      countyId: "county-nairobi",
      customLocationName: "Westlands Market",
    };

    // Unauthenticated call without Google SSO cookie must fail with 401 GOOGLE_AUTH_REQUIRED
    const unauthRes = await app.request(
      "https://store254.co.ke/api/platform/register-store",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
        },
        body: JSON.stringify(validRegistrationBody),
      },
      mockEnv as any
    );
    expect(unauthRes.status).toBe(401);
    const unauthJson = (await unauthRes.json()) as any;
    expect(unauthJson.error.code).toBe("GOOGLE_AUTH_REQUIRED");

    // Authenticated Google user trying to register with a different email must fail with 403 EMAIL_MISMATCH
    const { createCustomerSsoToken } = await import("../src/security/jwt");
    const { CUSTOMER_SESSION_COOKIE } = await import("../src/security/session-cookie");
    const ssoToken = await createCustomerSsoToken(
      {
        sub: "google-sub-123",
        email: "signedin.user@gmail.com",
        email_verified: true,
        name: "Signed In Owner",
      },
      jwtSecret,
      3600
    );

    const mismatchRes = await app.request(
      "https://store254.co.ke/api/platform/register-store",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
          Cookie: `${CUSTOMER_SESSION_COOKIE}=${ssoToken}`,
        },
        body: JSON.stringify(validRegistrationBody),
      },
      mockEnv as any
    );
    expect(mismatchRes.status).toBe(403);
    const mismatchJson = (await mismatchRes.json()) as any;
    expect(mismatchJson.error.code).toBe("EMAIL_MISMATCH");
  });
});
