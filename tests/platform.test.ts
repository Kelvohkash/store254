import { describe, it, expect, beforeAll } from "vitest";
import app from "../src/index";
import { normalizeKenyanPhone } from "../src/security/mpesa";
import { hashPassword, verifyPassword, timingSafeEqual } from "../src/security/crypto";
import { sanitizeSubdomain } from "../src/security/sanitize";

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
});
