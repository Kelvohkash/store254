import { describe, it, expect, beforeAll } from "vitest";
import app from "../src/index";
import { normalizeKenyanPhone } from "../src/security/mpesa";
import { hashPassword, verifyPassword, timingSafeEqual } from "../src/security/crypto";
import { sanitizeSubdomain } from "../src/security/sanitize";
import { Hono } from "hono";
import type { AppEnv } from "../src/types/context";
import { AppError } from "../src/security/error-handler";
import {
  STAFF_PERMISSIONS,
  getStaffPermissions,
  hasPermission,
  authMiddleware,
  requirePermission,
} from "../src/middlewares/auth.middleware";
import { createAccessToken, verifyAccessToken } from "../src/security/jwt";

describe("Store254 Security & Core Logic Suite", () => {
  it("should sanitize and validate subdomains strictly", () => {
    // Valid subdomains
    expect(sanitizeSubdomain("alicebabycare")).toBe("alicebabycare");
    expect(sanitizeSubdomain("electronics-kenya")).toBe("electronics-kenya");

    // Invalid & reserved subdomains
    expect(sanitizeSubdomain("admin")).toBeNull();
    expect(sanitizeSubdomain("api")).toBeNull();
    expect(sanitizeSubdomain("www")).toBeNull();
    expect(sanitizeSubdomain("store254")).toBeNull();
    expect(sanitizeSubdomain("a")).toBeNull(); // too short
    expect(sanitizeSubdomain("-invalid-")).toBeNull();
    expect(sanitizeSubdomain("has_underscore")).toBeNull();
  });

  it("should securely hash and verify passwords using PBKDF2-HMAC-SHA512", async () => {
    const password = "StrongMerchantPassword123!";
    const hash = await hashPassword(password);

    expect(hash.startsWith("pbkdf2$sha512$100000$")).toBe(true);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("WrongPassword123!", hash)).toBe(false);
  });

  it("should correctly perform constant-time equality checks", () => {
    expect(timingSafeEqual("secret123", "secret123")).toBe(true);
    expect(timingSafeEqual("secret123", "secret124")).toBe(false);
    expect(timingSafeEqual("short", "longer")).toBe(false);
  });

  it("should validate and normalize Kenyan phone numbers for M-Pesa", () => {
    // Standard Safaricom 07...
    expect(normalizeKenyanPhone("0712345678")).toBe("254712345678");
    // Standard Safaricom 01...
    expect(normalizeKenyanPhone("0112345678")).toBe("254112345678");
    // International format with plus
    expect(normalizeKenyanPhone("+254712345678")).toBe("254712345678");
    // Already in 254 format
    expect(normalizeKenyanPhone("254712345678")).toBe("254712345678");
    // Phone with spaces and dashes
    expect(normalizeKenyanPhone("+254 712-345-678")).toBe("254712345678");

    // Non-Kenyan or invalid
    expect(normalizeKenyanPhone("0812345678")).toBeNull();
    expect(normalizeKenyanPhone("123456")).toBeNull();
    expect(normalizeKenyanPhone("+12025550143")).toBeNull();
  });

  it("should respond to health check with enterprise security headers", async () => {
    const res = await app.request("https://store254.co.ke/health");
    expect(res.status).toBe(200);

    const headers = res.headers;
    // Security headers verification
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("strict-transport-security")).toContain("max-age=63072000");
    expect(headers.get("x-request-id")).toBeDefined();

    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.service).toBe("store254-engine");
  });

  it("should extract valid staff permissions and evaluate role/permission access", () => {
    expect(STAFF_PERMISSIONS).toContain("manage_products");
    expect(STAFF_PERMISSIONS).toContain("delete_orders");

    const settings = {
      staffPermissions: {
        "staff-1": ["manage_products", "manage_orders", "invalid_perm_key"],
      },
    };
    expect(getStaffPermissions(settings, "staff-1")).toEqual(["manage_products", "manage_orders"]);
    expect(getStaffPermissions(settings, "missing-staff")).toEqual([]);

    expect(
      hasPermission({ id: "owner-1", tenantId: "t1", email: "o@example.com", role: "OWNER" }, "manage_payments")
    ).toBe(true);
    expect(
      hasPermission(
        {
          id: "staff-1",
          tenantId: "t1",
          email: "s@example.com",
          role: "STAFF",
          permissions: ["manage_products"],
        },
        "manage_products"
      )
    ).toBe(true);
    expect(
      hasPermission(
        {
          id: "staff-1",
          tenantId: "t1",
          email: "s@example.com",
          role: "STAFF",
          permissions: ["manage_products"],
        },
        "manage_payments"
      )
    ).toBe(false);
    expect(
      hasPermission({ id: "cust-1", tenantId: "t1", email: "c@example.com", role: "CUSTOMER" }, "manage_products")
    ).toBe(false);
  });

  it("should preserve granular permissions across JWT signing and verification", async () => {
    const secret = "test-jwt-secret-key-at-least-32-chars!!";
    const token = await createAccessToken(
      {
        sub: "staff-42",
        tid: "tenant-1",
        role: "STAFF",
        email: "clerk@shop.store254.co.ke",
        permissions: ["manage_products", "manage_categories"],
      },
      secret
    );
    const verified = await verifyAccessToken(token, secret);
    expect(verified).not.toBeNull();
    expect(verified?.role).toBe("STAFF");
    expect(verified?.permissions).toEqual(["manage_products", "manage_categories"]);
  });

  it("should enforce requirePermission and authMiddleware across owner, staff, and unauthenticated callers", async () => {
    const testApp = new Hono<AppEnv>();
    testApp.onError((err, c) => {
      if (err instanceof AppError) {
        return c.json({ success: false, error: { code: err.code, message: err.message } }, err.statusCode as any);
      }
      return c.json({ success: false }, 500);
    });

    testApp.use("/guarded/*", async (c, next) => {
      const role = c.req.header("X-Test-Role") as any;
      const permsHeader = c.req.header("X-Test-Perms");
      if (role) {
        c.set("user", {
          id: "u-1",
          tenantId: "t-1",
          email: "u@example.com",
          role,
          permissions: permsHeader ? permsHeader.split(",") : [],
        });
      }
      await next();
    });
    testApp.post("/guarded/items", requirePermission("manage_products"), (c) => c.json({ ok: true }));
    testApp.delete("/guarded/orders", requirePermission("delete_orders"), (c) => c.json({ ok: true }));
    testApp.post("/auth-required", authMiddleware(true), (c) => c.json({ ok: true }));

    // Missing auth header or cookie on authMiddleware(true) -> 401
    const unauthRes = await testApp.request("https://demo.store254.co.ke/auth-required", {
      method: "POST",
    });
    expect(unauthRes.status).toBe(401);

    // Owner allowed everywhere -> 200
    const ownerRes = await testApp.request("https://demo.store254.co.ke/guarded/orders", {
      method: "DELETE",
      headers: { "X-Test-Role": "OWNER" },
    });
    expect(ownerRes.status).toBe(200);

    // Staff with manage_products allowed on /items -> 200, blocked on /orders delete -> 403
    const staffAllowed = await testApp.request("https://demo.store254.co.ke/guarded/items", {
      method: "POST",
      headers: { "X-Test-Role": "STAFF", "X-Test-Perms": "manage_products" },
    });
    expect(staffAllowed.status).toBe(200);

    const staffBlocked = await testApp.request("https://demo.store254.co.ke/guarded/orders", {
      method: "DELETE",
      headers: { "X-Test-Role": "STAFF", "X-Test-Perms": "manage_products,manage_orders" },
    });
    expect(staffBlocked.status).toBe(403);
    const blockedJson = (await staffBlocked.json()) as any;
    expect(blockedJson.error.code).toBe("INSUFFICIENT_PERMISSIONS");

    // Customer blocked on merchant permission guard -> 403
    const customerBlocked = await testApp.request("https://demo.store254.co.ke/guarded/items", {
      method: "POST",
      headers: { "X-Test-Role": "CUSTOMER" },
    });
    expect(customerBlocked.status).toBe(403);
  });
});
