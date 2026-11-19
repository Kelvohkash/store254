import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { sign } from "hono/jwt";
import app from "../src/index";

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

function initAdminTestSchema(sqlite: DatabaseSync) {
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
    CREATE TABLE orders (
      id text PRIMARY KEY NOT NULL,
      tenant_id text NOT NULL,
      order_number text NOT NULL,
      customer_id text,
      customer_name text NOT NULL,
      customer_email text NOT NULL,
      customer_phone text NOT NULL,
      shipping_address text DEFAULT '{}',
      currency text NOT NULL DEFAULT 'KES',
      subtotal integer NOT NULL,
      discount_amount integer NOT NULL DEFAULT 0,
      shipping_fee integer NOT NULL DEFAULT 0,
      total_amount integer NOT NULL,
      status text NOT NULL DEFAULT 'PENDING_PAYMENT',
      payment_status text NOT NULL DEFAULT 'PENDING',
      payment_method text NOT NULL DEFAULT 'MPESA',
      inventory_deducted integer NOT NULL DEFAULT 0,
      status_token_hash text,
      fulfillment_details text DEFAULT '{}',
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
    CREATE TABLE copyright_reports (
      id text PRIMARY KEY NOT NULL,
      tenant_id text,
      store_subdomain text,
      item_id text,
      item_title text,
      reported_image_url text NOT NULL,
      target_type text NOT NULL DEFAULT 'ITEM_IMAGE',
      page_url text,
      reporter_name text NOT NULL,
      reporter_email text NOT NULL,
      original_work_url text,
      reason text NOT NULL,
      good_faith_confirmed integer NOT NULL DEFAULT 1,
      status text NOT NULL DEFAULT 'OPEN',
      resolution_notes text,
      resolved_by text,
      resolved_at integer,
      created_at integer NOT NULL DEFAULT (unixepoch())
    );
  `);
}

describe("Super Admin Storefront Contact Phones", () => {
  const adminJwtSecret = "test-admin-jwt-secret-key-1234567890123456";
  let sqlite: DatabaseSync;
  let env: Record<string, any>;
  let adminToken: string;
  let ipCounter = 10;

  const nextIp = () => `198.51.100.${(ipCounter++ % 200) + 1}`;

  beforeEach(async () => {
    sqlite = new DatabaseSync(":memory:");
    initAdminTestSchema(sqlite);
    const d1 = createSqliteD1Shim(sqlite);
    env = {
      DB: d1,
      PRIMARY_DOMAIN: "store254.co.ke",
      ENVIRONMENT: "production",
      JWT_SECRET: "test-jwt-secret-key-12345678901234567890",
      PLATFORM_ADMIN_USERNAME: "platform-admin",
      PLATFORM_ADMIN_PASSWORD: "SuperAdminPassword123!",
      PLATFORM_ADMIN_JWT_SECRET: adminJwtSecret,
    };

    adminToken = await sign(
      {
        sub: "super-admin",
        email: "platform-admin",
        role: "SUPER_ADMIN",
        iss: "store254-platform",
        aud: "store254-platform-admin",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      adminJwtSecret,
      "HS256"
    );

    // 1. Store with settings.contactPhone, settings.socialLinks.whatsapp, distinct owner phone, and internal settings
    sqlite
      .prepare(`INSERT INTO tenants (id, name, subdomain, status, settings, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(
        "store-contact-full",
        "Alice Baby Care",
        "alicecare",
        "ACTIVE",
        JSON.stringify({
          contactPhone: "0712345678",
          contactEmail: "store@alice.co.ke",
          socialLinks: { whatsapp: "0712345679" },
          staffPermissions: { "staff-1": ["manage_orders"] },
          customDomainVerification: { token: "secret-verify-token" },
        }),
        1700000500
      );
    sqlite
      .prepare(`INSERT INTO users (id, tenant_id, email, password_hash, full_name, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run("owner-1", "store-contact-full", "alice@example.com", "hash", "Alice Wanjiku", "+254798765432", "OWNER");

    // 2. Store with only users.phone
    sqlite
      .prepare(`INSERT INTO tenants (id, name, subdomain, status, settings, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run("store-owner-only", "Kazi Hardware", "kazihardware", "PENDING", JSON.stringify({}), 1700000400);
    sqlite
      .prepare(`INSERT INTO users (id, tenant_id, email, password_hash, full_name, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run("owner-2", "store-owner-only", "kazi@example.com", "hash", "John Kamau", "+254722112233", "OWNER");

    // 3. Store with legacy settings.phone and no users.phone
    sqlite
      .prepare(`INSERT INTO tenants (id, name, subdomain, status, settings, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(
        "store-legacy-phone",
        "Legacy Electronics",
        "legacytech",
        "ACTIVE",
        JSON.stringify({ phone: "+254733445566" }),
        1700000300
      );
    sqlite
      .prepare(`INSERT INTO users (id, tenant_id, email, password_hash, full_name, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run("owner-3", "store-legacy-phone", "legacy@example.com", "hash", "Legacy Owner", null, "OWNER");

    // 4. Store with only settings.socialLinks.whatsapp URL
    sqlite
      .prepare(`INSERT INTO tenants (id, name, subdomain, status, settings, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(
        "store-wa-url",
        "WA Boutique",
        "waboutique",
        "ACTIVE",
        JSON.stringify({ socialLinks: { whatsapp: "https://wa.me/254700123456" } }),
        1700000200
      );

    // 5. Store with no phone anywhere
    sqlite
      .prepare(`INSERT INTO tenants (id, name, subdomain, status, settings, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run("store-no-phone", "Quiet Crafts", "quietcrafts", "SUSPENDED", JSON.stringify({}), 1700000100);

    // Copyright report linked to store-contact-full
    sqlite
      .prepare(
        `INSERT INTO copyright_reports (id, tenant_id, store_subdomain, item_title, reported_image_url, reporter_name, reporter_email, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "rep-1",
        "store-contact-full",
        "alicecare",
        "Baby Stroller",
        "/api/media/store-contact-full/stroller.webp",
        "Jane Reporter",
        "jane@example.com",
        "Unauthorized studio photo",
        "OPEN"
      );
  });

  const adminGet = (path: string) =>
    app.request(
      `https://store254.co.ke/api/platform/admin${path}`,
      {
        headers: {
          Origin: "https://store254.co.ke",
          Cookie: `__Host-store254_admin_session=${adminToken}`,
          "CF-Connecting-IP": nextIp(),
        },
      },
      env as any
    );

  it("returns storefront and owner phone numbers without leaking raw settings", async () => {
    const res = await adminGet("/stores?limit=50");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const byId = new Map<string, any>(body.data.map((s: any) => [s.id, s]));

    const full = byId.get("store-contact-full");
    expect(full.phone).toBe("0712345678");
    expect(full.contactPhone).toBe("0712345678");
    expect(full.whatsapp).toBe("0712345679");
    expect(full.ownerPhone).toBe("+254798765432");
    expect(full.ownerEmail).toBe("alice@example.com");
    expect(full.ownerName).toBe("Alice Wanjiku");
    expect(full.settings).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("staffPermissions");
    expect(JSON.stringify(body)).not.toContain("customDomainVerification");

    const ownerOnly = byId.get("store-owner-only");
    expect(ownerOnly.phone).toBe("+254722112233");
    expect(ownerOnly.contactPhone).toBeNull();
    expect(ownerOnly.ownerPhone).toBe("+254722112233");
    expect(ownerOnly.whatsapp).toBeNull();

    const legacy = byId.get("store-legacy-phone");
    expect(legacy.phone).toBe("+254733445566");
    expect(legacy.contactPhone).toBe("+254733445566");
    expect(legacy.ownerPhone).toBeNull();

    const waOnly = byId.get("store-wa-url");
    expect(waOnly.phone).toBe("+254700123456");
    expect(waOnly.whatsapp).toBe("https://wa.me/254700123456");
    expect(waOnly.contactPhone).toBeNull();
    expect(waOnly.ownerPhone).toBeNull();

    const noPhone = byId.get("store-no-phone");
    expect(noPhone.phone).toBeNull();
    expect(noPhone.contactPhone).toBeNull();
    expect(noPhone.ownerPhone).toBeNull();
    expect(noPhone.whatsapp).toBeNull();
  });

  it("supports searching stores by phone number including 07/254 normalization", async () => {
    const resLocalQuery = await adminGet("/stores?search=0722112233");
    expect(resLocalQuery.status).toBe(200);
    const localBody = (await resLocalQuery.json()) as any;
    expect(localBody.data.map((s: any) => s.id)).toEqual(["store-owner-only"]);

    const resIntlQuery = await adminGet("/stores?search=%2B254712345678");
    expect(resIntlQuery.status).toBe(200);
    const intlBody = (await resIntlQuery.json()) as any;
    expect(intlBody.data.map((s: any) => s.id)).toEqual(["store-contact-full"]);

    const resWaQuery = await adminGet("/stores?search=0700123456");
    expect(resWaQuery.status).toBe(200);
    const waBody = (await resWaQuery.json()) as any;
    expect(waBody.data.map((s: any) => s.id)).toEqual(["store-wa-url"]);
  });

  it("includes normalized contact object on GET /stores/:id", async () => {
    const res = await adminGet("/stores/store-contact-full");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.contact).toEqual({
      phone: "0712345678",
      contactPhone: "0712345678",
      ownerPhone: "+254798765432",
      whatsapp: "0712345679",
      email: "alice@example.com",
    });
  });

  it("includes storePhone and storeWhatsapp in GET /copyright-reports without leaking raw settings", async () => {
    const res = await adminGet("/copyright-reports?status=ALL");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].storePhone).toBe("0712345678");
    expect(body.data[0].storeWhatsapp).toBe("0712345679");
    expect(body.data[0].settings).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("staffPermissions");
    expect(JSON.stringify(body)).not.toContain("customDomainVerification");
  });
});
