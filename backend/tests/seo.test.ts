import { describe, expect, it } from "vitest";
import app from "../src/index";

describe("SEO API endpoints", () => {
  const mockEnv = {
    PRIMARY_DOMAIN: "store254.co.ke",
    ENVIRONMENT: "development" as const,
  };

  it("requires tenant context for /api/seo/storefront", async () => {
    const res = await app.request(
      "https://store254.co.ke/api/seo/storefront",
      {},
      mockEnv as any
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("TENANT_REQUIRED");
  });

  it("returns 500 cleanly when DB binding is absent on /api/platform/seo-stores", async () => {
    const res = await app.request(
      "https://store254.co.ke/api/platform/seo-stores",
      {},
      mockEnv as any
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("DB_NOT_INITIALIZED");
  });
});
