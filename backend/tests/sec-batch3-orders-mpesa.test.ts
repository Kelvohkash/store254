import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import app from "../src/index";
import { createDb } from "../src/db";
import { createAccessToken } from "../src/security/jwt";
import { hashOtp } from "../src/security/crypto";
import { createOrderForTenant } from "../src/modules/orders/checkout.service";

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
      status text NOT NULL DEFAULT 'ACTIVE',
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
      inventory_deducted integer NOT NULL DEFAULT 0,
      status_token_hash text,
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
    CREATE TABLE payments (
      id text PRIMARY KEY NOT NULL,
      tenant_id text NOT NULL,
      order_id text NOT NULL,
      payment_method text NOT NULL DEFAULT 'MPESA',
      amount integer NOT NULL,
      currency text NOT NULL DEFAULT 'KES',
      status text NOT NULL DEFAULT 'INITIATED',
      merchant_request_id text,
      checkout_request_id text UNIQUE,
      callback_token_hash text,
      status_token_hash text,
      mpesa_receipt_number text,
      transaction_date integer,
      phone_number text,
      result_code integer,
      result_desc text,
      raw_callback text DEFAULT '{}',
      created_at integer NOT NULL DEFAULT (unixepoch()),
      updated_at integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE UNIQUE INDEX payments_mpesa_receipt_unique_idx ON payments (mpesa_receipt_number) WHERE mpesa_receipt_number IS NOT NULL;
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
  `);
}

describe("Security Fix Batch 3 (Orders, Checkout, Inventory, M-Pesa & Migration 0015)", () => {
  const jwtSecret = "test-jwt-secret-key-12345678901234567890";
  const paymentEncKey = "test-payment-encryption-key-1234567890";
  let sqlite: DatabaseSync;
  let d1: D1Database;
  let env: Record<string, unknown>;
  let ipSeq = 1;

  const nextIp = () => `192.0.2.${(ipSeq++ % 240) + 10}`;
  const tenantHeaders = (slug: string, extra: Record<string, string> = {}, ip = nextIp()) => ({
    "X-Tenant-Slug": slug,
    "X-Forwarded-Host": `${slug}.store254.co.ke`,
    "CF-Connecting-IP": ip,
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
      PAYMENT_CONFIG_ENCRYPTION_KEY: paymentEncKey,
    };

    sqlite
      .prepare(`INSERT INTO tenants (id, name, subdomain, status, settings) VALUES (?, ?, ?, ?, ?)`)
      .run(
        "tenant-alice",
        "Alice Shop",
        "alice",
        "ACTIVE",
        JSON.stringify({ staffPermissions: {} })
      );
    sqlite
      .prepare(`INSERT INTO tenants (id, name, subdomain, status, settings) VALUES (?, ?, ?, ?, ?)`)
      .run(
        "tenant-bob",
        "Bob Shop",
        "bob",
        "ACTIVE",
        JSON.stringify({ staffPermissions: {} })
      );

    sqlite
      .prepare(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status, email_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("owner-alice", "tenant-alice", "owner@alice.com", "h", "Alice Owner", "OWNER", "ACTIVE", 1700000000);

    sqlite
      .prepare(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status, email_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("owner-bob", "tenant-bob", "owner@bob.com", "h", "Bob Owner", "OWNER", "ACTIVE", 1700000000);

    sqlite
      .prepare(
        `INSERT INTO items (id, tenant_id, title, slug, item_type, base_price, track_inventory, stock_quantity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("item-shoe", "tenant-alice", "Sneaker", "sneaker", "PHYSICAL", 2500, 1, 5, "PUBLISHED");

    sqlite
      .prepare(
        `INSERT INTO items (id, tenant_id, title, slug, item_type, base_price, track_inventory, stock_quantity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("item-bag", "tenant-alice", "Backpack", "backpack", "PHYSICAL", 1500, 1, 4, "PUBLISHED");

    sqlite
      .prepare(
        `INSERT INTO item_variants (id, tenant_id, item_id, title, price, stock_quantity)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run("var-bag-red", "tenant-alice", "item-bag", "Red", 1600, 3);

    sqlite
      .prepare(
        `INSERT INTO items (id, tenant_id, title, slug, item_type, base_price, track_inventory, stock_quantity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("item-bob", "tenant-bob", "Bob Shirt", "bob-shirt", "PHYSICAL", 1000, 1, 10, "PUBLISHED");

    sqlite
      .prepare(
        `INSERT INTO item_variants (id, tenant_id, item_id, title, price, stock_quantity)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run("var-bob-1", "tenant-bob", "item-bob", "L", 1000, 10);
  });

  it("Migration 0015 adds status_token_hash, backfills inventory_deducted, and enforces unique partial index on mpesa_receipt_number", () => {
    const legacyDb = new DatabaseSync(":memory:");
    legacyDb.exec(`
      CREATE TABLE orders (
        id text PRIMARY KEY NOT NULL,
        tenant_id text NOT NULL,
        order_number text NOT NULL,
        inventory_deducted integer NOT NULL DEFAULT 0,
        fulfillment_details text DEFAULT '{}'
      );
      CREATE TABLE payments (
        id text PRIMARY KEY NOT NULL,
        tenant_id text NOT NULL,
        order_id text NOT NULL,
        mpesa_receipt_number text
      );
      CREATE INDEX payments_mpesa_receipt_idx ON payments (mpesa_receipt_number);
      INSERT INTO orders (id, tenant_id, order_number, inventory_deducted, fulfillment_details) VALUES
        ('o1', 't1', 'ORD-1', 0, '{"inventoryDeducted":true}'),
        ('o2', 't1', 'ORD-2', 0, '{"orderKind":"PRODUCT_ORDER"}');
      INSERT INTO payments (id, tenant_id, order_id, mpesa_receipt_number) VALUES
        ('p1', 't1', 'o1', NULL),
        ('p2', 't1', 'o2', NULL);
    `);

    const sqlPath = path.resolve(
      __dirname,
      "../drizzle/0015_orders_status_token_and_mpesa_receipt.sql"
    );
    const statements = fs
      .readFileSync(sqlPath, "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      legacyDb.exec(stmt);
    }

    const ordersRows = legacyDb
      .prepare("SELECT id, inventory_deducted, status_token_hash FROM orders")
      .all() as Array<{ id: string; inventory_deducted: number; status_token_hash: string | null }>;
    const byId = Object.fromEntries(ordersRows.map((r) => [r.id, r]));
    expect(byId.o1.inventory_deducted).toBe(1);
    expect(byId.o2.inventory_deducted).toBe(0);
    expect(byId.o1.status_token_hash).toBeNull();

    // Multiple NULL receipts are allowed
    legacyDb.prepare("INSERT INTO payments (id, tenant_id, order_id, mpesa_receipt_number) VALUES ('p3', 't1', 'o2', NULL)").run();
    // Duplicate non-NULL receipt is rejected
    legacyDb.prepare("UPDATE payments SET mpesa_receipt_number = 'RCP123' WHERE id = 'p1'").run();
    expect(() =>
      legacyDb.prepare("UPDATE payments SET mpesa_receipt_number = 'RCP123' WHERE id = 'p2'").run()
    ).toThrow(/UNIQUE/i);
  });

  it("SEC-01 & SEC-02: blocks unverified email matching, null===null phone bypass, and unauthenticated PII exposure; supports statusToken", async () => {
    // Create unverified customer and verified customer with victim's email
    sqlite
      .prepare(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status, email_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("cust-unverified", "tenant-alice", "victim@example.com", "h", "Attacker", "CUSTOMER", "PENDING_VERIFICATION", null);

    sqlite
      .prepare(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status, email_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("cust-active-unverified", "tenant-alice", "victim@example.com", "h", "Active Unverified", "CUSTOMER", "ACTIVE", null);

    sqlite
      .prepare(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status, email_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("cust-verified", "tenant-alice", "verified@example.com", "h", "Verified Buyer", "CUSTOMER", "ACTIVE", 1700000000);

    sqlite
      .prepare(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status, email_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("cust-suspended", "tenant-alice", "suspended@example.com", "h", "Suspended", "CUSTOMER", "SUSPENDED", 1700000000);

    // Guest checkout with non-Kenyan phone (normalizeKenyanPhone returns null!) for victim@example.com
    const checkoutRes = await app.request(
      "https://alice.store254.co.ke/api/orders/checkout",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...tenantHeaders("alice"),
        },
        body: JSON.stringify({
          customerName: "Victim Real Name",
          customerEmail: "victim@example.com",
          customerPhone: "+1-555-0199",
          paymentMethod: "CASH_ON_DELIVERY",
          deliveryAddress: "Westlands Mall, Nairobi",
          bookingDetails: { serviceLocation: "Secret Apartment 4B" },
          items: [{ itemId: "item-shoe", quantity: 1 }],
          notes: "Leave with security",
        }),
      },
      env as any
    );
    expect(checkoutRes.status).toBe(201);
    const checkoutJson = (await checkoutRes.json()) as any;
    const orderId = checkoutJson.data.orderId;
    const statusToken = checkoutJson.data.statusToken;
    expect(typeof statusToken).toBe("string");
    expect(statusToken.length).toBeGreaterThanOrEqual(32);
    expect(checkoutJson.data.orderNumber).toMatch(/^ORD-[0-9A-F]{10}$/);

    // Mark order SHIPPED so confirm-delivery eligibility applies
    sqlite.prepare(`UPDATE orders SET status = 'SHIPPED' WHERE id = ?`).run(orderId);

    // 1. Unauthenticated caller with ?phone=invalid (null === null bypass attempt) is blocked and gets NO PII/items/masked phone
    const nullBypassRes = await app.request(
      `https://alice.store254.co.ke/api/orders/${orderId}?phone=not-a-kenyan-number`,
      { headers: tenantHeaders("alice") },
      env as any
    );
    expect([401, 403]).toContain(nullBypassRes.status);
    const nullBypassBody = await nullBypassRes.text();
    expect(nullBypassBody).not.toContain("Secret Apartment 4B");
    expect(nullBypassBody).not.toContain("Sneaker");
    expect(nullBypassBody).not.toContain("Leave with security");
    expect(nullBypassBody).not.toContain("+1-5");

    // 2. Unverified customer (PENDING_VERIFICATION and ACTIVE without emailVerifiedAt) with same email cannot see order in /my-orders, GET /:id, or confirm-delivery
    const unverifiedToken = await createAccessToken(
      { id: "cust-unverified", tenantId: "tenant-alice", email: "victim@example.com", role: "CUSTOMER" },
      jwtSecret
    );
    const myOrdersUnverified = await app.request(
      "https://alice.store254.co.ke/api/orders/my-orders",
      { headers: tenantHeaders("alice", { Authorization: `Bearer ${unverifiedToken}` }) },
      env as any
    );
    expect(myOrdersUnverified.status).toBe(403);

    const activeUnverifiedToken = await createAccessToken(
      { id: "cust-active-unverified", tenantId: "tenant-alice", email: "victim@example.com", role: "CUSTOMER" },
      jwtSecret
    );
    const myOrdersActiveUnverified = await app.request(
      "https://alice.store254.co.ke/api/orders/my-orders",
      { headers: tenantHeaders("alice", { Authorization: `Bearer ${activeUnverifiedToken}` }) },
      env as any
    );
    expect(myOrdersActiveUnverified.status).toBe(200);
    expect(((await myOrdersActiveUnverified.json()) as any).data).toHaveLength(0);

    const getUnverified = await app.request(
      `https://alice.store254.co.ke/api/orders/${orderId}`,
      { headers: tenantHeaders("alice", { Authorization: `Bearer ${activeUnverifiedToken}` }) },
      env as any
    );
    expect(getUnverified.status).toBe(403);

    const confirmUnverified = await app.request(
      `https://alice.store254.co.ke/api/orders/${orderId}/confirm-delivery`,
      {
        method: "POST",
        headers: tenantHeaders("alice", { Authorization: `Bearer ${activeUnverifiedToken}` }),
      },
      env as any
    );
    expect(confirmUnverified.status).toBe(403);

    // 3. Wrong statusToken is rejected
    const wrongTokenRes = await app.request(
      `https://alice.store254.co.ke/api/orders/${orderId}`,
      { headers: tenantHeaders("alice", { "X-Order-Status-Token": "wrong-token" }) },
      env as any
    );
    expect(wrongTokenRes.status).toBe(403);

    // 4. Valid statusToken via X-Order-Status-Token header grants read access without leaking statusTokenHash
    const validHeaderRes = await app.request(
      `https://alice.store254.co.ke/api/orders/${orderId}`,
      { headers: tenantHeaders("alice", { "X-Order-Status-Token": statusToken }) },
      env as any
    );
    expect(validHeaderRes.status).toBe(200);
    const validHeaderJson = (await validHeaderRes.json()) as any;
    expect(validHeaderJson.data.id).toBe(orderId);
    expect(validHeaderJson.data.items).toHaveLength(1);
    expect(validHeaderJson.data.statusTokenHash).toBeUndefined();

    // 5. Valid statusToken via ?token= query fallback works for GET and confirm-delivery
    const validQueryRes = await app.request(
      `https://alice.store254.co.ke/api/orders/${orderId}?token=${encodeURIComponent(statusToken)}`,
      { headers: tenantHeaders("alice") },
      env as any
    );
    expect(validQueryRes.status).toBe(200);

    // 5b. Merchant owner of same tenant can read GET /api/orders/:id; cross-tenant merchant is blocked
    const aliceOwnerToken = await createAccessToken(
      { id: "owner-alice", tenantId: "tenant-alice", email: "owner@alice.com", role: "OWNER" },
      jwtSecret
    );
    const bobOwnerToken = await createAccessToken(
      { id: "owner-bob", tenantId: "tenant-bob", email: "owner@bob.com", role: "OWNER" },
      jwtSecret
    );
    const merchantReadRes = await app.request(
      `https://alice.store254.co.ke/api/orders/${orderId}`,
      { headers: tenantHeaders("alice", { Authorization: `Bearer ${aliceOwnerToken}` }) },
      env as any
    );
    expect(merchantReadRes.status).toBe(200);
    const crossMerchantReadRes = await app.request(
      `https://alice.store254.co.ke/api/orders/${orderId}`,
      { headers: tenantHeaders("alice", { Authorization: `Bearer ${bobOwnerToken}` }) },
      env as any
    );
    expect(crossMerchantReadRes.status).toBe(401);

    const confirmWithToken = await app.request(
      `https://alice.store254.co.ke/api/orders/${orderId}/confirm-delivery`,
      {
        method: "POST",
        headers: tenantHeaders("alice", { "X-Order-Status-Token": statusToken }),
      },
      env as any
    );
    expect(confirmWithToken.status).toBe(200);
    expect(((await confirmWithToken.json()) as any).data.status).toBe("COMPLETED");

    // 6. Verified ACTIVE customer CAN match guest orders by email; SUSPENDED customer cannot
    const db = createDb(d1);
    const verifiedOrder = await createOrderForTenant(
      db,
      env as any,
      { id: "tenant-alice", name: "Alice Shop", currency: "KES" },
      null,
      {
        customerName: "Verified Buyer",
        customerEmail: "verified@example.com",
        customerPhone: "0712345678",
        paymentMethod: "CASH_ON_DELIVERY",
        deliveryAddress: "Kilimani, Nairobi",
        shippingAddress: {},
        items: [{ itemId: "item-shoe", quantity: 1 }],
      }
    );
    await createOrderForTenant(
      db,
      env as any,
      { id: "tenant-alice", name: "Alice Shop", currency: "KES" },
      null,
      {
        customerName: "Suspended Buyer",
        customerEmail: "suspended@example.com",
        customerPhone: "0712345679",
        paymentMethod: "CASH_ON_DELIVERY",
        deliveryAddress: "Kilimani, Nairobi",
        shippingAddress: {},
        items: [{ itemId: "item-shoe", quantity: 1 }],
      }
    );

    const verifiedToken = await createAccessToken(
      { id: "cust-verified", tenantId: "tenant-alice", email: "verified@example.com", role: "CUSTOMER" },
      jwtSecret
    );
    const myOrdersVerified = await app.request(
      "https://alice.store254.co.ke/api/orders/my-orders",
      { headers: tenantHeaders("alice", { Authorization: `Bearer ${verifiedToken}` }) },
      env as any
    );
    expect(myOrdersVerified.status).toBe(200);
    const verifiedList = ((await myOrdersVerified.json()) as any).data;
    expect(verifiedList).toHaveLength(1);
    expect(verifiedList[0].id).toBe(verifiedOrder.data.orderId);
    expect(verifiedList[0].statusTokenHash).toBeUndefined();

    const suspendedToken = await createAccessToken(
      { id: "cust-suspended", tenantId: "tenant-alice", email: "suspended@example.com", role: "CUSTOMER" },
      jwtSecret
    );
    const myOrdersSuspended = await app.request(
      "https://alice.store254.co.ke/api/orders/my-orders",
      { headers: tenantHeaders("alice", { Authorization: `Bearer ${suspendedToken}` }) },
      env as any
    );
    expect(myOrdersSuspended.status).toBe(403);
  });

  it("SEC-06: prevents duplicate-line overselling, rolls back COD stock on 409, blocks status-cycling stock inflation, and tenant-scopes DELETE", async () => {
    // 1. Duplicate cart lines exceeding stock (item-shoe stock is 5; 3 + 3 = 6)
    const dupRes = await app.request(
      "https://alice.store254.co.ke/api/orders/checkout",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tenantHeaders("alice") },
        body: JSON.stringify({
          customerName: "Buyer",
          customerEmail: "buyer@example.com",
          customerPhone: "0712345678",
          paymentMethod: "CASH_ON_DELIVERY",
          deliveryAddress: "CBD, Nairobi",
          items: [
            { itemId: "item-shoe", quantity: 3 },
            { itemId: "item-shoe", quantity: 3 },
          ],
        }),
      },
      env as any
    );
    expect([400, 409]).toContain(dupRes.status);
    expect(((await dupRes.json()) as any).error.code).toBe("INSUFFICIENT_STOCK");
    expect((sqlite.prepare(`SELECT stock_quantity FROM items WHERE id = 'item-shoe'`).get() as any).stock_quantity).toBe(5);

    // 2. Concurrent COD stock race: item-shoe has 5, two checkouts each want 3 -> one wins (stock 2), one fails (409 or 400)
    const makeCodReq = () =>
      app.request(
        "https://alice.store254.co.ke/api/orders/checkout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...tenantHeaders("alice") },
          body: JSON.stringify({
            customerName: "Race Buyer",
            customerEmail: "race@example.com",
            customerPhone: "0712345678",
            paymentMethod: "CASH_ON_DELIVERY",
            deliveryAddress: "CBD, Nairobi",
            items: [{ itemId: "item-shoe", quantity: 3 }],
          }),
        },
        env as any
      );
    const [r1, r2] = await Promise.all([makeCodReq(), makeCodReq()]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses[0]).toBe(201);
    expect([400, 409]).toContain(statuses[1]);
    expect((sqlite.prepare(`SELECT stock_quantity FROM items WHERE id = 'item-shoe'`).get() as any).stock_quantity).toBe(2);

    // 3. Atomic multi-line COD rollback when second line fails conditional UPDATE
    // Reset item-shoe stock to 5, var-bag-red stock to 3; intercept second conditional UPDATE to simulate concurrent depletion
    sqlite.prepare(`UPDATE items SET stock_quantity = 5 WHERE id = 'item-shoe'`).run();
    sqlite.prepare(`UPDATE item_variants SET stock_quantity = 3 WHERE id = 'var-bag-red'`).run();
    const basePrepare = d1.prepare.bind(d1);
    let intercepted = false;
    const raceD1 = {
      ...d1,
      prepare(query: string) {
        const prepared = basePrepare(query);
        if (!intercepted && query.includes("update \"item_variants\"") && query.includes("returning")) {
          intercepted = true;
          // Simulate another transaction depleting var-bag-red just before this UPDATE executes
          sqlite.prepare(`UPDATE item_variants SET stock_quantity = 1 WHERE id = 'var-bag-red'`).run();
        }
        return prepared;
      },
    } as unknown as D1Database;

    let caughtErr: any = null;
    try {
      await createOrderForTenant(
        createDb(raceD1),
        env as any,
        { id: "tenant-alice", name: "Alice Shop", currency: "KES" },
        null,
        {
          customerName: "Rollback Buyer",
          customerEmail: "rb@example.com",
          customerPhone: "0712345678",
          paymentMethod: "CASH_ON_DELIVERY",
          deliveryAddress: "CBD, Nairobi",
          shippingAddress: {},
          items: [
            { itemId: "item-shoe", quantity: 2 },
            { itemId: "item-bag", variantId: "var-bag-red", quantity: 2 },
          ],
        }
      );
    } catch (err) {
      caughtErr = err;
    }
    expect(caughtErr).not.toBeNull();
    expect(caughtErr.statusCode).toBe(409);
    expect(caughtErr.code).toBe("INSUFFICIENT_STOCK");
    // item-shoe MUST be rolled back to 5, and var-bag-red remains 1, with no orphan order created
    expect((sqlite.prepare(`SELECT stock_quantity FROM items WHERE id = 'item-shoe'`).get() as any).stock_quantity).toBe(5);
    expect((sqlite.prepare(`SELECT stock_quantity FROM item_variants WHERE id = 'var-bag-red'`).get() as any).stock_quantity).toBe(1);
    const rbOrders = sqlite.prepare(`SELECT id FROM orders WHERE customer_email = 'rb@example.com'`).all();
    expect(rbOrders).toHaveLength(0);

    // 4. Status-cycling stock inflation: COD order -> CANCELLED restores once; CANCELLED -> PROCESSING forbidden; unpaid PAID order doesn't restore
    const codRes = await app.request(
      "https://alice.store254.co.ke/api/orders/checkout",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tenantHeaders("alice") },
        body: JSON.stringify({
          customerName: "Cycle Buyer",
          customerEmail: "cycle@example.com",
          customerPhone: "0712345678",
          paymentMethod: "CASH_ON_DELIVERY",
          deliveryAddress: "CBD, Nairobi",
          items: [{ itemId: "item-shoe", quantity: 2 }],
        }),
      },
      env as any
    );
    expect(codRes.status).toBe(201);
    const codOrderId = ((await codRes.json()) as any).data.orderId;
    expect((sqlite.prepare(`SELECT stock_quantity FROM items WHERE id = 'item-shoe'`).get() as any).stock_quantity).toBe(3);

    const ownerToken = await createAccessToken(
      { id: "owner-alice", tenantId: "tenant-alice", email: "owner@alice.com", role: "OWNER" },
      jwtSecret
    );

    const cancelRes = await app.request(
      `https://alice.store254.co.ke/api/orders/${codOrderId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...tenantHeaders("alice", { Authorization: `Bearer ${ownerToken}` }),
        },
        body: JSON.stringify({ status: "CANCELLED" }),
      },
      env as any
    );
    expect(cancelRes.status).toBe(200);
    expect((sqlite.prepare(`SELECT stock_quantity FROM items WHERE id = 'item-shoe'`).get() as any).stock_quantity).toBe(5);

    // Attempting to reopen or re-cancel MUST fail with 400 ORDER_ALREADY_CANCELLED and never touch stock
    const reopenRes = await app.request(
      `https://alice.store254.co.ke/api/orders/${codOrderId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...tenantHeaders("alice", { Authorization: `Bearer ${ownerToken}` }),
        },
        body: JSON.stringify({ status: "PROCESSING" }),
      },
      env as any
    );
    expect(reopenRes.status).toBe(400);
    expect(((await reopenRes.json()) as any).error.code).toBe("ORDER_ALREADY_CANCELLED");
    expect((sqlite.prepare(`SELECT stock_quantity FROM items WHERE id = 'item-shoe'`).get() as any).stock_quantity).toBe(5);

    // Order with paymentStatus = 'PAID' but inventoryDeducted = 0 must NOT restore stock on cancel
    sqlite
      .prepare(
        `INSERT INTO orders (id, tenant_id, order_number, customer_name, customer_email, customer_phone, subtotal, total_amount, status, payment_status, payment_method, inventory_deducted)
         VALUES ('ord-nodeduct', 'tenant-alice', 'ORD-NODEDUCT', 'Test', 't@example.com', '254712345678', 2500, 2500, 'PROCESSING', 'PAID', 'MPESA', 0)`
      )
      .run();
    sqlite
      .prepare(
        `INSERT INTO order_items (id, tenant_id, order_id, item_id, title, unit_price, quantity, total_price)
         VALUES ('oi-nodeduct', 'tenant-alice', 'ord-nodeduct', 'item-shoe', 'Sneaker', 2500, 2, 5000)`
      )
      .run();
    const cancelNoDeduct = await app.request(
      `https://alice.store254.co.ke/api/orders/ord-nodeduct/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...tenantHeaders("alice", { Authorization: `Bearer ${ownerToken}` }),
        },
        body: JSON.stringify({ status: "CANCELLED" }),
      },
      env as any
    );
    expect(cancelNoDeduct.status).toBe(200);
    expect((sqlite.prepare(`SELECT stock_quantity FROM items WHERE id = 'item-shoe'`).get() as any).stock_quantity).toBe(5);

    // 5. DELETE /api/orders/:id enforces tenantId on itemVariants
    sqlite
      .prepare(
        `INSERT INTO orders (id, tenant_id, order_number, customer_name, customer_email, customer_phone, subtotal, total_amount, status, payment_status, payment_method, inventory_deducted)
         VALUES ('ord-del-cross', 'tenant-alice', 'ORD-DEL1', 'Test', 't@example.com', '254712345678', 1000, 1000, 'PROCESSING', 'PENDING', 'CASH_ON_DELIVERY', 1)`
      )
      .run();
    sqlite
      .prepare(
        `INSERT INTO order_items (id, tenant_id, order_id, item_id, variant_id, title, unit_price, quantity, total_price)
         VALUES ('oi-del-cross', 'tenant-alice', 'ord-del-cross', 'item-bob', 'var-bob-1', 'Bob Shirt', 1000, 4, 4000)`
      )
      .run();
    const delRes = await app.request(
      `https://alice.store254.co.ke/api/orders/ord-del-cross`,
      {
        method: "DELETE",
        headers: tenantHeaders("alice", { Authorization: `Bearer ${ownerToken}` }),
      },
      env as any
    );
    expect(delRes.status).toBe(200);
    // Bob's variant stock MUST remain 10 (not inflated to 14 by Alice's DELETE)
    expect((sqlite.prepare(`SELECT stock_quantity FROM item_variants WHERE id = 'var-bob-1'`).get() as any).stock_quantity).toBe(10);
  });

  it("SEC-07, SEC-15, SEC-26: enforces checkout rate limit, cart/quantity bounds, NaN-safe pagination, and http/https trackingUrl", async () => {
    const ownerToken = await createAccessToken(
      { id: "owner-alice", tenantId: "tenant-alice", email: "owner@alice.com", role: "OWNER" },
      jwtSecret
    );

    // Quantity > 100 rejected
    const maxQtyRes = await app.request(
      "https://alice.store254.co.ke/api/orders/checkout",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tenantHeaders("alice") },
        body: JSON.stringify({
          customerName: "Buyer",
          customerEmail: "b@example.com",
          customerPhone: "0712345678",
          paymentMethod: "CASH_ON_DELIVERY",
          deliveryAddress: "CBD, Nairobi",
          items: [{ itemId: "item-shoe", quantity: 101 }],
        }),
      },
      env as any
    );
    expect(maxQtyRes.status).toBe(400);

    // Cart items > 50 rejected
    const manyItems = Array.from({ length: 51 }, (_, idx) => ({
      itemId: `item-${idx}`,
      quantity: 1,
    }));
    const maxCartRes = await app.request(
      "https://alice.store254.co.ke/api/orders/checkout",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tenantHeaders("alice") },
        body: JSON.stringify({
          customerName: "Buyer",
          customerEmail: "b@example.com",
          customerPhone: "0712345678",
          paymentMethod: "CASH_ON_DELIVERY",
          deliveryAddress: "CBD, Nairobi",
          items: manyItems,
        }),
      },
      env as any
    );
    expect(maxCartRes.status).toBe(400);

    // Rate limiting: 11th request from same IP within 60s returns 429
    const fixedIp = "203.0.113.77";
    for (let i = 0; i < 10; i++) {
      const res = await app.request(
        "https://alice.store254.co.ke/api/orders/checkout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...tenantHeaders("alice", {}, fixedIp) },
          body: JSON.stringify({ items: [] }),
        },
        env as any
      );
      expect(res.status).toBe(400);
    }
    const rateLimitedRes = await app.request(
      "https://alice.store254.co.ke/api/orders/checkout",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tenantHeaders("alice", {}, fixedIp) },
        body: JSON.stringify({ items: [] }),
      },
      env as any
    );
    expect(rateLimitedRes.status).toBe(429);

    // SEC-15: NaN pagination params clamp safely
    const listNanRes = await app.request(
      "https://alice.store254.co.ke/api/orders?page=abc&limit=xyz",
      { headers: tenantHeaders("alice", { Authorization: `Bearer ${ownerToken}` }) },
      env as any
    );
    expect(listNanRes.status).toBe(200);
    const listNanJson = (await listNanRes.json()) as any;
    expect(listNanJson.page).toBe(1);
    expect(listNanJson.limit).toBe(200);

    const listBoundsRes = await app.request(
      "https://alice.store254.co.ke/api/orders?page=-3&limit=9999",
      { headers: tenantHeaders("alice", { Authorization: `Bearer ${ownerToken}` }) },
      env as any
    );
    expect(listBoundsRes.status).toBe(200);
    const listBoundsJson = (await listBoundsRes.json()) as any;
    expect(listBoundsJson.page).toBe(1);
    expect(listBoundsJson.limit).toBe(500);

    // SEC-26: trackingUrl rejects javascript:/data: and allows https:
    sqlite
      .prepare(
        `INSERT INTO orders (id, tenant_id, order_number, customer_name, customer_email, customer_phone, subtotal, total_amount, status, payment_status, payment_method)
         VALUES ('ord-trk', 'tenant-alice', 'ORD-TRK1', 'Test', 't@example.com', '254712345678', 2500, 2500, 'PROCESSING', 'PENDING', 'CASH_ON_DELIVERY')`
      )
      .run();

    for (const badUrl of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"]) {
      const badRes = await app.request(
        "https://alice.store254.co.ke/api/orders/ord-trk/status",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...tenantHeaders("alice", { Authorization: `Bearer ${ownerToken}` }),
          },
          body: JSON.stringify({
            status: "SHIPPED",
            fulfillmentDetails: { trackingUrl: badUrl },
          }),
        },
        env as any
      );
      expect(badRes.status).toBe(400);
    }

    const okRes = await app.request(
      "https://alice.store254.co.ke/api/orders/ord-trk/status",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...tenantHeaders("alice", { Authorization: `Bearer ${ownerToken}` }),
        },
        body: JSON.stringify({
          status: "SHIPPED",
          fulfillmentDetails: { trackingUrl: "https://courier.example.com/track/123" },
        }),
      },
      env as any
    );
    expect(okRes.status).toBe(200);
  });

  it("SEC-25 & SEC-06: hardens M-Pesa callback against non-array metadata, underpayment, duplicate receipt replay, and double stock deduction", async () => {
    const tok1 = "cb-token-1";
    const tok2 = "cb-token-2";
    const tok3 = "cb-token-3";
    const h1 = await hashOtp(tok1);
    const h2 = await hashOtp(tok2);
    const h3 = await hashOtp(tok3);

    sqlite
      .prepare(
        `INSERT INTO orders (id, tenant_id, order_number, customer_name, customer_email, customer_phone, subtotal, total_amount, status, payment_status, payment_method, inventory_deducted)
         VALUES
         ('ord-mp1', 'tenant-alice', 'ORD-MP1', 'Buyer 1', 'b1@example.com', '254712345678', 5000, 5000, 'PENDING_PAYMENT', 'PENDING', 'MPESA', 0),
         ('ord-mp2', 'tenant-alice', 'ORD-MP2', 'Buyer 2', 'b2@example.com', '254712345679', 5000, 5000, 'PENDING_PAYMENT', 'PENDING', 'MPESA', 0),
         ('ord-mp3', 'tenant-alice', 'ORD-MP3', 'Buyer 3', 'b3@example.com', '254712345680', 5000, 5000, 'PENDING_PAYMENT', 'PENDING', 'MPESA', 0)`
      )
      .run();

    sqlite
      .prepare(
        `INSERT INTO order_items (id, tenant_id, order_id, item_id, title, unit_price, quantity, total_price)
         VALUES
         ('oi-mp1', 'tenant-alice', 'ord-mp1', 'item-shoe', 'Sneaker', 2500, 2, 5000),
         ('oi-mp2', 'tenant-alice', 'ord-mp2', 'item-shoe', 'Sneaker', 2500, 2, 5000),
         ('oi-mp3', 'tenant-alice', 'ord-mp3', 'item-shoe', 'Sneaker', 2500, 2, 5000)`
      )
      .run();

    sqlite
      .prepare(
        `INSERT INTO payments (id, tenant_id, order_id, amount, status, merchant_request_id, checkout_request_id, callback_token_hash)
         VALUES
         ('pay-1', 'tenant-alice', 'ord-mp1', 5000, 'INITIATED', 'mr-1', 'cr-1', ?),
         ('pay-2', 'tenant-alice', 'ord-mp2', 5000, 'INITIATED', 'mr-2', 'cr-2', ?),
         ('pay-3', 'tenant-alice', 'ord-mp3', 5000, 'INITIATED', 'mr-3', 'cr-3', ?)`
      )
      .run(h1, h2, h3);

    // 1. Malformed non-array CallbackMetadata.Item with ResultCode 0 must NOT crash 500
    const badMetaRes = await app.request(
      `https://store254.co.ke/api/payments/mpesa/callback?token=${tok1}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Body: {
            stkCallback: {
              MerchantRequestID: "mr-1",
              CheckoutRequestID: "cr-1",
              ResultCode: 0,
              ResultDesc: "Success",
              CallbackMetadata: { Item: { Amount: 5000 } },
            },
          },
        }),
      },
      env as any
    );
    expect(badMetaRes.status).toBe(200);
    expect((sqlite.prepare(`SELECT status FROM payments WHERE id = 'pay-1'`).get() as any).status).toBe("FAILED");
    expect((sqlite.prepare(`SELECT payment_status FROM orders WHERE id = 'ord-mp1'`).get() as any).payment_status).toBe("FAILED");

    // 2. Underpayment (Amount < expected) rejected
    const underpayRes = await app.request(
      `https://store254.co.ke/api/payments/mpesa/callback?token=${tok2}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Body: {
            stkCallback: {
              MerchantRequestID: "mr-2",
              CheckoutRequestID: "cr-2",
              ResultCode: 0,
              ResultDesc: "Success",
              CallbackMetadata: {
                Item: [
                  { Name: "Amount", Value: 4999 },
                  { Name: "MpesaReceiptNumber", Value: "RCP_UNDER" },
                ],
              },
            },
          },
        }),
      },
      env as any
    );
    expect(underpayRes.status).toBe(200);
    expect((sqlite.prepare(`SELECT status FROM payments WHERE id = 'pay-2'`).get() as any).status).toBe("FAILED");
    expect((sqlite.prepare(`SELECT payment_status FROM orders WHERE id = 'ord-mp2'`).get() as any).payment_status).toBe("FAILED");

    // 3. Valid callback for pay-3 marks order PAID and atomically deducts stock once (5 -> 3)
    const validCbPayload = {
      Body: {
        stkCallback: {
          MerchantRequestID: "mr-3",
          CheckoutRequestID: "cr-3",
          ResultCode: 0,
          ResultDesc: "Success",
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: 5000 },
              { Name: "MpesaReceiptNumber", Value: "RCP_VALID_001" },
              { Name: "PhoneNumber", Value: "254712345680" },
            ],
          },
        },
      },
    };
    const [cbA, cbB] = await Promise.all([
      app.request(
        `https://store254.co.ke/api/payments/mpesa/callback?token=${tok3}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validCbPayload) },
        env as any
      ),
      app.request(
        `https://store254.co.ke/api/payments/mpesa/callback?token=${tok3}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validCbPayload) },
        env as any
      ),
    ]);
    expect(cbA.status).toBe(200);
    expect(cbB.status).toBe(200);
    expect((sqlite.prepare(`SELECT status, payment_status, inventory_deducted FROM orders WHERE id = 'ord-mp3'`).get() as any)).toEqual({
      status: "PAID",
      payment_status: "PAID",
      inventory_deducted: 1,
    });
    expect((sqlite.prepare(`SELECT stock_quantity FROM items WHERE id = 'item-shoe'`).get() as any).stock_quantity).toBe(3);

    // 4. Replaying RCP_VALID_001 on a new order/payment is rejected and does not mark order PAID or deduct stock
    const tok4 = "cb-token-4";
    const h4 = await hashOtp(tok4);
    sqlite
      .prepare(
        `INSERT INTO orders (id, tenant_id, order_number, customer_name, customer_email, customer_phone, subtotal, total_amount, status, payment_status, payment_method, inventory_deducted)
         VALUES ('ord-mp4', 'tenant-alice', 'ORD-MP4', 'Buyer 4', 'b4@example.com', '254712345681', 5000, 5000, 'PENDING_PAYMENT', 'PENDING', 'MPESA', 0)`
      )
      .run();
    sqlite
      .prepare(
        `INSERT INTO order_items (id, tenant_id, order_id, item_id, title, unit_price, quantity, total_price)
         VALUES ('oi-mp4', 'tenant-alice', 'ord-mp4', 'item-shoe', 'Sneaker', 2500, 2, 5000)`
      )
      .run();
    sqlite
      .prepare(
        `INSERT INTO payments (id, tenant_id, order_id, amount, status, merchant_request_id, checkout_request_id, callback_token_hash)
         VALUES ('pay-4', 'tenant-alice', 'ord-mp4', 5000, 'INITIATED', 'mr-4', 'cr-4', ?)`
      )
      .run(h4);

    const replayRes = await app.request(
      `https://store254.co.ke/api/payments/mpesa/callback?token=${tok4}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Body: {
            stkCallback: {
              MerchantRequestID: "mr-4",
              CheckoutRequestID: "cr-4",
              ResultCode: 0,
              ResultDesc: "Success",
              CallbackMetadata: {
                Item: [
                  { Name: "Amount", Value: 5000 },
                  { Name: "MpesaReceiptNumber", Value: "RCP_VALID_001" },
                ],
              },
            },
          },
        }),
      },
      env as any
    );
    expect(replayRes.status).toBe(200);
    expect((sqlite.prepare(`SELECT status, result_desc FROM payments WHERE id = 'pay-4'`).get() as any)).toEqual({
      status: "FAILED",
      result_desc: "Duplicate M-Pesa receipt number",
    });
    expect((sqlite.prepare(`SELECT status, payment_status FROM orders WHERE id = 'ord-mp4'`).get() as any)).toEqual({
      status: "PENDING_PAYMENT",
      payment_status: "PENDING",
    });
    expect((sqlite.prepare(`SELECT stock_quantity FROM items WHERE id = 'item-shoe'`).get() as any).stock_quantity).toBe(3);
  });
});
