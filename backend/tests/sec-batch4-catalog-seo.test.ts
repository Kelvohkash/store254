import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import app from "../src/index";
import { createAccessToken } from "../src/security/jwt";
import { createItemSchema, isTenantMediaPath } from "../src/modules/catalog/items.routes";

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
        const rows = stmt.all(...(params as any[])) as Record<string, unknown>[];
        if (rows.length === 0) {
          if (options?.columnNames) {
            const cols = stmt.columns().map((c) => c.name);
            return cols.length ? ([cols] as unknown as T[]) : [];
          }
          return [];
        }
        const keys = Object.keys(rows[0]);
        const values = rows.map((r) => keys.map((k) => r[k])) as unknown as T[];
        if (options?.columnNames) {
          return [keys as unknown as T, ...values];
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
      fulfillment_details text DEFAULT '{}',
      booking_details text DEFAULT '{}',
      notes text,
      created_at integer NOT NULL DEFAULT (unixepoch()),
      updated_at integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE order_items (
      id text PRIMARY KEY NOT NULL,
      tenant_id text NOT NULL,
      order_id text NOT NULL,
      item_id text,
      variant_id text,
      title text NOT NULL,
      sku text,
      unit_price integer NOT NULL,
      quantity integer NOT NULL,
      total_price integer NOT NULL,
      options text DEFAULT '{}',
      created_at integer NOT NULL DEFAULT (unixepoch())
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
  `);
}

describe("Security Fix Batch 4 (Catalog, Reviews & SEO Projection Hardening)", () => {
  const jwtSecret = "test-jwt-secret-key-12345678901234567890";
  let sqlite: DatabaseSync;
  let d1: D1Database;
  let env: Record<string, unknown>;
  let ipSeq = 1;

  const nextIp = () => `198.51.100.${(ipSeq++ % 250) + 1}`;
  const tenantHeaders = (slug: string, extra: Record<string, string> = {}) => ({
    "X-Tenant-Slug": slug,
    "X-Forwarded-Host": `${slug}.store254.co.ke`,
    "CF-Connecting-IP": nextIp(),
    ...extra,
  });

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    initTestSchema(sqlite);
    d1 = createSqliteD1Shim(sqlite);
    env = {
      DB: d1,
      PRIMARY_DOMAIN: "store254.co.ke",
      ENVIRONMENT: "development",
      JWT_SECRET: jwtSecret,
    };

    sqlite
      .prepare(`INSERT INTO tenants (id, name, subdomain, status, settings) VALUES (?, ?, ?, ?, ?)`)
      .run(
        "tenant-alice",
        "Alice Shop",
        "alice",
        "ACTIVE",
        JSON.stringify({
          logoUrl: "/api/media/tenant-alice/logo.webp",
          bannerUrl: "/api/media/tenant-alice/banner.webp",
          tagline: "Best baby gear",
          staffPermissions: { "staff-alice": ["manage_products", "manage_orders"] },
          internalAdminToken: "super-secret-internal-key",
          mpesaWebhookSecret: "secret-hook",
        })
      );

    sqlite
      .prepare(`INSERT INTO tenants (id, name, subdomain, status, settings) VALUES (?, ?, ?, ?, ?)`)
      .run(
        "tenant-bob",
        "Bob Store",
        "bob",
        "ACTIVE",
        JSON.stringify({
          logoUrl: "/api/media/tenant-bob/logo.webp",
          staffPermissions: { "staff-bob": ["delete_orders"] },
        })
      );

    sqlite
      .prepare(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status, email_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("owner-alice", "tenant-alice", "owner@alice.test", "hash", "Alice Owner", "OWNER", "ACTIVE", 1700000000);

    sqlite
      .prepare(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status, email_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("staff-alice", "tenant-alice", "staff@alice.store254.co.ke", "hash", "Alice Staff", "STAFF", "ACTIVE", 1700000000);

    sqlite
      .prepare(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status, email_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("cust-verified", "tenant-alice", "verified@buyer.test", "hash", "Verified Buyer", "CUSTOMER", "ACTIVE", 1700000000);

    sqlite
      .prepare(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status, email_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("cust-unverified", "tenant-alice", "unverified@buyer.test", "hash", "Unverified Buyer", "CUSTOMER", "ACTIVE", null);

    sqlite
      .prepare(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status, email_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("owner-bob", "tenant-bob", "owner@bob.test", "hash", "Bob Owner", "OWNER", "ACTIVE", 1700000000);

    sqlite
      .prepare(`INSERT INTO categories (id, tenant_id, name, slug) VALUES (?, ?, ?, ?)`)
      .run("cat-1", "tenant-alice", "Electronics", "electronics");

    sqlite
      .prepare(
        `INSERT INTO items (id, tenant_id, category_id, title, slug, description, item_type, base_price, cost_price, sku, barcode, status, images, attributes, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "item-pub",
        "tenant-alice",
        "cat-1",
        "Samsung Smart TV",
        "samsung-smart-tv",
        "55 inch 4K TV",
        "PHYSICAL",
        55000,
        32000,
        "SKU-TV-01",
        "BARCODE-INTERNAL-998877",
        "PUBLISHED",
        JSON.stringify(["/api/media/tenant-alice/tv.webp"]),
        JSON.stringify({ brand: "Samsung", screen_size: "55" }),
        JSON.stringify({
          artworkIcon: "tv",
          serviceConfig: { available: true, deliveryMode: "FLEXIBLE", duration: "60 mins" },
          internalSupplierNote: "Buy from Supplier X at 32k",
          marginPercent: 42,
        })
      );

    sqlite
      .prepare(
        `INSERT INTO items (id, tenant_id, category_id, title, slug, description, item_type, base_price, cost_price, sku, barcode, status, images, attributes, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "item-draft",
        "tenant-alice",
        "cat-1",
        "Secret Prototype",
        "secret-prototype",
        "Unreleased draft product",
        "PHYSICAL",
        99000,
        50000,
        "SKU-DRAFT-01",
        "BARCODE-DRAFT-001",
        "DRAFT",
        JSON.stringify([]),
        JSON.stringify({ brand: "Sony" }),
        JSON.stringify({ internalRoadmap: "Q4 launch" })
      );

    sqlite
      .prepare(
        `INSERT INTO items (id, tenant_id, category_id, title, slug, description, item_type, base_price, cost_price, sku, barcode, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "item-archived",
        "tenant-alice",
        "cat-1",
        "Old Archived Item",
        "old-archived-item",
        "Archived",
        "PHYSICAL",
        1000,
        400,
        "SKU-ARC-01",
        "BARCODE-ARC-001",
        "ARCHIVED"
      );

    sqlite
      .prepare(
        `INSERT INTO items (id, tenant_id, title, slug, base_price, status)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run("item-bob", "tenant-bob", "Bob Item", "shared-slug-bob", 2500, "PUBLISHED");
  });

  // -------------------------------------------------------------------------
  // SEC-08: Public Exposure of Internal tenants.settings & items.metadata
  // -------------------------------------------------------------------------
  describe("SEC-08: SEO endpoints sanitize tenant settings and strip internal item fields", () => {
    it("strips staffPermissions and internal keys on GET /api/platform/seo-stores", async () => {
      const res = await app.request(
        "https://store254.co.ke/api/platform/seo-stores",
        { headers: { "CF-Connecting-IP": nextIp() } },
        env as any
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);

      const alice = body.data.find((s: any) => s.id === "tenant-alice");
      expect(alice).toBeDefined();
      expect(alice.settings.logoUrl).toBe("/api/media/tenant-alice/logo.webp");
      expect(alice.settings.tagline).toBe("Best baby gear");
      expect(alice.settings.staffPermissions).toBeUndefined();
      expect(alice.settings.internalAdminToken).toBeUndefined();
      expect(alice.settings.mpesaWebhookSecret).toBeUndefined();
    });

    it("strips staffPermissions and internal keys on GET /api/seo/storefront", async () => {
      const res = await app.request(
        "https://alice.store254.co.ke/api/seo/storefront",
        { headers: tenantHeaders("alice") },
        env as any
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.tenant.settings.logoUrl).toBe("/api/media/tenant-alice/logo.webp");
      expect(body.data.tenant.settings.staffPermissions).toBeUndefined();
      expect(body.data.tenant.settings.internalAdminToken).toBeUndefined();

      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].slug).toBe("samsung-smart-tv");
      expect(body.data.items[0].costPrice).toBeUndefined();
      expect(body.data.items[0].barcode).toBeUndefined();
      expect(body.data.items[0].metadata).toBeUndefined();
    });

    it("sanitizes tenant settings and omits costPrice, barcode, and raw metadata on GET /api/seo/item/:slug", async () => {
      const res = await app.request(
        "https://alice.store254.co.ke/api/seo/item/samsung-smart-tv",
        { headers: tenantHeaders("alice") },
        env as any
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.tenant.settings.logoUrl).toBe("/api/media/tenant-alice/logo.webp");
      expect(body.data.tenant.settings.staffPermissions).toBeUndefined();
      expect(body.data.tenant.settings.internalAdminToken).toBeUndefined();
      expect(body.data.tenant.settings.mpesaWebhookSecret).toBeUndefined();

      expect(body.data.item.id).toBe("item-pub");
      expect(body.data.item.costPrice).toBeUndefined();
      expect(body.data.item.barcode).toBeUndefined();
      expect(body.data.item.metadata).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain("Buy from Supplier X");
      expect(JSON.stringify(body)).not.toContain("super-secret-internal-key");
      expect(JSON.stringify(body)).not.toContain("32000");
    });
  });

  // -------------------------------------------------------------------------
  // SEC-09: Review Verified-Buyer Spoofing & Order/Email Enumeration Oracle
  // -------------------------------------------------------------------------
  describe("SEC-09: Review verified-buyer restriction & anti-oracle behavior", () => {
    beforeEach(() => {
      // Completed order for cust-verified (by customerId)
      sqlite
        .prepare(
          `INSERT INTO orders (id, tenant_id, order_number, customer_id, customer_name, customer_email, customer_phone, subtotal, total_amount, status, payment_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          "ord-completed",
          "tenant-alice",
          "ORD-1001",
          "cust-verified",
          "Verified Buyer",
          "verified@buyer.test",
          "254712345678",
          55000,
          55000,
          "COMPLETED",
          "PAID"
        );
      sqlite
        .prepare(
          `INSERT INTO order_items (id, tenant_id, order_id, item_id, title, unit_price, quantity, total_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run("oi-1", "tenant-alice", "ord-completed", "item-pub", "Samsung Smart TV", 55000, 1, 55000);

      // Completed order for cust-unverified (user has emailVerifiedAt = null)
      sqlite
        .prepare(
          `INSERT INTO orders (id, tenant_id, order_number, customer_id, customer_name, customer_email, customer_phone, subtotal, total_amount, status, payment_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          "ord-unverified-user",
          "tenant-alice",
          "ORD-1002",
          "cust-unverified",
          "Unverified Buyer",
          "unverified@buyer.test",
          "254712345679",
          55000,
          55000,
          "COMPLETED",
          "PAID"
        );
      sqlite
        .prepare(
          `INSERT INTO order_items (id, tenant_id, order_id, item_id, title, unit_price, quantity, total_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run("oi-2", "tenant-alice", "ord-unverified-user", "item-pub", "Samsung Smart TV", 55000, 1, 55000);

      // Pending order for a verified user who hasn't paid yet
      sqlite
        .prepare(
          `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status, email_verified_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run("cust-pending-only", "tenant-alice", "pending@buyer.test", "hash", "Pending Buyer", "CUSTOMER", "ACTIVE", 1700000000);
      sqlite
        .prepare(
          `INSERT INTO orders (id, tenant_id, order_number, customer_id, customer_name, customer_email, customer_phone, subtotal, total_amount, status, payment_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          "ord-pending",
          "tenant-alice",
          "ORD-1003",
          "cust-pending-only",
          "Pending Buyer",
          "pending@buyer.test",
          "254712345680",
          55000,
          55000,
          "PENDING_PAYMENT",
          "PENDING"
        );
      sqlite
        .prepare(
          `INSERT INTO order_items (id, tenant_id, order_id, item_id, title, unit_price, quantity, total_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run("oi-3", "tenant-alice", "ord-pending", "item-pub", "Samsung Smart TV", 55000, 1, 55000);
    });

    it("never grants isVerifiedBuyer=true from unauthenticated customerEmail or orderNumber and omits oracle", async () => {
      const res = await app.request(
        "https://alice.store254.co.ke/api/items/item-pub/reviews",
        {
          method: "POST",
          headers: tenantHeaders("alice", { "Content-Type": "application/json" }),
          body: JSON.stringify({
            customerName: "Spoofer",
            customerEmail: "verified@buyer.test",
            orderNumber: "ORD-1001",
            rating: 5,
            comment: "Trying to spoof verified buyer!",
          }),
        },
        env as any
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect("isVerifiedBuyer" in body.data).toBe(false);

      const stored = sqlite
        .prepare(`SELECT is_verified_buyer FROM reviews WHERE id = ?`)
        .get(body.data.id) as { is_verified_buyer: number };
      expect(stored.is_verified_buyer).toBe(0);
    });

    it("denies isVerifiedBuyer=true when authenticated user email is unverified", async () => {
      const token = await createAccessToken(
        { id: "cust-unverified", tenantId: "tenant-alice", email: "unverified@buyer.test", role: "CUSTOMER" },
        jwtSecret
      );
      const res = await app.request(
        "https://alice.store254.co.ke/api/items/item-pub/reviews",
        {
          method: "POST",
          headers: tenantHeaders("alice", {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          }),
          body: JSON.stringify({
            customerName: "Unverified Buyer",
            rating: 5,
            comment: "My email is not verified yet.",
          }),
        },
        env as any
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.isVerifiedBuyer).toBe(false);
    });

    it("denies isVerifiedBuyer=true for PENDING_PAYMENT orders even when user email is verified", async () => {
      const token = await createAccessToken(
        { id: "cust-pending-only", tenantId: "tenant-alice", email: "pending@buyer.test", role: "CUSTOMER" },
        jwtSecret
      );
      const res = await app.request(
        "https://alice.store254.co.ke/api/items/item-pub/reviews",
        {
          method: "POST",
          headers: tenantHeaders("alice", {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          }),
          body: JSON.stringify({
            customerName: "Pending Buyer",
            rating: 4,
            comment: "Still pending payment.",
          }),
        },
        env as any
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.isVerifiedBuyer).toBe(false);
    });

    it("grants isVerifiedBuyer=true for verified user with COMPLETED order by customerId", async () => {
      const token = await createAccessToken(
        { id: "cust-verified", tenantId: "tenant-alice", email: "verified@buyer.test", role: "CUSTOMER" },
        jwtSecret
      );
      const res = await app.request(
        "https://alice.store254.co.ke/api/items/item-pub/reviews",
        {
          method: "POST",
          headers: tenantHeaders("alice", {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          }),
          body: JSON.stringify({
            customerName: "Verified Buyer",
            rating: 5,
            comment: "Great TV!",
          }),
        },
        env as any
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.isVerifiedBuyer).toBe(true);
    });

    it("grants isVerifiedBuyer=true for verified user with PAID guest order matching verified email", async () => {
      sqlite
        .prepare(
          `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status, email_verified_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run("cust-guest-later", "tenant-alice", "guestpaid@buyer.test", "hash", "Guest Paid", "CUSTOMER", "ACTIVE", 1700000000);
      sqlite
        .prepare(
          `INSERT INTO orders (id, tenant_id, order_number, customer_id, customer_name, customer_email, customer_phone, subtotal, total_amount, status, payment_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          "ord-guest-paid",
          "tenant-alice",
          "ORD-1004",
          null,
          "Guest Paid",
          "GuestPaid@buyer.test",
          "254712345681",
          55000,
          55000,
          "PAID",
          "PAID"
        );
      sqlite
        .prepare(
          `INSERT INTO order_items (id, tenant_id, order_id, item_id, title, unit_price, quantity, total_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run("oi-4", "tenant-alice", "ord-guest-paid", "item-pub", "Samsung Smart TV", 55000, 1, 55000);

      const token = await createAccessToken(
        { id: "cust-guest-later", tenantId: "tenant-alice", email: "guestpaid@buyer.test", role: "CUSTOMER" },
        jwtSecret
      );
      const res = await app.request(
        "https://alice.store254.co.ke/api/items/item-pub/reviews",
        {
          method: "POST",
          headers: tenantHeaders("alice", {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          }),
          body: JSON.stringify({
            customerName: "Guest Paid",
            rating: 5,
            comment: "Checked out as guest, verified email later!",
          }),
        },
        env as any
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.isVerifiedBuyer).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // SEC-15: Access Control on GET /api/items/:slug, Pagination, Slug Conflict
  // -------------------------------------------------------------------------
  describe("SEC-15: Item access control, pagination clamping, and PUT slug conflict", () => {
    it("blocks DRAFT and ARCHIVED items on GET /api/items/:slug for unauthenticated and CUSTOMER callers", async () => {
      for (const slug of ["secret-prototype", "old-archived-item"]) {
        const unauthRes = await app.request(
          `https://alice.store254.co.ke/api/items/${slug}`,
          { headers: tenantHeaders("alice") },
          env as any
        );
        expect(unauthRes.status).toBe(404);

        const custToken = await createAccessToken(
          { id: "cust-verified", tenantId: "tenant-alice", email: "verified@buyer.test", role: "CUSTOMER" },
          jwtSecret
        );
        const custRes = await app.request(
          `https://alice.store254.co.ke/api/items/${slug}`,
          { headers: tenantHeaders("alice", { Authorization: `Bearer ${custToken}` }) },
          env as any
        );
        expect(custRes.status).toBe(404);
      }

      // Cross-tenant owner token cannot view Alice's draft
      const bobToken = await createAccessToken(
        { id: "owner-bob", tenantId: "tenant-bob", email: "owner@bob.test", role: "OWNER" },
        jwtSecret
      );
      const crossRes = await app.request(
        "https://alice.store254.co.ke/api/items/secret-prototype",
        { headers: tenantHeaders("alice", { Authorization: `Bearer ${bobToken}` }) },
        env as any
      );
      expect(crossRes.status).toBe(404);
    });

    it("strips costPrice, barcode, and internal metadata on GET /api/items/:slug for public and CUSTOMER callers", async () => {
      const custToken = await createAccessToken(
        { id: "cust-verified", tenantId: "tenant-alice", email: "verified@buyer.test", role: "CUSTOMER" },
        jwtSecret
      );

      for (const extraHeaders of [{}, { Authorization: `Bearer ${custToken}` }]) {
        const res = await app.request(
          "https://alice.store254.co.ke/api/items/samsung-smart-tv",
          { headers: tenantHeaders("alice", extraHeaders) },
          env as any
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect("costPrice" in body.data).toBe(false);
        expect("barcode" in body.data).toBe(false);
        expect(body.data.metadata.artworkIcon).toBe("tv");
        expect(body.data.metadata.serviceConfig).toEqual({
          available: true,
          deliveryMode: "FLEXIBLE",
          duration: "60 mins",
        });
        expect(body.data.metadata.internalSupplierNote).toBeUndefined();
        expect(body.data.metadata.marginPercent).toBeUndefined();
      }
    });

    it("allows tenant OWNER and active STAFF to view DRAFT items and internal fields on GET /api/items/:slug", async () => {
      const ownerToken = await createAccessToken(
        { id: "owner-alice", tenantId: "tenant-alice", email: "owner@alice.test", role: "OWNER" },
        jwtSecret
      );
      const ownerRes = await app.request(
        "https://alice.store254.co.ke/api/items/secret-prototype",
        { headers: tenantHeaders("alice", { Authorization: `Bearer ${ownerToken}` }) },
        env as any
      );
      expect(ownerRes.status).toBe(200);
      const ownerBody = await ownerRes.json();
      expect(ownerBody.data.status).toBe("DRAFT");
      expect(ownerBody.data.costPrice).toBe(50000);
      expect(ownerBody.data.barcode).toBe("BARCODE-DRAFT-001");
      expect(ownerBody.data.metadata.internalRoadmap).toBe("Q4 launch");

      const staffToken = await createAccessToken(
        { id: "staff-alice", tenantId: "tenant-alice", email: "staff@alice.store254.co.ke", role: "STAFF" },
        jwtSecret
      );
      const staffRes = await app.request(
        "https://alice.store254.co.ke/api/items/secret-prototype",
        { headers: tenantHeaders("alice", { Authorization: `Bearer ${staffToken}` }) },
        env as any
      );
      expect(staffRes.status).toBe(200);
      const staffBody = await staffRes.json();
      expect(staffBody.data.costPrice).toBe(50000);
    });

    it("handles non-numeric and out-of-range page/limit query params without NaN SQL errors", async () => {
      const resInvalid = await app.request(
        "https://alice.store254.co.ke/api/items?page=abc&limit=xyz",
        { headers: tenantHeaders("alice") },
        env as any
      );
      expect(resInvalid.status).toBe(200);
      const invalidBody = await resInvalid.json();
      expect(invalidBody.pagination.page).toBe(1);
      expect(invalidBody.pagination.limit).toBe(50);
      expect(invalidBody.data).toHaveLength(1);
      expect(invalidBody.data[0].metadata.internalSupplierNote).toBeUndefined();

      const resClamped = await app.request(
        "https://alice.store254.co.ke/api/items?page=-10&limit=999",
        { headers: tenantHeaders("alice") },
        env as any
      );
      expect(resClamped.status).toBe(200);
      const clampedBody = await resClamped.json();
      expect(clampedBody.pagination.page).toBe(1);
      expect(clampedBody.pagination.limit).toBe(200);

      const resZeroLimit = await app.request(
        "https://alice.store254.co.ke/api/items?page=0&limit=0",
        { headers: tenantHeaders("alice") },
        env as any
      );
      expect(resZeroLimit.status).toBe(200);
      const zeroBody = await resZeroLimit.json();
      expect(zeroBody.pagination.page).toBe(1);
      expect(zeroBody.pagination.limit).toBe(1);
    });

    it("returns 409 SLUG_TAKEN on PUT /api/items/:id when slug collides in same tenant", async () => {
      const ownerToken = await createAccessToken(
        { id: "owner-alice", tenantId: "tenant-alice", email: "owner@alice.test", role: "OWNER" },
        jwtSecret
      );

      // Colliding with another item in the same tenant
      const conflictRes = await app.request(
        "https://alice.store254.co.ke/api/items/item-draft",
        {
          method: "PUT",
          headers: tenantHeaders("alice", {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ownerToken}`,
          }),
          body: JSON.stringify({ slug: "samsung-smart-tv" }),
        },
        env as any
      );
      expect(conflictRes.status).toBe(409);
      const conflictBody = await conflictRes.json();
      expect(conflictBody.error.code).toBe("SLUG_TAKEN");

      // Updating own item with its own slug succeeds
      const selfRes = await app.request(
        "https://alice.store254.co.ke/api/items/item-draft",
        {
          method: "PUT",
          headers: tenantHeaders("alice", {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ownerToken}`,
          }),
          body: JSON.stringify({ slug: "secret-prototype", title: "Secret Prototype v2" }),
        },
        env as any
      );
      expect(selfRes.status).toBe(200);

      // Using a slug that exists in a DIFFERENT tenant succeeds
      const crossTenantSlugRes = await app.request(
        "https://alice.store254.co.ke/api/items/item-draft",
        {
          method: "PUT",
          headers: tenantHeaders("alice", {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ownerToken}`,
          }),
          body: JSON.stringify({ slug: "shared-slug-bob" }),
        },
        env as any
      );
      expect(crossTenantSlugRes.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // SEC-21: Permissive Media Path Validation
  // -------------------------------------------------------------------------
  describe("SEC-21: Strict media path validation", () => {
    it("accepts valid alphanumeric/dot/underscore/hyphen tenant media paths", () => {
      expect(isTenantMediaPath("/api/media/tenant-alice/tv_photo-01.webp", "tenant-alice")).toBe(true);
      expect(isTenantMediaPath("/api/media/t_123/img.jpg", "t_123")).toBe(true);
    });

    it("rejects traversal, query, fragment, slash, backslash, and encoded paths", () => {
      const badPaths = [
        "/api/media/tenant-alice/../tenant-bob/logo.webp",
        "/api/media/tenant-alice/..",
        "/api/media/tenant-alice/.",
        "/api/media/tenant-alice/photo..webp",
        "/api/media/tenant-alice/photo.webp?width=100",
        "/api/media/tenant-alice/photo.webp#frag",
        "/api/media/tenant-alice/nested/photo.webp",
        "/api/media/tenant-alice/photo\\evil.webp",
        "/api/media/tenant-alice/photo%2F..webp",
        "/api/media/tenant-alice/photo name.webp",
      ];
      for (const path of badPaths) {
        expect(isTenantMediaPath(path, "tenant-alice")).toBe(false);
        const parsed = createItemSchema.safeParse({
          title: "Bad media",
          basePrice: 500,
          images: [path],
        });
        expect(parsed.success).toBe(false);
      }

      expect(isTenantMediaPath("/api/media/../evil/photo.webp", "../evil")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // SEC-26: Prototype Key Lookup in Catalog Filters
  // -------------------------------------------------------------------------
  describe("SEC-26: Rejects prototype key lookups in catalog attribute filters", () => {
    it("does not match Object.prototype keys (__proto__, constructor, prototype, toString)", async () => {
      for (const key of ["__proto__", "constructor", "prototype", "toString", "valueOf"]) {
        const res = await app.request(
          `https://alice.store254.co.ke/api/items?${encodeURIComponent(key)}=function`,
          { headers: tenantHeaders("alice") },
          env as any
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toEqual([]);
      }
    });

    it("still filters by own attribute keys accurately", async () => {
      const res = await app.request(
        "https://alice.store254.co.ke/api/items?brand=Samsung",
        { headers: tenantHeaders("alice") },
        env as any
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].slug).toBe("samsung-smart-tv");
    });
  });
});
