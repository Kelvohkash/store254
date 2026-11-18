import { beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { eq } from "drizzle-orm";
import app from "../src/index";
import { createDb } from "../src/db";
import { tenants } from "../src/db/schema/tenants";
import { items } from "../src/db/schema/items";
import { createAccessToken, createCustomerSsoToken } from "../src/security/jwt";
import { CUSTOMER_SESSION_COOKIE } from "../src/security/session-cookie";
import { BUSINESS_TYPE_VALUES } from "../src/config/business-types";
import {
  createItemSchema,
  sanitizePublicItemMetadata,
} from "../src/modules/catalog/items.routes";
import { updateStoreProfileSchema } from "../src/modules/tenant/tenant.routes";
import {
  COMMUNITY_MARKET_SUBDOMAIN,
  COMMUNITY_MARKET_TENANT_ID,
  ensureCommunityMarketTenant,
} from "../src/modules/platform/single-items.routes";
import { getStaticLocationById } from "../src/modules/platform/kenya-static-data";

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

function createMockR2Bucket() {
  const objects = new Map<string, { body: ArrayBuffer; contentType: string }>();
  return {
    objects,
    bucket: {
      async put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
        const buf =
          value instanceof Uint8Array
            ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
            : value;
        objects.set(key, {
          body: buf,
          contentType: options?.httpMetadata?.contentType || "application/octet-stream",
        });
        return { key };
      },
      async get(key: string) {
        const obj = objects.get(key);
        if (!obj) return null;
        return {
          key,
          size: obj.body.byteLength,
          httpEtag: `"${key}"`,
          body: obj.body,
          writeHttpMetadata(headers: Headers) {
            headers.set("content-type", obj.contentType);
          },
        };
      },
    } as unknown as R2Bucket,
  };
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
      parent_id text,
      name text NOT NULL,
      slug text NOT NULL,
      description text,
      icon text,
      display_order integer NOT NULL DEFAULT 0,
      is_active integer NOT NULL DEFAULT 1,
      created_at integer NOT NULL DEFAULT (unixepoch()),
      updated_at integer NOT NULL DEFAULT (unixepoch())
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
    CREATE UNIQUE INDEX items_tenant_slug_idx ON items (tenant_id, slug);
    CREATE TABLE item_variants (
      id text PRIMARY KEY NOT NULL,
      tenant_id text NOT NULL,
      item_id text NOT NULL,
      title text NOT NULL,
      sku text,
      price integer NOT NULL,
      compare_at_price integer,
      stock_quantity integer NOT NULL DEFAULT 0,
      options text NOT NULL DEFAULT '{}',
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
      is_sandbox integer NOT NULL DEFAULT 0,
      created_at integer NOT NULL DEFAULT (unixepoch()),
      updated_at integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE kenya_counties (
      id text PRIMARY KEY NOT NULL,
      code integer NOT NULL UNIQUE,
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      centroid_lat real NOT NULL,
      centroid_lng real NOT NULL
    );
    CREATE TABLE kenya_constituencies (
      id text PRIMARY KEY NOT NULL,
      code integer NOT NULL UNIQUE,
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
      slug text NOT NULL UNIQUE,
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

function makeWebpBytes(): Uint8Array {
  // RIFF....WEBP
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46,
    0x24, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20,
  ]);
}

describe("Single-Item Quick Sell & Portfolio Mode", () => {
  const jwtSecret = "test-jwt-secret-key-12345678901234567890";
  let sqlite: DatabaseSync;
  let d1: D1Database;
  let r2Mock: ReturnType<typeof createMockR2Bucket>;
  let env: Record<string, unknown>;
  let ipSeq = 1;

  const nextIp = () => `198.51.101.${(ipSeq++ % 240) + 1}`;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    initTestSchema(sqlite);
    d1 = createSqliteD1Shim(sqlite);
    r2Mock = createMockR2Bucket();
    env = {
      DB: d1,
      MEDIA_BUCKET: r2Mock.bucket,
      PRIMARY_DOMAIN: "store254.co.ke",
      ENVIRONMENT: "development",
      JWT_SECRET: jwtSecret,
    };
  });

  async function issueGoogleCookie(email: string, name = "Test User") {
    const token = await createCustomerSsoToken(
      {
        sub: `sub-${email}`,
        email,
        emailVerified: true,
        name,
      },
      jwtSecret,
      3600
    );
    return `${CUSTOMER_SESSION_COOKIE}=${token}`;
  }

  it("allows individual users without a store to upload photos, publish single items, list /mine, and enforces owner-only PATCH/DELETE", async () => {
    const aliceEmail = "Alice.Seller@gmail.com";
    const bobEmail = "bob.other@gmail.com";
    const aliceCookie = await issueGoogleCookie(aliceEmail, "Alice Wanjiku");
    const bobCookie = await issueGoogleCookie(bobEmail, "Bob Otieno");

    const kilimani = getStaticLocationById("loc-gn-8477699")!;
    expect(kilimani).toBeDefined();

    // 1. Unauthenticated upload/post must reject with 401
    const unauthPost = await app.request(
      "https://store254.co.ke/api/platform/single-items",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          title: "Unauth Phone",
          basePrice: 15000,
          sellerName: "Unauth",
          sellerPhone: "0712345678",
          countyId: kilimani.countyId,
          locationId: kilimani.id,
        }),
      },
      env as any
    );
    expect(unauthPost.status).toBe(401);

    // 2. Untrusted origin must reject with 403
    const badOriginRes = await app.request(
      "https://store254.co.ke/api/platform/single-items",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.example.com",
          Cookie: aliceCookie,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          title: "Origin Check",
          basePrice: 15000,
          sellerName: "Alice",
          sellerPhone: "0712345678",
          countyId: kilimani.countyId,
          locationId: kilimani.id,
        }),
      },
      env as any
    );
    expect(badOriginRes.status).toBe(403);

    // 3. Upload valid WebP image to POST /api/platform/single-items/media
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([makeWebpBytes()], { type: "image/webp" }),
      "sofa.webp"
    );
    const mediaRes = await app.request(
      "https://store254.co.ke/api/platform/single-items/media",
      {
        method: "POST",
        headers: {
          Origin: "https://store254.co.ke",
          Cookie: aliceCookie,
          "CF-Connecting-IP": nextIp(),
        },
        body: formData,
      },
      env as any
    );
    expect(mediaRes.status).toBe(200);
    const mediaBody = (await mediaRes.json()) as any;
    expect(mediaBody.success).toBe(true);
    expect(mediaBody.data.url).toMatch(
      /^\/api\/media\/tenant-community-market\/.+\.webp$/
    );
    expect(r2Mock.objects.size).toBe(1);

    // 4. Create single item without any user/store row for Alice
    const createRes = await app.request(
      "https://store254.co.ke/api/platform/single-items",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
          Cookie: aliceCookie,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          title: "Slightly Used Sony PlayStation 5",
          basePrice: 65000,
          description: "Mint condition PS5 with two controllers in Kilimani.",
          itemType: "PHYSICAL",
          condition: "USED",
          sellerName: "Alice Wanjiku",
          sellerPhone: "0712345678",
          countyId: kilimani.countyId,
          locationId: kilimani.id,
          images: [mediaBody.data.url],
        }),
      },
      env as any
    );
    expect(createRes.status).toBe(201);
    const createBody = (await createRes.json()) as any;
    expect(createBody.success).toBe(true);
    expect(createBody.data.tenantId).toBe(COMMUNITY_MARKET_TENANT_ID);
    expect(createBody.data.status).toBe("PUBLISHED");
    expect(createBody.data.trackInventory).toBe(true);
    expect(createBody.data.stockQuantity).toBe(1);
    expect(createBody.data.metadata.isSingleListing).toBe(true);
    expect(createBody.data.metadata.sellerName).toBe("Alice Wanjiku");
    expect(createBody.data.metadata.sellerWhatsapp).toBe("0712345678");
    expect(createBody.data.metadata.sellerEmail).toBeUndefined();
    expect(JSON.stringify(createBody)).not.toContain("alice.seller@gmail.com");

    const createdItemId = createBody.data.id as string;

    // 5. Idempotency check on ensureCommunityMarketTenant & GET /api/platform/stores exclusion
    const db = createDb(d1);
    await ensureCommunityMarketTenant(db);
    const [marketTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, COMMUNITY_MARKET_TENANT_ID))
      .limit(1);
    expect(marketTenant).toBeDefined();
    expect(marketTenant?.subdomain).toBe(COMMUNITY_MARKET_SUBDOMAIN);
    expect(marketTenant?.name).toBe("Store254 Direct Sellers");
    expect(marketTenant?.status).toBe("ACTIVE");

    // Seed a regular active store to confirm GET /stores returns regular stores, not tenant-community-market
    sqlite
      .prepare(
        `INSERT INTO tenants (id, name, subdomain, business_type, status, settings) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run("tenant-regular", "Regular Shop", "regularshop", "RETAIL", "ACTIVE", "{}");

    const storesRes = await app.request(
      "https://store254.co.ke/api/platform/stores",
      { headers: { "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(storesRes.status).toBe(200);
    const storesBody = (await storesRes.json()) as any;
    expect(storesBody.data.some((s: any) => s.id === "tenant-regular")).toBe(true);
    expect(storesBody.data.some((s: any) => s.id === COMMUNITY_MARKET_TENANT_ID)).toBe(false);

    // 6. Marketplace detail endpoint overrides store fields with direct seller details & hides sellerEmail
    const detailRes = await app.request(
      `https://store254.co.ke/api/platform/marketplace/items/${createdItemId}`,
      { headers: { "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(detailRes.status).toBe(200);
    const detailBody = (await detailRes.json()) as any;
    expect(detailBody.data.store.name).toBe("Alice Wanjiku");
    expect(detailBody.data.store.phone).toBe("0712345678");
    expect(detailBody.data.store.whatsapp).toBe("0712345678");
    expect(detailBody.data.store.locationLabel).toContain("Kilimani");
    expect(detailBody.data.item.metadata.sellerEmail).toBeUndefined();
    expect(JSON.stringify(detailBody).toLowerCase()).not.toContain("alice.seller@gmail.com");

    // 7. Search service uses metadata.locationId for ripple ring & sellerName for store.name
    const searchRes = await app.request(
      `https://store254.co.ke/api/platform/search/products?q=PlayStation&locationId=${kilimani.id}`,
      { headers: { "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(searchRes.status).toBe(200);
    const searchBody = (await searchRes.json()) as any;
    expect(searchBody.results.length).toBe(1);
    expect(searchBody.results[0].id).toBe(createdItemId);
    expect(searchBody.results[0].store.name).toBe("Alice Wanjiku");
    expect(searchBody.results[0].store.locationLabel).toContain("Kilimani");
    expect(searchBody.results[0].geo.rippleRing).toBe(0);
    expect(searchBody.results[0].geo.distanceKm).toBe(0);
    expect(searchBody.results[0].metadata.sellerEmail).toBeUndefined();

    // 8. GET /mine returns Alice's items and NOT Bob's items
    const aliceMineRes = await app.request(
      "https://store254.co.ke/api/platform/single-items/mine",
      {
        headers: {
          Cookie: aliceCookie,
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(aliceMineRes.status).toBe(200);
    const aliceMineBody = (await aliceMineRes.json()) as any;
    expect(aliceMineBody.data).toHaveLength(1);
    expect(aliceMineBody.data[0].id).toBe(createdItemId);
    expect(aliceMineBody.data[0].metadata.sellerEmail).toBeUndefined();

    const bobMineRes = await app.request(
      "https://store254.co.ke/api/platform/single-items/mine",
      {
        headers: {
          Cookie: bobCookie,
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(bobMineRes.status).toBe(200);
    const bobMineBody = (await bobMineRes.json()) as any;
    expect(bobMineBody.data).toHaveLength(0);

    // 9. Cross-user PATCH & DELETE rejection (Bob cannot edit or delete Alice's listing)
    const bobPatchRes = await app.request(
      `https://store254.co.ke/api/platform/single-items/${createdItemId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
          Cookie: bobCookie,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({ status: "ARCHIVED", basePrice: 100 }),
      },
      env as any
    );
    expect(bobPatchRes.status).toBe(403);

    const bobDeleteRes = await app.request(
      `https://store254.co.ke/api/platform/single-items/${createdItemId}`,
      {
        method: "DELETE",
        headers: {
          Origin: "https://store254.co.ke",
          Cookie: bobCookie,
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(bobDeleteRes.status).toBe(403);

    // 10. Owner PATCH (mark sold / update price) & DELETE succeed
    const alicePatchRes = await app.request(
      `https://store254.co.ke/api/platform/single-items/${createdItemId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
          Cookie: aliceCookie,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({ status: "ARCHIVED", basePrice: 60000 }),
      },
      env as any
    );
    expect(alicePatchRes.status).toBe(200);
    const alicePatchBody = (await alicePatchRes.json()) as any;
    expect(alicePatchBody.data.status).toBe("ARCHIVED");
    expect(alicePatchBody.data.basePrice).toBe(60000);
    expect(alicePatchBody.data.metadata.sellerEmail).toBeUndefined();

    const aliceDeleteRes = await app.request(
      `https://store254.co.ke/api/platform/single-items/${createdItemId}`,
      {
        method: "DELETE",
        headers: {
          Origin: "https://store254.co.ke",
          Cookie: aliceCookie,
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(aliceDeleteRes.status).toBe(200);

    const remaining = await db
      .select()
      .from(items)
      .where(eq(items.id, createdItemId))
      .limit(1);
    expect(remaining).toHaveLength(0);
  });

  it("supports PORTFOLIO and TRANSPORT_RIDES business types, seeds portfolioMode settings on registration, and allows settings updates + basePrice: 0", async () => {
    expect(BUSINESS_TYPE_VALUES).toContain("PORTFOLIO");
    expect(BUSINESS_TYPE_VALUES).toContain("TRANSPORT_RIDES");

    const creatorEmail = "creative.studio@gmail.com";
    const creatorCookie = await issueGoogleCookie(creatorEmail, "Creative Studio");
    const nairobi = getStaticLocationById("loc-gn-184745")!;

    // 1. Register store with businessType = PORTFOLIO
    const regPortfolioRes = await app.request(
      "https://store254.co.ke/api/platform/register-store",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
          Cookie: creatorCookie,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          storeName: "Nairobi Design Studio",
          subdomain: "nairobistudio",
          businessType: "PORTFOLIO",
          ownerPassword: "StrongPassword123!",
          ownerFullName: "Jane Creative",
          ownerPhone: "0722000111",
          countyId: nairobi.countyId,
          locationId: nairobi.id,
        }),
      },
      env as any
    );
    expect(regPortfolioRes.status).toBe(201);
    const regPortfolioBody = (await regPortfolioRes.json()) as any;
    const studioTenantId = regPortfolioBody.data.store.id as string;

    // Activate store so GET /api/store and GET /api/platform/stores expose settings
    sqlite.prepare(`UPDATE tenants SET status = 'ACTIVE' WHERE id = ?`).run(studioTenantId);

    const db = createDb(d1);
    const [studioRow] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, studioTenantId))
      .limit(1);
    expect((studioRow?.settings as any)?.portfolioMode).toBe(true);
    expect((studioRow?.settings as any)?.storefrontArchetype).toBe("service-portfolio");
    expect((studioRow?.settings as any)?.productCardStyle).toBe("service-card");

    const storePublicRes = await app.request(
      "https://nairobistudio.store254.co.ke/api/store",
      {
        headers: {
          Host: "nairobistudio.store254.co.ke",
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(storePublicRes.status).toBe(200);
    const storePublicBody = (await storePublicRes.json()) as any;
    expect(storePublicBody.data.settings.portfolioMode).toBe(true);
    expect(storePublicBody.data.settings.storefrontArchetype).toBe("service-portfolio");
    expect(storePublicBody.data.settings.productCardStyle).toBe("service-card");

    // 2. Register store with businessType = SERVICES and explicit portfolioMode: true
    const regFlagRes = await app.request(
      "https://store254.co.ke/api/platform/register-store",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
          Cookie: creatorCookie,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          storeName: "Dev Portfolio",
          subdomain: "devportfolio",
          businessType: "SERVICES",
          portfolioMode: true,
          ownerPassword: "StrongPassword123!",
          ownerFullName: "Jane Creative",
          countyId: nairobi.countyId,
          locationId: nairobi.id,
        }),
      },
      env as any
    );
    expect(regFlagRes.status).toBe(201);
    const regFlagBody = (await regFlagRes.json()) as any;
    const [flagRow] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, regFlagBody.data.store.id))
      .limit(1);
    expect((flagRow?.settings as any)?.portfolioMode).toBe(true);
    expect((flagRow?.settings as any)?.storefrontArchetype).toBe("service-portfolio");
    expect((flagRow?.settings as any)?.productCardStyle).toBe("service-card");

    // 3. updateStoreProfileSchema accepts settings.portfolioMode
    expect(
      updateStoreProfileSchema.safeParse({ settings: { portfolioMode: true } }).success
    ).toBe(true);
    expect(
      updateStoreProfileSchema.safeParse({ settings: { portfolioMode: false } }).success
    ).toBe(true);

    // 4. Create portfolio item with basePrice: 0 via POST /api/items
    const ownerToken = await createAccessToken(
      {
        id: regPortfolioBody.data.owner.id,
        tenantId: studioTenantId,
        email: creatorEmail,
        role: "OWNER",
      },
      jwtSecret
    );

    expect(
      createItemSchema.safeParse({ title: "Zero Price Project", basePrice: 0 }).success
    ).toBe(true);
    expect(
      createItemSchema.safeParse({ title: "Negative Price", basePrice: -1 }).success
    ).toBe(false);

    const createProjectRes = await app.request(
      "https://nairobistudio.store254.co.ke/api/items",
      {
        method: "POST",
        headers: {
          Host: "nairobistudio.store254.co.ke",
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          title: "Fintech Mobile App Redesign",
          description: "Complete mobile UX overhaul.",
          itemType: "SERVICE",
          basePrice: 0,
          metadata: {
            isPortfolioProject: true,
            projectUrl: "https://behance.net/gallery/fintech-redesign",
            clientName: "PesaFlow Kenya",
            completedYear: "2026",
            sellerEmail: "private-internal@example.com",
            internalSecret: "do-not-expose",
          },
        }),
      },
      env as any
    );
    expect(createProjectRes.status).toBe(201);
    const projectBody = (await createProjectRes.json()) as any;
    expect(projectBody.data.basePrice).toBe(0);

    // Public GET /api/items/:slug sanitizes metadata while keeping portfolio fields
    const publicProjectRes = await app.request(
      `https://nairobistudio.store254.co.ke/api/items/${projectBody.data.slug}`,
      {
        headers: {
          Host: "nairobistudio.store254.co.ke",
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );
    expect(publicProjectRes.status).toBe(200);
    const publicProjectBody = (await publicProjectRes.json()) as any;
    expect(publicProjectBody.data.basePrice).toBe(0);
    expect(publicProjectBody.data.metadata).toEqual({
      isPortfolioProject: true,
      projectUrl: "https://behance.net/gallery/fintech-redesign",
      clientName: "PesaFlow Kenya",
      completedYear: "2026",
    });
    expect(publicProjectBody.data.metadata.sellerEmail).toBeUndefined();
    expect(publicProjectBody.data.metadata.internalSecret).toBeUndefined();
  });

  it("sanitizePublicItemMetadata preserves allowed portfolio/single-listing fields, validates projectUrl, and strips sellerEmail", () => {
    const sanitized = sanitizePublicItemMetadata({
      artworkIcon: "briefcase",
      serviceConfig: { available: true, deliveryMode: "ONLINE", duration: "2 weeks" },
      isPortfolioProject: true,
      projectUrl: "https://example.co.ke/case-study",
      clientName: "Acme Ltd",
      completedYear: "2025",
      isSingleListing: true,
      sellerName: "Samuel Kamau",
      sellerPhone: "0700111222",
      sellerWhatsapp: "254700111222",
      condition: "USED",
      locationLabel: "Westlands, Westlands, Nairobi",
      sellerEmail: "samuel.private@gmail.com",
      marginPercent: 40,
    });

    expect(sanitized).toEqual({
      artworkIcon: "briefcase",
      serviceConfig: { available: true, deliveryMode: "ONLINE", duration: "2 weeks" },
      isPortfolioProject: true,
      projectUrl: "https://example.co.ke/case-study",
      clientName: "Acme Ltd",
      completedYear: "2025",
      isSingleListing: true,
      sellerName: "Samuel Kamau",
      sellerPhone: "0700111222",
      sellerWhatsapp: "254700111222",
      condition: "USED",
      locationLabel: "Westlands, Westlands, Nairobi",
    });
    expect(sanitized.sellerEmail).toBeUndefined();
    expect(sanitized.marginPercent).toBeUndefined();

    // Reject dangerous URL schemes in projectUrl
    const xssMeta = sanitizePublicItemMetadata({
      isPortfolioProject: true,
      projectUrl: "javascript:alert(1)",
      sellerEmail: "leak@test.com",
    });
    expect(xssMeta.projectUrl).toBeUndefined();
    expect(xssMeta.sellerEmail).toBeUndefined();
  });
});
