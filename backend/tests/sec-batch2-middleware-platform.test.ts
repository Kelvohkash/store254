import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { sign } from "hono/jwt";
import { eq } from "drizzle-orm";
import app from "../src/index";
import { createDb } from "../src/db";
import { users } from "../src/db/schema/users";
import { tenants } from "../src/db/schema/tenants";
import { hashPassword } from "../src/security/crypto";
import { createAccessToken, createCustomerSsoToken, verifyAccessToken } from "../src/security/jwt";
import { selectRateLimiterBinding } from "../src/security/rate-limiter";
import {
  CUSTOMER_SESSION_COOKIE,
  TENANT_SESSION_COOKIE,
  clearTenantSessionCookie,
  tenantSessionCookie,
} from "../src/security/session-cookie";
import { resolveTenantLookup } from "../src/middlewares/tenant.middleware";
import {
  customDomainSchema,
  isAllowedCustomDomain,
  isSafeMediaSegment,
  isTenantMediaPath,
  updateStoreProfileSchema,
} from "../src/modules/tenant/tenant.routes";
import { verifyGoogleIdToken } from "../src/security/google-auth";
import {
  autocompleteGooglePlacesKenya,
  fetchGooglePlaceDetails,
} from "../src/modules/platform/locations.service";

function normalizeSqlParam(v: unknown): string | number | Uint8Array | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return Math.floor(v.getTime() / 1000);
  if (typeof v === "number" || typeof v === "string" || v instanceof Uint8Array) return v;
  return JSON.stringify(v);
}

function createSqliteD1Shim(sqlite: DatabaseSync): D1Database {
  const makePrepared = (query: string, boundParams: unknown[] = []) => {
    const stmt = sqlite.prepare(query);
    const params = boundParams.map(normalizeSqlParam);

    return {
      bind(...nextParams: unknown[]) {
        return makePrepared(query, nextParams);
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const row = stmt.get(...(params as any[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as T;
      },
      async all<T = Record<string, unknown>>() {
        const results = stmt.all(...(params as any[])) as T[];
        return { success: true, results, meta: {} };
      },
      async run() {
        const info = stmt.run(...(params as any[]));
        return {
          success: true,
          results: [],
          meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
        };
      },
      async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]> {
        stmt.setReturnArrays(true);
        const values = stmt.all(...(params as any[])) as unknown as T[];
        stmt.setReturnArrays(false);
        if (options?.columnNames) {
          const cols = stmt.columns().map((c) => c.name);
          return cols.length ? ([cols as unknown as T, ...values]) : [];
        }
        return values;
      },
    };
  };

  return {
    prepare(query: string) {
      return makePrepared(query);
    },
    async dump() {
      return new ArrayBuffer(0);
    },
    async batch(statements: any[]) {
      const results = [];
      for (const s of statements) {
        results.push(await s.all());
      }
      return results;
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
  } as unknown as D1Database;
}

function initTestSchema(sqlite: DatabaseSync) {
  sqlite.exec(`
    CREATE TABLE tenants (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      subdomain text NOT NULL UNIQUE,
      custom_domain text UNIQUE,
      business_type text NOT NULL DEFAULT 'RETAIL',
      currency text NOT NULL DEFAULT 'KES',
      status text NOT NULL DEFAULT 'PENDING',
      settings text DEFAULT '{}',
      subscription_amount integer,
      subscription_due_at integer,
      county_id text,
      constituency_id text,
      location_id text,
      location_label text,
      created_at integer NOT NULL DEFAULT (unixepoch()),
      updated_at integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE users (
      id text PRIMARY KEY NOT NULL,
      tenant_id text NOT NULL,
      email text NOT NULL,
      password_hash text NOT NULL,
      full_name text,
      avatar_url text,
      google_id text,
      phone text,
      role text NOT NULL DEFAULT 'CUSTOMER',
      status text NOT NULL DEFAULT 'ACTIVE',
      email_verified_at integer,
      token_version integer NOT NULL DEFAULT 0,
      last_login_at integer,
      created_at integer NOT NULL DEFAULT (unixepoch()),
      updated_at integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE categories (
      id text PRIMARY KEY NOT NULL,
      tenant_id text NOT NULL,
      name text NOT NULL,
      slug text NOT NULL,
      description text,
      image_url text,
      sort_order integer NOT NULL DEFAULT 0,
      is_active integer NOT NULL DEFAULT 1,
      created_at integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE items (
      id text PRIMARY KEY NOT NULL,
      tenant_id text NOT NULL,
      category_id text,
      title text NOT NULL,
      slug text NOT NULL,
      description text,
      item_type text NOT NULL DEFAULT 'PHYSICAL',
      base_price integer NOT NULL,
      compare_at_price integer,
      cost_price integer,
      sku text,
      barcode text,
      track_inventory integer NOT NULL DEFAULT 1,
      stock_quantity integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'PUBLISHED',
      images text DEFAULT '[]',
      attributes text DEFAULT '{}',
      metadata text DEFAULT '{}',
      created_at integer NOT NULL DEFAULT (unixepoch()),
      updated_at integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE item_variants (
      id text PRIMARY KEY NOT NULL,
      tenant_id text NOT NULL,
      item_id text NOT NULL,
      title text NOT NULL,
      sku text,
      price integer NOT NULL,
      compare_at_price integer,
      stock_quantity integer NOT NULL DEFAULT 0,
      options text DEFAULT '{}',
      created_at integer NOT NULL DEFAULT (unixepoch()),
      updated_at integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE reviews (
      id text PRIMARY KEY NOT NULL,
      tenant_id text NOT NULL,
      item_id text NOT NULL,
      customer_id text,
      customer_name text NOT NULL,
      rating integer NOT NULL,
      comment text,
      is_verified_buyer integer NOT NULL DEFAULT 0,
      created_at integer NOT NULL DEFAULT (unixepoch()),
      updated_at integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE tenant_payment_configs (
      id text PRIMARY KEY NOT NULL,
      tenant_id text NOT NULL,
      provider text NOT NULL DEFAULT 'MPESA',
      is_enabled integer NOT NULL DEFAULT 0,
      shortcode_type text NOT NULL DEFAULT 'PAYBILL',
      shortcode text,
      passkey text,
      consumer_key text,
      consumer_secret text,
      account_reference text,
      is_sandbox integer NOT NULL DEFAULT 1,
      created_at integer NOT NULL DEFAULT (unixepoch()),
      updated_at integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE kenya_counties (
      id text PRIMARY KEY NOT NULL,
      code integer NOT NULL,
      name text NOT NULL,
      slug text NOT NULL,
      centroid_lat real NOT NULL,
      centroid_lng real NOT NULL
    );
    CREATE TABLE kenya_constituencies (
      id text PRIMARY KEY NOT NULL,
      code integer NOT NULL,
      county_id text NOT NULL,
      name text NOT NULL,
      slug text NOT NULL,
      centroid_lat real NOT NULL,
      centroid_lng real NOT NULL
    );
    CREATE TABLE kenya_locations (
      id text PRIMARY KEY NOT NULL,
      county_id text NOT NULL,
      constituency_id text NOT NULL,
      name text NOT NULL,
      slug text NOT NULL,
      kind text NOT NULL DEFAULT 'TRADING_CENTRE',
      latitude real NOT NULL,
      longitude real NOT NULL,
      source text NOT NULL DEFAULT 'GEONAMES',
      google_place_id text,
      population integer NOT NULL DEFAULT 0,
      created_at integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE kenya_location_neighbors (
      location_id text NOT NULL,
      neighbor_location_id text NOT NULL,
      distance_km real NOT NULL,
      rank integer NOT NULL,
      PRIMARY KEY (location_id, neighbor_location_id)
    );
  `);
}

function createMockLimiter(limitValue: number) {
  const counts = new Map<string, number>();
  return {
    calls: [] as string[],
    async limit({ key }: { key: string }) {
      this.calls.push(key);
      const next = (counts.get(key) || 0) + 1;
      counts.set(key, next);
      return { success: next <= limitValue };
    },
  };
}

describe("Security Fix Batch 2 (Edge Middleware, Admin Auth, Tenant Isolation, Media, Rate Limits & Locations)", () => {
  const jwtSecret = "test-jwt-secret-key-12345678901234567890";
  const adminJwtSecret = "test-admin-jwt-secret-key-1234567890123456";
  const adminUsername = "platform-admin";
  const adminPassword = "SuperAdminPassword123!";
  let sqlite: DatabaseSync;
  let d1: D1Database;
  let env: Record<string, any>;
  let ipCounter = 1;

  const nextIp = () => `203.0.113.${(ipCounter++ % 240) + 1}`;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    initTestSchema(sqlite);
    d1 = createSqliteD1Shim(sqlite);
    env = {
      DB: d1,
      PRIMARY_DOMAIN: "store254.co.ke",
      ENVIRONMENT: "production",
      JWT_SECRET: jwtSecret,
      PLATFORM_ADMIN_USERNAME: adminUsername,
      PLATFORM_ADMIN_PASSWORD: adminPassword,
      PLATFORM_ADMIN_JWT_SECRET: adminJwtSecret,
    };

    sqlite
      .prepare(
        `INSERT INTO tenants (id, name, subdomain, custom_domain, status, settings) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        "tenant-alice",
        "Alice Baby Care",
        "alice",
        null,
        "ACTIVE",
        JSON.stringify({
          logoUrl: "/api/media/tenant-alice/logo.webp",
          tagline: "Trusted baby essentials",
          primaryColor: "#059669",
          contactPhone: "0712345678",
          socialLinks: { whatsapp: "0712345678" },
          staffPermissions: { "staff-1": ["manage_products", "manage_settings"] },
          customDomainVerification: { domain: "pending.example.com", token: "store254-verify=secret" },
          internalSecretFlag: "do-not-expose",
        })
      );

    sqlite
      .prepare(
        `INSERT INTO tenants (id, name, subdomain, status, settings) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        "tenant-bob",
        "Bob Electronics",
        "bob",
        "ACTIVE",
        JSON.stringify({
          logoUrl: "/api/media/tenant-bob/logo.webp",
          staffPermissions: { "staff-bob": ["delete_orders"] },
        })
      );

    sqlite
      .prepare(
        `INSERT INTO tenants (id, name, subdomain, status, settings) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        "tenant-pending",
        "Pending Shop",
        "pendingshop",
        "PENDING",
        JSON.stringify({ tagline: "Not approved yet" })
      );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("SEC-05: routes Super Admin /login through AUTH_STRICT_RATE_LIMITER with per-account keying and ignores X-Forwarded-For in production", async () => {
    const strictLimiter = createMockLimiter(5);
    const sensitiveLimiter = createMockLimiter(20);
    const authLimiter = createMockLimiter(10);
    const apiLimiter = createMockLimiter(120);

    const mockEnv = {
      ...env,
      AUTH_STRICT_RATE_LIMITER: strictLimiter,
      SENSITIVE_RATE_LIMITER: sensitiveLimiter,
      AUTH_RATE_LIMITER: authLimiter,
      API_RATE_LIMITER: apiLimiter,
    };

    expect(selectRateLimiterBinding(mockEnv, 15, 15 * 60 * 1000)).toBe(strictLimiter);
    expect(selectRateLimiterBinding(mockEnv, 5, 60 * 1000)).toBe(strictLimiter);
    expect(selectRateLimiterBinding(mockEnv, 10, 60 * 1000)).toBe(authLimiter);
    expect(selectRateLimiterBinding(mockEnv, 20, 60 * 1000)).toBe(sensitiveLimiter);
    expect(selectRateLimiterBinding(mockEnv, 120, 60 * 1000)).toBe(apiLimiter);

    // 5 failed attempts from different IPs targeting the SAME username still hit per-account limit on attempt #6
    for (let i = 0; i < 5; i++) {
      const res = await app.request(
        "https://store254.co.ke/api/platform/admin/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://store254.co.ke",
            "CF-Connecting-IP": nextIp(),
          },
          body: JSON.stringify({ username: "brute-target-admin", password: "wrong" }),
        },
        mockEnv as any
      );
      expect(res.status).toBe(401);
    }

    expect(sensitiveLimiter.calls.length).toBe(0);
    expect(strictLimiter.calls.length).toBe(10); // 5 IP checks + 5 per-account checks

    const blocked = await app.request(
      "https://store254.co.ke/api/platform/admin/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({ username: "brute-target-admin", password: "wrong" }),
      },
      mockEnv as any
    );
    expect(blocked.status).toBe(429);
    const blockedBody = (await blocked.json()) as any;
    expect(blockedBody.error.code).toBe("RATE_LIMIT_EXCEEDED");

    // In production without CF-Connecting-IP, spoofed X-Forwarded-For must NOT create distinct IP buckets
    const noCfIpBefore = apiLimiter.calls.length;
    await app.request(
      "https://store254.co.ke/health",
      { headers: { "X-Forwarded-For": "1.1.1.1" } },
      mockEnv as any
    );
    await app.request(
      "https://store254.co.ke/health",
      { headers: { "X-Forwarded-For": "2.2.2.2" } },
      mockEnv as any
    );
    const call1 = apiLimiter.calls[noCfIpBefore];
    const call2 = apiLimiter.calls[noCfIpBefore + 1];
    expect(call1).toBe(call2);
    expect(call1.startsWith("unknown-client:")).toBe(true);
  });

  it("SEC-08: GET /api/store and marketplace item details strip staffPermissions and internal settings", async () => {
    const storeRes = await app.request(
      "https://alice.store254.co.ke/api/store",
      {
        headers: {
          Host: "alice.store254.co.ke",
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(storeRes.status).toBe(200);
    const storeBody = (await storeRes.json()) as any;
    expect(storeBody.data.settings.tagline).toBe("Trusted baby essentials");
    expect(storeBody.data.settings.logoUrl).toBe("/api/media/tenant-alice/logo.webp");
    expect(storeBody.data.settings.staffPermissions).toBeUndefined();
    expect(storeBody.data.settings.customDomainVerification).toBeUndefined();
    expect(storeBody.data.settings.internalSecretFlag).toBeUndefined();

    sqlite
      .prepare(
        `INSERT INTO items (id, tenant_id, item_type, title, slug, base_price, status, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("item-1", "tenant-alice", "PHYSICAL", "Baby Blanket", "baby-blanket", 1500, "PUBLISHED", "[]");

    const itemRes = await app.request(
      "https://store254.co.ke/api/platform/marketplace/items/item-1",
      { headers: { "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(itemRes.status).toBe(200);
    const itemBody = (await itemRes.json()) as any;
    expect(itemBody.data.store.logoUrl).toBe("/api/media/tenant-alice/logo.webp");
    expect(itemBody.data.store.whatsapp).toBe("0712345678");
    expect(itemBody.data.store.phone).toBe("0712345678");
    expect(JSON.stringify(itemBody)).not.toContain("staffPermissions");
    expect(JSON.stringify(itemBody)).not.toContain("customDomainVerification");
    expect(JSON.stringify(itemBody)).not.toContain("do-not-expose");
  });

  it("SEC-13: ignores X-Forwarded-Host, gates isLocalHost on development, and blocks PENDING tenants with restricted allowlist", async () => {
    // 1. Spoofed X-Forwarded-Host must NOT override Host
    const spoofedRes = await app.request(
      "https://alice.store254.co.ke/api/store",
      {
        headers: {
          Host: "alice.store254.co.ke",
          "X-Forwarded-Host": "bob.store254.co.ke",
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(spoofedRes.status).toBe(200);
    const spoofedBody = (await spoofedRes.json()) as any;
    expect(spoofedBody.data.subdomain).toBe("alice");

    // 2. isLocalHost gated on ENVIRONMENT === "development"
    expect(resolveTenantLookup("127.0.0.1", "store254.co.ke", "alice", false)).toEqual({
      resolvedSubdomain: null,
      resolvedCustomDomain: null,
    });
    expect(resolveTenantLookup("localhost", "store254.co.ke", "alice", false)).toEqual({
      resolvedSubdomain: null,
      resolvedCustomDomain: null,
    });
    expect(resolveTenantLookup("alice.localhost", "store254.co.ke", undefined, false)).toEqual({
      resolvedSubdomain: null,
      resolvedCustomDomain: null,
    });
    expect(resolveTenantLookup("127.0.0.1", "store254.co.ke", "alice", true)).toEqual({
      resolvedSubdomain: "alice",
      resolvedCustomDomain: null,
    });

    const prodLocalRes = await app.request(
      "http://localhost/api/store",
      {
        headers: {
          Host: "localhost",
          "X-Tenant-Slug": "alice",
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(prodLocalRes.status).toBe(400);
    expect(((await prodLocalRes.json()) as any).error.code).toBe("TENANT_REQUIRED");

    // 3. PENDING tenant blocked on storefront / customer registration / checkout, allowed on status/auth allowlist
    const pendingStoreRes = await app.request(
      "https://pendingshop.store254.co.ke/api/store",
      {
        headers: {
          Host: "pendingshop.store254.co.ke",
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(pendingStoreRes.status).toBe(403);
    expect(((await pendingStoreRes.json()) as any).error.code).toBe("TENANT_PENDING");

    const pendingRegRes = await app.request(
      "https://pendingshop.store254.co.ke/api/auth/register",
      {
        method: "POST",
        headers: {
          Host: "pendingshop.store254.co.ke",
          "Content-Type": "application/json",
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          email: "cust@example.com",
          password: "StrongPassword123!",
          fullName: "Pending Customer",
        }),
      },
      env as any
    );
    expect(pendingRegRes.status).toBe(403);
    expect(((await pendingRegRes.json()) as any).error.code).toBe("TENANT_PENDING");

    // Owner login still hits STORE_PENDING_ACTIVATION rather than being masked
    const pendingLoginRes = await app.request(
      "https://pendingshop.store254.co.ke/api/auth/login",
      {
        method: "POST",
        headers: {
          Host: "pendingshop.store254.co.ke",
          "Content-Type": "application/json",
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({ email: "owner@example.com", password: "StrongPassword123!" }),
      },
      env as any
    );
    expect(pendingLoginRes.status).toBe(403);
    expect(((await pendingLoginRes.json()) as any).error.code).toBe("STORE_PENDING_ACTIVATION");

    // 4. Internal worker service binding (api.internal) resolves tenant from X-Forwarded-Host and X-Tenant-Slug
    const serviceForwardedRes = await app.request(
      "https://api.internal/api/store",
      {
        headers: {
          Host: "api.internal",
          "X-Forwarded-Host": "alice.store254.co.ke",
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(serviceForwardedRes.status).toBe(200);
    const serviceForwardedBody = (await serviceForwardedRes.json()) as any;
    expect(serviceForwardedBody.data.subdomain).toBe("alice");

    const serviceSlugRes = await app.request(
      "https://api.internal/api/store",
      {
        headers: {
          Host: "api.internal",
          "X-Tenant-Slug": "bob",
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(serviceSlugRes.status).toBe(200);
    const serviceSlugBody = (await serviceSlugRes.json()) as any;
    expect(serviceSlugBody.data.subdomain).toBe("bob");
  });

  it("SEC-14: protects google-autocomplete and resolve-location with Google SSO auth, Origin check, and rate limits", async () => {
    const mapsEnv = {
      ...env,
      GOOGLE_MAPS_API_KEY: "AIzaSyTestKey123456",
    };

    // Unauthenticated google-autocomplete fails with 401 when API key is configured
    const unauthAuto = await app.request(
      "https://store254.co.ke/api/platform/locations/google-autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({ query: "Westlands" }),
      },
      mapsEnv as any
    );
    expect(unauthAuto.status).toBe(401);

    // Unauthenticated resolve-location fails with 401
    const unauthResolve = await app.request(
      "https://store254.co.ke/api/platform/locations/resolve-location",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          countyId: "county-nairobi",
          customLocationName: "Spam Centre",
        }),
      },
      mapsEnv as any
    );
    expect(unauthResolve.status).toBe(401);

    const ssoToken = await createCustomerSsoToken(
      {
        sub: "g-user-1",
        email: "merchant@gmail.com",
        emailVerified: true,
        name: "Merchant User",
      },
      jwtSecret,
      3600
    );

    // Cross-origin CSRF attempt rejected even with SSO cookie
    const badOriginAuto = await app.request(
      "https://store254.co.ke/api/platform/locations/google-autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.example.com",
          Cookie: `${CUSTOMER_SESSION_COOKIE}=${ssoToken}`,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({ query: "Westlands" }),
      },
      mapsEnv as any
    );
    expect(badOriginAuto.status).toBe(403);

    // Authenticated same-platform request succeeds
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          suggestions: [
            {
              placePrediction: {
                placeId: "ChIJTestPlace12345",
                text: { text: "Sarit Centre, Nairobi" },
                structuredFormat: {
                  mainText: { text: "Sarit Centre" },
                  secondaryText: { text: "Nairobi, Kenya" },
                },
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const okAuto = await app.request(
      "https://store254.co.ke/api/platform/locations/google-autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
          Cookie: `${CUSTOMER_SESSION_COOKIE}=${ssoToken}`,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({ query: "Sarit" }),
      },
      mapsEnv as any
    );
    expect(okAuto.status).toBe(200);
    const autoJson = (await okAuto.json()) as any;
    expect(autoJson.suggestions[0].placeId).toBe("ChIJTestPlace12345");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("SEC-16: rejects reserved/internal/IP custom domains and requires DNS TXT verification before binding", async () => {
    const blockedDomains = [
      "store254.co.ke",
      "bob.store254.co.ke",
      "localhost",
      "shop.localhost",
      "printer.local",
      "api.internal",
      "127.0.0.1",
      "192.168.1.10",
      "evil.workers.dev",
      "example.com",
    ];
    for (const bad of blockedDomains) {
      expect(isAllowedCustomDomain(bad, "store254.co.ke")).toBe(false);
      expect(customDomainSchema.safeParse({ customDomain: bad }).success).toBe(false);
    }
    expect(isAllowedCustomDomain("shop.alicebabycare.co.ke", "store254.co.ke")).toBe(true);

    const db = createDb(d1);
    const pwHash = await hashPassword("OwnerPass123!");
    await db.insert(users).values({
      id: "alice-owner",
      tenantId: "tenant-alice",
      email: "alice@example.com",
      passwordHash: pwHash,
      role: "OWNER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      tokenVersion: 0,
    });
    const ownerToken = await createAccessToken(
      {
        id: "alice-owner",
        tenantId: "tenant-alice",
        email: "alice@example.com",
        role: "OWNER",
        tokenVersion: 0,
      },
      jwtSecret
    );

    // Step 1: DNS TXT does not exist yet -> returns 202 and does NOT bind customDomain
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ Status: 3, Answer: [] }), {
        status: 200,
        headers: { "Content-Type": "application/dns-json" },
      })
    );

    const step1 = await app.request(
      "https://alice.store254.co.ke/api/store/settings/custom-domain",
      {
        method: "PUT",
        headers: {
          Host: "alice.store254.co.ke",
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({ customDomain: "alicebabycare.com" }),
      },
      env as any
    );
    expect(step1.status).toBe(202);
    const step1Json = (await step1.json()) as any;
    expect(step1Json.data.verified).toBe(false);
    expect(step1Json.data.customDomain).toBeNull();
    expect(step1Json.data.txtVerification.host).toBe("_store254-verify.alicebabycare.com");
    const txtToken = step1Json.data.txtVerification.value as string;
    expect(txtToken.startsWith("store254-verify=")).toBe(true);

    const [notBoundYet] = await db
      .select({ customDomain: tenants.customDomain })
      .from(tenants)
      .where(eq(tenants.id, "tenant-alice"))
      .limit(1);
    expect(notBoundYet.customDomain).toBeNull();

    // Step 2: DNS TXT record now matches -> binds customDomain and returns 200
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          Status: 0,
          Answer: [{ type: 16, data: `"${txtToken}"` }],
        }),
        { status: 200, headers: { "Content-Type": "application/dns-json" } }
      )
    );

    const step2 = await app.request(
      "https://alice.store254.co.ke/api/store/settings/custom-domain",
      {
        method: "PUT",
        headers: {
          Host: "alice.store254.co.ke",
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({ customDomain: "alicebabycare.com" }),
      },
      env as any
    );
    expect(step2.status).toBe(200);
    const step2Json = (await step2.json()) as any;
    expect(step2Json.data.verified).toBe(true);
    expect(step2Json.data.customDomain).toBe("alicebabycare.com");

    const [boundRow] = await db
      .select({ customDomain: tenants.customDomain })
      .from(tenants)
      .where(eq(tenants.id, "tenant-alice"))
      .limit(1);
    expect(boundRow.customDomain).toBe("alicebabycare.com");
  });

  it("SEC-18: rejects Sec-Fetch-Site same-site/none CSRF, missing Origin on platform mutations, and subdomain origins on platform checkout/logout", async () => {
    const db = createDb(d1);
    const pwHash = await hashPassword("OwnerPass123!");
    await db.insert(users).values({
      id: "alice-owner-csrf",
      tenantId: "tenant-alice",
      email: "owner-csrf@alice.com",
      passwordHash: pwHash,
      role: "OWNER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      tokenVersion: 0,
    });
    const ownerToken = await createAccessToken(
      {
        id: "alice-owner-csrf",
        tenantId: "tenant-alice",
        email: "owner-csrf@alice.com",
        role: "OWNER",
        tokenVersion: 0,
      },
      jwtSecret
    );

    // 1. Cookie-authenticated tenant mutation with Sec-Fetch-Site: same-site (no Origin) must fail 403
    const sameSiteRes = await app.request(
      "https://alice.store254.co.ke/api/store/settings",
      {
        method: "PATCH",
        headers: {
          Host: "alice.store254.co.ke",
          "Content-Type": "application/json",
          Cookie: `${TENANT_SESSION_COOKIE}=${ownerToken}`,
          "Sec-Fetch-Site": "same-site",
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({ name: "Hijacked" }),
      },
      env as any
    );
    expect(sameSiteRes.status).toBe(403);
    expect(((await sameSiteRes.json()) as any).error.code).toBe("INVALID_SESSION_ORIGIN");

    // Sec-Fetch-Site: same-origin succeeds
    const sameOriginRes = await app.request(
      "https://alice.store254.co.ke/api/store/settings",
      {
        method: "PATCH",
        headers: {
          Host: "alice.store254.co.ke",
          "Content-Type": "application/json",
          Cookie: `${TENANT_SESSION_COOKIE}=${ownerToken}`,
          "Sec-Fetch-Site": "same-origin",
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({ name: "Alice Baby Care Updated" }),
      },
      env as any
    );
    expect(sameOriginRes.status).toBe(200);

    // 2. Super Admin endpoints reject Sec-Fetch-Site: same-site or none when Origin is absent
    for (const sfs of ["same-site", "none", ""]) {
      const adminRes = await app.request(
        "https://store254.co.ke/api/platform/admin/me",
        {
          headers: {
            ...(sfs ? { "Sec-Fetch-Site": sfs } : {}),
            "CF-Connecting-IP": nextIp(),
          },
        },
        env as any
      );
      expect(adminRes.status).toBe(403);
    }

    const adminSameOrigin = await app.request(
      "https://store254.co.ke/api/platform/admin/me",
      {
        headers: {
          "Sec-Fetch-Site": "same-origin",
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(adminSameOrigin.status).toBe(200);

    // 3. Platform /logout & /marketplace/checkout fail closed without Origin/Referer/same-origin and reject tenant subdomains
    const noOriginLogout = await app.request(
      "https://store254.co.ke/api/platform/logout",
      {
        method: "POST",
        headers: { "CF-Connecting-IP": nextIp() },
      },
      env as any
    );
    expect(noOriginLogout.status).toBe(403);

    const subdomainLogout = await app.request(
      "https://store254.co.ke/api/platform/logout",
      {
        method: "POST",
        headers: {
          Origin: "https://alice.store254.co.ke",
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(subdomainLogout.status).toBe(403);

    const subdomainCheckout = await app.request(
      "https://store254.co.ke/api/platform/marketplace/checkout",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://alice.store254.co.ke",
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({ storeId: "tenant-alice" }),
      },
      env as any
    );
    expect(subdomainCheckout.status).toBe(403);

    const wwwLogout = await app.request(
      "https://www.store254.co.ke/api/platform/logout",
      {
        method: "POST",
        headers: {
          Origin: "https://www.store254.co.ke",
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(wwwLogout.status).toBe(200);
  });

  it("SEC-19: enforces exp/aud on Super Admin JWTs, tokenVersion & status revocation on user JWTs, and 3600s __Host- cookie", async () => {
    // 1. Super Admin JWT missing exp or wrong aud must be rejected
    const noExpToken = await sign(
      {
        sub: "super-admin",
        email: adminUsername,
        role: "SUPER_ADMIN",
        iss: "store254-platform",
        aud: "store254-platform-admin",
      },
      adminJwtSecret,
      "HS256"
    );
    const wrongAudToken = await sign(
      {
        sub: "super-admin",
        email: adminUsername,
        role: "SUPER_ADMIN",
        iss: "store254-platform",
        aud: "wrong-aud",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      adminJwtSecret,
      "HS256"
    );
    const expiredAdminToken = await sign(
      {
        sub: "super-admin",
        email: adminUsername,
        role: "SUPER_ADMIN",
        iss: "store254-platform",
        aud: "store254-platform-admin",
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      adminJwtSecret,
      "HS256"
    );

    for (const badToken of [noExpToken, wrongAudToken, expiredAdminToken]) {
      const res = await app.request(
        "https://store254.co.ke/api/platform/admin/stores",
        {
          headers: {
            Origin: "https://store254.co.ke",
            Cookie: `__Host-store254_admin_session=${badToken}`,
            "CF-Connecting-IP": nextIp(),
          },
        },
        env as any
      );
      expect(res.status).toBe(401);
    }

    // 2. Tenant session cookie attributes and 3600s Max-Age
    const prodCookie = tenantSessionCookie("abc.def.ghi", false);
    expect(prodCookie).toContain("__Host-store254_tenant_session=abc.def.ghi");
    expect(prodCookie).toContain("Max-Age=3600");
    expect(prodCookie).toContain("Secure");
    expect(prodCookie).toContain("SameSite=Strict");
    expect(clearTenantSessionCookie(false)).toContain("__Host-store254_tenant_session=;");

    // 3. Login embeds tokenVersion; logout/revocation invalidates token immediately
    const db = createDb(d1);
    const pwHash = await hashPassword("OwnerSecret123!");
    await db.insert(users).values({
      id: "owner-sec19",
      tenantId: "tenant-alice",
      email: "owner19@alice.com",
      passwordHash: pwHash,
      role: "OWNER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      tokenVersion: 2,
    });

    const loginRes = await app.request(
      "https://alice.store254.co.ke/api/auth/login",
      {
        method: "POST",
        headers: {
          Host: "alice.store254.co.ke",
          "Content-Type": "application/json",
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({ email: "owner19@alice.com", password: "OwnerSecret123!" }),
      },
      env as any
    );
    expect(loginRes.status).toBe(200);
    const loginCookie = loginRes.headers.get("set-cookie") || "";
    expect(loginCookie).toContain("__Host-store254_tenant_session=");
    expect(loginCookie).toContain("Max-Age=3600");
    const loginJson = (await loginRes.json()) as any;
    const accessToken = loginJson.data.accessToken as string;
    const decoded = await verifyAccessToken(accessToken, jwtSecret, "tenant-alice");
    expect(decoded?.tokenVersion).toBe(2);

    // Valid before logout
    const meBefore = await app.request(
      "https://alice.store254.co.ke/api/auth/me",
      {
        headers: {
          Host: "alice.store254.co.ke",
          Authorization: `Bearer ${accessToken}`,
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(meBefore.status).toBe(200);

    // Logout increments tokenVersion -> old token must fail 401 INVALID_TOKEN
    const logoutRes = await app.request(
      "https://alice.store254.co.ke/api/auth/logout",
      {
        method: "POST",
        headers: {
          Host: "alice.store254.co.ke",
          Authorization: `Bearer ${accessToken}`,
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(logoutRes.status).toBe(200);

    const meAfterLogout = await app.request(
      "https://alice.store254.co.ke/api/auth/me",
      {
        headers: {
          Host: "alice.store254.co.ke",
          Authorization: `Bearer ${accessToken}`,
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(meAfterLogout.status).toBe(401);
    expect(((await meAfterLogout.json()) as any).error.code).toBe("INVALID_TOKEN");

    // Suspended user with matching tokenVersion must fail 403 ACCOUNT_INACTIVE
    await db
      .update(users)
      .set({ status: "SUSPENDED" })
      .where(eq(users.id, "owner-sec19"));
    const suspendedToken = await createAccessToken(
      {
        id: "owner-sec19",
        tenantId: "tenant-alice",
        email: "owner19@alice.com",
        role: "OWNER",
        tokenVersion: 3,
      },
      jwtSecret
    );
    const meSuspended = await app.request(
      "https://alice.store254.co.ke/api/auth/me",
      {
        headers: {
          Host: "alice.store254.co.ke",
          Authorization: `Bearer ${suspendedToken}`,
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(meSuspended.status).toBe(403);
    expect(((await meSuspended.json()) as any).error.code).toBe("ACCOUNT_INACTIVE");
  }, 15000);

  it("SEC-21: enforces global 1 MB bodyLimit, 6 MB media bodyLimit, and strict media path validation", async () => {
    // 1. Global 1 MB body limit
    const bigPayload = "x".repeat(1024 * 1024 + 512);
    const overLimitRes = await app.request(
      "https://store254.co.ke/api/platform/forgot-password",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({ email: "a@b.com", pad: bigPayload }),
      },
      env as any
    );
    expect(overLimitRes.status).toBe(413);
    expect(((await overLimitRes.json()) as any).error.code).toBe("PAYLOAD_TOO_LARGE");

    // 2. Media upload allows >1 MB (e.g. 2 MB) up to 6 MB and rejects >6 MB
    const db = createDb(d1);
    await db.insert(users).values({
      id: "owner-media",
      tenantId: "tenant-alice",
      email: "media@alice.com",
      passwordHash: "hash",
      role: "OWNER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      tokenVersion: 0,
    });
    const mediaToken = await createAccessToken(
      {
        id: "owner-media",
        tenantId: "tenant-alice",
        email: "media@alice.com",
        role: "OWNER",
        tokenVersion: 0,
      },
      jwtSecret
    );
    const overMediaRes = await app.request(
      "https://alice.store254.co.ke/api/store/settings/media",
      {
        method: "POST",
        headers: {
          Host: "alice.store254.co.ke",
          Authorization: `Bearer ${mediaToken}`,
          "Content-Type": "application/octet-stream",
          "Content-Length": String(6 * 1024 * 1024 + 100),
          "CF-Connecting-IP": nextIp(),
        },
        body: new Uint8Array(64),
      },
      env as any
    );
    expect(overMediaRes.status).toBe(413);

    // 3. Strict media path validation
    expect(isSafeMediaSegment("tenant-alice")).toBe(true);
    expect(isSafeMediaSegment("logo_1.webp")).toBe(true);
    expect(isSafeMediaSegment("..")).toBe(false);
    expect(isSafeMediaSegment("foo..bar")).toBe(false);
    expect(isSafeMediaSegment("a/b")).toBe(false);
    expect(isSafeMediaSegment("a\\b")).toBe(false);
    expect(isSafeMediaSegment("logo.webp?x=1")).toBe(false);
    expect(isSafeMediaSegment("logo.webp#frag")).toBe(false);

    expect(isTenantMediaPath("/api/media/tenant-alice/logo.webp", "tenant-alice")).toBe(true);
    expect(isTenantMediaPath("/api/media/tenant-alice/logo.webp?x=1", "tenant-alice")).toBe(false);
    expect(isTenantMediaPath("/api/media/tenant-alice/logo.webp#x", "tenant-alice")).toBe(false);
    expect(isTenantMediaPath("/api/media/tenant-alice/a\\b.webp", "tenant-alice")).toBe(false);

    for (const badPath of [
      "/api/media/tenant-alice/bad..file.webp",
      "/api/media/tenant-alice/bad%2Ffile.webp",
      "/api/media/tenant-alice/bad%5Cfile.webp",
      "/api/media/tenant-alice/bad%3Fx.webp",
      "/api/media/tenant-alice/bad%23x.webp",
    ]) {
      const mediaGet = await app.request(
        `https://store254.co.ke${badPath}`,
        { headers: { "CF-Connecting-IP": nextIp() } },
        env as any
      );
      expect(mediaGet.status).toBe(400);
    }
  });

  it("SEC-26: validates socialLinks URLs to http/https schemes while permitting safe handles", () => {
    expect(
      updateStoreProfileSchema.safeParse({
        settings: {
          socialLinks: {
            instagram: "https://instagram.com/alicebabycare",
            facebook: "http://facebook.com/alice",
            tiktok: "@alicebabycare",
            whatsapp: "+254712345678",
            twitter: "alice_ke",
          },
        },
      }).success
    ).toBe(true);

    for (const badUrl of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "//evil.example.com",
    ]) {
      expect(
        updateStoreProfileSchema.safeParse({
          settings: { socialLinks: { instagram: badUrl } },
        }).success
      ).toBe(false);
      expect(
        updateStoreProfileSchema.safeParse({
          settings: { socialLinks: { whatsapp: badUrl } },
        }).success
      ).toBe(false);
    }
  });

  it("SEC-28: sanitizes 502 upstream errors in google-auth and locations.service", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("connect ECONNREFUSED 142.250.1.1:443 internal-secret")
    );
    await expect(verifyGoogleIdToken("dummy.jwt.token")).rejects.toMatchObject({
      statusCode: 502,
      code: "GOOGLE_NETWORK_ERROR",
      message: "Google authentication service is temporarily unavailable. Please try again.",
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response('{"error":{"message":"API key AIzaSecretLeak expired"}}', { status: 403 })
    );
    await expect(
      autocompleteGooglePlacesKenya("test-key", { input: "Westlands" })
    ).rejects.toMatchObject({
      status: 502,
      message:
        "Unable to query Google Maps places right now. Please select a listed town or enter your shopping centre name.",
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response('{"error":{"message":"Internal upstream trace"}}', { status: 500 })
    );
    await expect(fetchGooglePlaceDetails("test-key", "ChIJValidPlaceId1234")).rejects.toMatchObject({
      status: 502,
      message:
        "Unable to fetch Google Maps place details right now. Please select a listed town or enter your shopping centre name.",
    });

    expect(errSpy).toHaveBeenCalledTimes(3);
  });
});
