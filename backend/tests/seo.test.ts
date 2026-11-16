import { describe, expect, it } from "vitest";
import app from "../src/index";
import { createDb } from "../src/db";
import { buildSeoStoresQuery } from "../src/modules/seo/seo.routes";

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

  it("qualifies outer tenants.id in the itemCount subquery so active stores are not zeroed out", () => {
    const compiled = buildSeoStoresQuery(createDb({} as any)).toSQL();
    expect(compiled.sql).toContain("items.tenant_id = tenants.id");
    expect(compiled.sql).not.toContain('items.tenant_id = "id"');
  });
});
