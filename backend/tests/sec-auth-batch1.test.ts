import { describe, it, expect, beforeEach, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import app from "../src/index";
import { createDb } from "../src/db";
import { users } from "../src/db/schema/users";
import { passwordResetOtps } from "../src/db/schema/auth-tokens";
import { hashPassword, hashOtp, verifyPassword } from "../src/security/crypto";
import { createAccessToken, createCustomerSsoToken } from "../src/security/jwt";
import { CUSTOMER_SESSION_COOKIE } from "../src/security/session-cookie";
import { resolveGoogleCustomerForTenant } from "../src/services/google-customer-auth.service";
import { findMerchantStoresByEmail } from "../src/services/user-stores.service";
import { sanitizePublicTenantSettings } from "../src/modules/platform/platform.routes";
import { EmailService } from "../src/services/email.service";
import { eq, and } from "drizzle-orm";

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
        // Drizzle calls raw() for SELECT and expects array-of-arrays (with optional columnNames row first)
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
    CREATE TABLE password_reset_otps (
      id text PRIMARY KEY NOT NULL,
      email text NOT NULL,
      tenant_id text,
      otp_hash text NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      max_attempts integer NOT NULL DEFAULT 3,
      expires_at integer NOT NULL,
      is_used integer NOT NULL DEFAULT 0,
      created_at integer NOT NULL DEFAULT (unixepoch())
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
  `);
}

describe("Security Fix Batch 1 (Auth, Verification, Reset, Demo Hash Removal & Settings)", () => {
  const jwtSecret = "test-jwt-secret-key-12345678901234567890";
  let sqlite: DatabaseSync;
  let d1: D1Database;
  let env: Record<string, unknown>;
  let ipSeq = 1;

  const nextIp = () => `198.51.100.${(ipSeq++ % 250) + 1}`;
  const tenantReq = (slug: string, extra: Record<string, string> = {}, ip = nextIp()) => ({
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
    };

    sqlite
      .prepare(
        `INSERT INTO tenants (id, name, subdomain, status, settings) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        "tenant-alice",
        "Alice Shop",
        "alice",
        "ACTIVE",
        JSON.stringify({
          logoUrl: "/api/media/tenant-alice/logo.webp",
          bannerUrl: "/api/media/tenant-alice/banner.webp",
          tagline: "Quality goods",
          primaryColor: "#059669",
          staffPermissions: { "staff-1": ["manage_products", "manage_orders"] },
          internalSecretFlag: "should-not-leak",
        })
      );

    sqlite
      .prepare(
        `INSERT INTO tenants (id, name, subdomain, status, settings) VALUES (?, ?, ?, ?, ?)`
      )
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
  });

  it("SEC-01 migration 0014 alters pre-0014 users table and backfills verified owners/google/internal staff only", () => {
    const legacyDb = new DatabaseSync(":memory:");
    legacyDb.exec(`
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
        last_login_at integer,
        created_at integer NOT NULL DEFAULT 1700000000,
        updated_at integer NOT NULL DEFAULT 1700000000
      );
      INSERT INTO users (id, tenant_id, email, password_hash, role, google_id) VALUES
        ('u-owner', 't1', 'owner@gmail.com', 'h1', 'OWNER', NULL),
        ('u-google-cust', 't1', 'g@gmail.com', 'oauth$google$1', 'CUSTOMER', 'sub-1'),
        ('u-internal-staff', 't1', 'clerk@alice.store254.co.ke', 'h2', 'STAFF', NULL),
        ('u-unverified-cust', 't1', 'attacker@victim.com', 'h3', 'CUSTOMER', NULL),
        ('u-ext-staff', 't1', 'victim@gmail.com', 'h4', 'STAFF', NULL);
    `);

    const sqlPath = path.resolve(
      __dirname,
      "../drizzle/0014_user_verification_and_token_version.sql"
    );
    const migrationSql = fs
      .readFileSync(sqlPath, "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of migrationSql) {
      legacyDb.exec(stmt);
    }

    const rows = legacyDb
      .prepare("SELECT id, email_verified_at, token_version FROM users")
      .all() as Array<{ id: string; email_verified_at: number | null; token_version: number }>;
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

    expect(byId["u-owner"].email_verified_at).not.toBeNull();
    expect(byId["u-google-cust"].email_verified_at).not.toBeNull();
    expect(byId["u-internal-staff"].email_verified_at).not.toBeNull();
    expect(byId["u-unverified-cust"].email_verified_at).toBeNull();
    expect(byId["u-ext-staff"].email_verified_at).toBeNull();
    expect(byId["u-unverified-cust"].token_version).toBe(0);
  });

  it("SEC-01: register requires email OTP verification, blocks unverified login, and verifies with lockout", async () => {
    const sentEmails: Array<{ html: string; subject: string; to: string }> = [];
    const sendSpy = vi.spyOn(EmailService, "send").mockImplementation(async (opts) => {
      sentEmails.push({ html: opts.html, subject: opts.subject, to: opts.to });
      return true;
    });

    try {
      const testIp = nextIp();
      const regRes = await app.request(
        "https://alice.store254.co.ke/api/auth/register",
        {
          method: "POST",
          headers: tenantReq("alice", { "Content-Type": "application/json" }, testIp),
          body: JSON.stringify({
            email: "newcustomer@example.com",
            password: "StrongPassword123!",
            fullName: "New Customer",
          }),
        },
        env as any
      );
      expect(regRes.status).toBe(201);
      const regBody = (await regRes.json()) as any;
      expect(regBody.data.verificationRequired).toBe(true);
      expect(regBody.data.accessToken).toBeUndefined();
      expect(regRes.headers.get("set-cookie")).toBeNull();
      expect(regBody.data.user.status).toBe("PENDING_VERIFICATION");

      // Cannot log in before verification
      const unverifiedLogin = await app.request(
        "https://alice.store254.co.ke/api/auth/login",
        {
          method: "POST",
          headers: tenantReq("alice", { "Content-Type": "application/json" }, testIp),
          body: JSON.stringify({
            email: "newcustomer@example.com",
            password: "StrongPassword123!",
          }),
        },
        env as any
      );
      expect(unverifiedLogin.status).toBe(401);
      const unverifiedLoginBody = (await unverifiedLogin.json()) as any;
      expect(unverifiedLoginBody.error.code).toBe("INVALID_CREDENTIALS");

      // Extract OTP sent in verification email
      expect(sentEmails.length).toBe(1);
      const otpMatch = sentEmails[0].html.match(/\b(\d{6})\b/);
      expect(otpMatch).not.toBeNull();
      const firstOtp = otpMatch![1];

      // 3 wrong attempts lock out the verification OTP
      for (let i = 0; i < 3; i++) {
        const badVerify = await app.request(
          "https://alice.store254.co.ke/api/auth/verify-email",
          {
            method: "POST",
            headers: tenantReq("alice", { "Content-Type": "application/json" }, testIp),
            body: JSON.stringify({
              email: "newcustomer@example.com",
              otp: "000000",
            }),
          },
          env as any
        );
        expect(badVerify.status).toBe(400);
      }

      // Even the real firstOtp must now be rejected after 3 failed attempts
      const lockedVerify = await app.request(
        "https://alice.store254.co.ke/api/auth/verify-email",
        {
          method: "POST",
          headers: tenantReq("alice", { "Content-Type": "application/json" }, testIp),
          body: JSON.stringify({
            email: "newcustomer@example.com",
            otp: firstOtp,
          }),
        },
        env as any
      );
      expect(lockedVerify.status).toBe(400);

      // Resend verification OTP and verify cleanly
      const resendRes = await app.request(
        "https://alice.store254.co.ke/api/auth/resend-verification",
        {
          method: "POST",
          headers: tenantReq("alice", { "Content-Type": "application/json" }, testIp),
          body: JSON.stringify({ email: "newcustomer@example.com" }),
        },
        env as any
      );
      expect(resendRes.status).toBe(200);
      expect(sentEmails.length).toBe(2);
      const secondOtp = sentEmails[1].html.match(/\b(\d{6})\b/)![1];

      const verifyRes = await app.request(
        "https://alice.store254.co.ke/api/auth/verify-email",
        {
          method: "POST",
          headers: tenantReq("alice", { "Content-Type": "application/json" }, testIp),
          body: JSON.stringify({
            email: "newcustomer@example.com",
            otp: secondOtp,
          }),
        },
        env as any
      );
      expect(verifyRes.status).toBe(200);
      const verifyBody = (await verifyRes.json()) as any;
      expect(verifyBody.data.accessToken).toBeDefined();
      expect(verifyBody.data.user.status).toBe("ACTIVE");

      // Now password login succeeds
      const loginRes = await app.request(
        "https://alice.store254.co.ke/api/auth/login",
        {
          method: "POST",
          headers: tenantReq("alice", { "Content-Type": "application/json" }, testIp),
          body: JSON.stringify({
            email: "newcustomer@example.com",
            password: "StrongPassword123!",
          }),
        },
        env as any
      );
      expect(loginRes.status).toBe(200);
    } finally {
      sendSpy.mockRestore();
    }
  });

  it("SEC-01: findMerchantStoresByEmail & GET /api/auth/me exclude unverified emails and unverified merchant rows", async () => {
    const db = createDb(d1);
    const pwHash = await hashPassword("MerchantPass123!");

    // Bob's store has a verified OWNER with victim@example.com
    await db.insert(users).values({
      id: "bob-owner",
      tenantId: "tenant-bob",
      email: "victim@example.com",
      passwordHash: pwHash,
      role: "OWNER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    });

    // Alice's store has an UNVERIFIED external staff row created by an attacker-owner with victim@example.com
    await db.insert(users).values({
      id: "alice-unverified-staff",
      tenantId: "tenant-alice",
      email: "victim@example.com",
      passwordHash: pwHash,
      role: "STAFF",
      status: "ACTIVE",
      emailVerifiedAt: null,
    });

    // Direct call with emailVerified=false must return empty
    const denied = await findMerchantStoresByEmail(db, "victim@example.com", {
      emailVerified: false,
    });
    expect(denied.stores).toEqual([]);
    expect(denied.activeStore).toBeNull();

    // Even when emailVerified=true, only verified merchant rows (Bob's store) match, NOT Alice's unverified staff row
    const verifiedResult = await findMerchantStoresByEmail(db, "victim@example.com", {
      emailVerified: true,
    });
    expect(verifiedResult.stores.map((s) => s.id)).toEqual(["tenant-bob"]);

    // Calling GET /api/auth/me as Alice's unverified staff must NOT enumerate Bob's store
    const unverifiedStaffToken = await createAccessToken(
      {
        id: "alice-unverified-staff",
        tenantId: "tenant-alice",
        email: "victim@example.com",
        role: "STAFF",
      },
      jwtSecret
    );
    const meRes = await app.request(
      "https://alice.store254.co.ke/api/auth/me",
      { headers: tenantReq("alice", { Authorization: `Bearer ${unverifiedStaffToken}` }) },
      env as any
    );
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as any;
    expect(meBody.data.stores).toEqual([]);
    expect(meBody.data.activeStore).toBeNull();
    expect(meBody.data.emailVerified).toBe(false);
  });

  it("SEC-01: Google sign-in clears pre-registered password, activates account, and increments tokenVersion", async () => {
    const db = createDb(d1);
    const attackerHash = await hashPassword("AttackerPreRegistered123!");
    await db.insert(users).values({
      id: "pre-hijack-cust",
      tenantId: "tenant-alice",
      email: "victim@gmail.com",
      passwordHash: attackerHash,
      role: "CUSTOMER",
      status: "PENDING_VERIFICATION",
      emailVerifiedAt: null,
      tokenVersion: 0,
    });

    const resolved = await resolveGoogleCustomerForTenant(
      db,
      { id: "tenant-alice", status: "ACTIVE" },
      {
        sub: "google-sub-victim",
        email: "victim@gmail.com",
        emailVerified: true,
        name: "Real Victim",
      }
    );

    expect(resolved.id).toBe("pre-hijack-cust");

    const [updated] = await db
      .select()
      .from(users)
      .where(eq(users.id, "pre-hijack-cust"))
      .limit(1);

    expect(updated.googleId).toBe("google-sub-victim");
    expect(updated.status).toBe("ACTIVE");
    expect(updated.emailVerifiedAt).not.toBeNull();
    expect(updated.tokenVersion).toBe(1);
    expect(updated.passwordHash.startsWith("oauth$google$")).toBe(true);

    // Attacker's pre-registered password can no longer log in
    const attackerLogin = await app.request(
      "https://alice.store254.co.ke/api/auth/login",
      {
        method: "POST",
        headers: tenantReq("alice", { "Content-Type": "application/json" }),
        body: JSON.stringify({
          email: "victim@gmail.com",
          password: "AttackerPreRegistered123!",
        }),
      },
      env as any
    );
    expect(attackerLogin.status).toBe(401);
  });

  it("SEC-03: forgot-password ignores clientOrigin and Origin header on both auth and platform", async () => {
    const db = createDb(d1);
    const pwHash = await hashPassword("OwnerPass123!");
    await db.insert(users).values({
      id: "owner-1",
      tenantId: "tenant-alice",
      email: "owner@example.com",
      passwordHash: pwHash,
      role: "OWNER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    });

    const links: string[] = [];
    const spy = vi.spyOn(EmailService, "sendPasswordResetLink").mockImplementation(async (p) => {
      links.push(p.resetLink);
      return true;
    });

    try {
      const authForgot = await app.request(
        "https://alice.store254.co.ke/api/auth/forgot-password",
        {
          method: "POST",
          headers: tenantReq("alice", {
            "Content-Type": "application/json",
            Origin: "https://evil-header.attacker.com",
          }),
          body: JSON.stringify({
            email: "owner@example.com",
            clientOrigin: "https://evil-body.attacker.com",
          }),
        },
        env as any
      );
      expect(authForgot.status).toBe(200);

      const platformForgot = await app.request(
        "https://store254.co.ke/api/platform/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://evil-header.attacker.com",
            "CF-Connecting-IP": nextIp(),
          },
          body: JSON.stringify({
            email: "owner@example.com",
            clientOrigin: "https://evil-body.attacker.com",
          }),
        },
        env as any
      );
      expect(platformForgot.status).toBe(200);

      expect(links.length).toBe(2);
      expect(links[0].startsWith("https://alice.store254.co.ke/admin.html?reset_token=")).toBe(true);
      expect(links[1].startsWith("https://store254.co.ke/admin.html?reset_token=")).toBe(true);
      expect(links.join(" ")).not.toContain("attacker.com");
    } finally {
      spy.mockRestore();
    }
  });

  it("SEC-04 & SEC-05: platform reset-password scopes to null tenantId & OWNER role, locks out after 3 bad OTPs, and increments tokenVersion", async () => {
    const db = createDb(d1);
    const ownerHash = await hashPassword("OwnerOldPass123!");
    const custHash = await hashPassword("CustomerPass123!");

    await db.insert(users).values([
      {
        id: "owner-row",
        tenantId: "tenant-alice",
        email: "shared@example.com",
        passwordHash: ownerHash,
        role: "OWNER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        tokenVersion: 0,
      },
      {
        id: "customer-row",
        tenantId: "tenant-bob",
        email: "shared@example.com",
        passwordHash: custHash,
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        tokenVersion: 0,
      },
    ]);

    // A tenant-scoped OTP must NOT work on /api/platform/reset-password
    await db.insert(passwordResetOtps).values({
      id: "tenant-otp-1",
      tenantId: "tenant-alice",
      email: "shared@example.com",
      otpHash: await hashOtp("111111"),
      attempts: 0,
      maxAttempts: 3,
      expiresAt: new Date(Date.now() + 600_000),
      isUsed: false,
    });

    const tenantOtpOnPlatform = await app.request(
      "https://store254.co.ke/api/platform/reset-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": nextIp() },
        body: JSON.stringify({
          email: "shared@example.com",
          otp: "111111",
          newPassword: "NewOwnerPass123!",
        }),
      },
      env as any
    );
    expect(tenantOtpOnPlatform.status).toBe(400);

    // Insert platform-scoped OTP (tenantId = null)
    await db.insert(passwordResetOtps).values({
      id: "platform-otp-1",
      tenantId: null,
      email: "shared@example.com",
      otpHash: await hashOtp("222222"),
      attempts: 0,
      maxAttempts: 3,
      expiresAt: new Date(Date.now() + 600_000),
      isUsed: false,
    });

    // 3 wrong attempts lock out platform-otp-1
    const platResetIp1 = nextIp();
    for (let i = 0; i < 3; i++) {
      const badRes = await app.request(
        "https://store254.co.ke/api/platform/reset-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "CF-Connecting-IP": platResetIp1 },
          body: JSON.stringify({
            email: "shared@example.com",
            otp: "999999",
            newPassword: "NewOwnerPass123!",
          }),
        },
        env as any
      );
      expect(badRes.status).toBe(400);
    }

    const [lockedOtp] = await db
      .select()
      .from(passwordResetOtps)
      .where(eq(passwordResetOtps.id, "platform-otp-1"));
    expect(lockedOtp.attempts).toBe(3);
    expect(lockedOtp.isUsed).toBe(true);

    // Even the real code must now fail
    const lockedAttempt = await app.request(
      "https://store254.co.ke/api/platform/reset-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": platResetIp1 },
        body: JSON.stringify({
          email: "shared@example.com",
          otp: "222222",
          newPassword: "NewOwnerPass123!",
        }),
      },
      env as any
    );
    expect(lockedAttempt.status).toBe(400);

    // Fresh platform OTP succeeds and updates ONLY OWNER, not CUSTOMER
    await db.insert(passwordResetOtps).values({
      id: "platform-otp-2",
      tenantId: null,
      email: "shared@example.com",
      otpHash: await hashOtp("333333"),
      attempts: 0,
      maxAttempts: 3,
      expiresAt: new Date(Date.now() + 600_000),
      isUsed: false,
    });

    const resetOk = await app.request(
      "https://store254.co.ke/api/platform/reset-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": nextIp() },
        body: JSON.stringify({
          email: "shared@example.com",
          otp: "333333",
          newPassword: "NewOwnerPass123!",
        }),
      },
      env as any
    );
    expect(resetOk.status).toBe(200);

    const [ownerAfter] = await db.select().from(users).where(eq(users.id, "owner-row"));
    const [custAfter] = await db.select().from(users).where(eq(users.id, "customer-row"));
    expect(await verifyPassword("NewOwnerPass123!", ownerAfter.passwordHash)).toBe(true);
    expect(ownerAfter.tokenVersion).toBe(1);
    expect(await verifyPassword("CustomerPass123!", custAfter.passwordHash)).toBe(true);
    expect(custAfter.tokenVersion).toBe(0);
  });

  it("SEC-05 & SEC-01: tenant auth reset-password locks out after 3 bad OTPs and increments tokenVersion", async () => {
    const db = createDb(d1);
    await db.insert(users).values({
      id: "tenant-cust-1",
      tenantId: "tenant-alice",
      email: "cust@example.com",
      passwordHash: await hashPassword("OldPass123!"),
      role: "CUSTOMER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      tokenVersion: 0,
    });
    await db.insert(passwordResetOtps).values({
      id: "tenant-otp-lock",
      tenantId: "tenant-alice",
      email: "cust@example.com",
      otpHash: await hashOtp("444444"),
      attempts: 0,
      maxAttempts: 3,
      expiresAt: new Date(Date.now() + 600_000),
      isUsed: false,
    });

    const tenantResetIp = nextIp();
    for (let i = 0; i < 3; i++) {
      const res = await app.request(
        "https://alice.store254.co.ke/api/auth/reset-password",
        {
          method: "POST",
          headers: tenantReq("alice", { "Content-Type": "application/json" }, tenantResetIp),
          body: JSON.stringify({
            email: "cust@example.com",
            otp: "000001",
            newPassword: "NewPass123!",
          }),
        },
        env as any
      );
      expect(res.status).toBe(400);
    }

    const [otpAfter] = await db
      .select()
      .from(passwordResetOtps)
      .where(eq(passwordResetOtps.id, "tenant-otp-lock"));
    expect(otpAfter.attempts).toBe(3);
    expect(otpAfter.isUsed).toBe(true);

    // Insert fresh OTP and verify tokenVersion increments on reset
    await db.insert(passwordResetOtps).values({
      id: "tenant-otp-ok",
      tenantId: "tenant-alice",
      email: "cust@example.com",
      otpHash: await hashOtp("555555"),
      attempts: 0,
      maxAttempts: 3,
      expiresAt: new Date(Date.now() + 600_000),
      isUsed: false,
    });

    const resetOk = await app.request(
      "https://alice.store254.co.ke/api/auth/reset-password",
      {
        method: "POST",
        headers: tenantReq("alice", { "Content-Type": "application/json" }, tenantResetIp),
        body: JSON.stringify({
          email: "cust@example.com",
          otp: "555555",
          newPassword: "NewPass123!",
        }),
      },
      env as any
    );
    expect(resetOk.status).toBe(200);
    const [custAfter] = await db.select().from(users).where(eq(users.id, "tenant-cust-1"));
    expect(custAfter.tokenVersion).toBe(1);
  });

  it("SEC-01: change-password and logout increment tokenVersion", async () => {
    const db = createDb(d1);
    await db.insert(users).values({
      id: "owner-tv",
      tenantId: "tenant-alice",
      email: "owner@alice.com",
      passwordHash: await hashPassword("CurrentPass123!"),
      role: "OWNER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      tokenVersion: 0,
    });

    const token = await createAccessToken(
      {
        id: "owner-tv",
        tenantId: "tenant-alice",
        email: "owner@alice.com",
        role: "OWNER",
      },
      jwtSecret
    );

    const changeRes = await app.request(
      "https://alice.store254.co.ke/api/auth/change-password",
      {
        method: "POST",
        headers: tenantReq("alice", {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        }),
        body: JSON.stringify({
          currentPassword: "CurrentPass123!",
          newPassword: "UpdatedPass123!",
        }),
      },
      env as any
    );
    expect(changeRes.status).toBe(200);

    let [row] = await db.select().from(users).where(eq(users.id, "owner-tv"));
    expect(row.tokenVersion).toBe(1);

    const logoutRes = await app.request(
      "https://alice.store254.co.ke/api/auth/logout",
      {
        method: "POST",
        headers: tenantReq("alice", { Authorization: `Bearer ${token}` }),
      },
      env as any
    );
    expect(logoutRes.status).toBe(200);

    [row] = await db.select().from(users).where(eq(users.id, "owner-tv"));
    expect(row.tokenVersion).toBe(2);

    // Platform logout with SSO cookie also increments tokenVersion
    const sso = await createCustomerSsoToken(
      {
        sub: "g-sub-owner",
        email: "owner@alice.com",
        emailVerified: true,
        name: "Owner",
      },
      jwtSecret,
      3600
    );
    const platLogout = await app.request(
      "https://store254.co.ke/api/platform/logout",
      {
        method: "POST",
        headers: {
          Origin: "https://store254.co.ke",
          Cookie: `${CUSTOMER_SESSION_COOKIE}=${sso}`,
        },
      },
      env as any
    );
    expect(platLogout.status).toBe(200);
    [row] = await db.select().from(users).where(eq(users.id, "owner-tv"));
    expect(row.tokenVersion).toBe(3);
  });

  it("SEC-08: GET /api/platform/stores strips staffPermissions and internal keys while keeping public settings", async () => {
    const res = await app.request("https://store254.co.ke/api/platform/stores", {}, env as any);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const alice = body.data.find((s: any) => s.id === "tenant-alice");
    expect(alice).toBeDefined();
    expect(alice.settings.logoUrl).toBe("/api/media/tenant-alice/logo.webp");
    expect(alice.settings.bannerUrl).toBe("/api/media/tenant-alice/banner.webp");
    expect(alice.settings.tagline).toBe("Quality goods");
    expect(alice.settings.primaryColor).toBe("#059669");
    expect(alice.settings.staffPermissions).toBeUndefined();
    expect(alice.settings.internalSecretFlag).toBeUndefined();

    expect(
      sanitizePublicTenantSettings({
        logoUrl: "/a.png",
        staffPermissions: { x: ["manage_orders"] },
        secretKey: "123",
      })
    ).toEqual({ logoUrl: "/a.png" });
  });

  it("SEC-12, SEC-17, SEC-28: removes demo hashes, username-less staff scan, password collision oracle, and auth enumeration", async () => {
    const db = createDb(d1);
    const sharedPw = "SharedStrongPass123!";
    const sharedHash = await hashPassword(sharedPw);

    await db.insert(users).values([
      {
        id: "demo-owner",
        tenantId: "tenant-alice",
        email: "demoowner@alice.com",
        // Former DEMO_PASSWORD_HASHES entry
        passwordHash:
          "pbkdf2$sha512$100000$3d29aa15a970e1fdeac9d6d57d2863f9$682a5c5e5a279f675ed7dcd9c3a3bd1b8f434b7082d93a48897f29ea0f20f866eb48d77b8eab66bc57576a336c51562d258dcd13e5115cf41b76978b003f2575",
        role: "OWNER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
      {
        id: "real-owner",
        tenantId: "tenant-alice",
        email: "realowner@alice.com",
        passwordHash: sharedHash,
        role: "OWNER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
      {
        id: "staff-1",
        tenantId: "tenant-alice",
        email: "clerk@alice.store254.co.ke",
        passwordHash: sharedHash,
        role: "STAFF",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
      {
        id: "suspended-user",
        tenantId: "tenant-alice",
        email: "suspended@alice.com",
        passwordHash: sharedHash,
        role: "CUSTOMER",
        status: "SUSPENDED",
        emailVerifiedAt: new Date(),
      },
      {
        id: "google-user",
        tenantId: "tenant-alice",
        email: "googleonly@alice.com",
        passwordHash: "oauth$google$sub-999",
        googleId: "sub-999",
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    ]);

    // SEC-12: former DEMO_PASSWORD_HASHES cross-bypass ("demo" on 1234-hash) must fail, and no DEMO_PASSWORD_HASHES exists
    const demoBypassRes = await app.request(
      "https://alice.store254.co.ke/api/auth/login",
      {
        method: "POST",
        headers: tenantReq("alice", { "Content-Type": "application/json" }),
        body: JSON.stringify({ email: "demoowner@alice.com", password: "demo" }),
      },
      env as any
    );
    expect(demoBypassRes.status).toBe(401);
    expect(((await demoBypassRes.json()) as any).error.code).toBe("INVALID_CREDENTIALS");

    const authRoutesSource = fs.readFileSync(
      path.resolve(__dirname, "../src/modules/auth/auth.routes.ts"),
      "utf8"
    );
    expect(authRoutesSource).not.toContain("DEMO_PASSWORD_HASHES");

    // SEC-17: username-less "staff" login scan is removed
    const staffScanRes = await app.request(
      "https://alice.store254.co.ke/api/auth/login",
      {
        method: "POST",
        headers: tenantReq("alice", { "Content-Type": "application/json" }),
        body: JSON.stringify({ email: "staff", password: sharedPw }),
      },
      env as any
    );
    expect(staffScanRes.status).toBe(401);
    expect(((await staffScanRes.json()) as any).error.code).toBe("INVALID_CREDENTIALS");

    // Specific staff username login still works
    const specificStaffRes = await app.request(
      "https://alice.store254.co.ke/api/auth/login",
      {
        method: "POST",
        headers: tenantReq("alice", { "Content-Type": "application/json" }),
        body: JSON.stringify({ email: "clerk", password: sharedPw }),
      },
      env as any
    );
    expect(specificStaffRes.status).toBe(200);

    // SEC-17: Creating staff with same password as owner no longer triggers PASSWORD_CONFLICT oracle
    const ownerToken = await createAccessToken(
      {
        id: "real-owner",
        tenantId: "tenant-alice",
        email: "realowner@alice.com",
        role: "OWNER",
      },
      jwtSecret
    );
    const createStaffRes = await app.request(
      "https://alice.store254.co.ke/api/auth/staff",
      {
        method: "POST",
        headers: tenantReq("alice", {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        }),
        body: JSON.stringify({
          fullName: "Second Clerk",
          password: sharedPw,
          permissions: ["manage_products"],
        }),
      },
      env as any
    );
    expect(createStaffRes.status).toBe(201);

    // SEC-28: Uniform 401 INVALID_CREDENTIALS for suspended, Google-only, wrong password, and missing user
    for (const attempt of [
      { email: "suspended@alice.com", password: sharedPw },
      { email: "googleonly@alice.com", password: "AnyPassword123!" },
      { email: "realowner@alice.com", password: "WrongPassword123!" },
      { email: "nonexistent@alice.com", password: "WrongPassword123!" },
    ]) {
      const res = await app.request(
        "https://alice.store254.co.ke/api/auth/login",
        {
          method: "POST",
          headers: tenantReq("alice", { "Content-Type": "application/json" }),
          body: JSON.stringify(attempt),
        },
        env as any
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe("INVALID_CREDENTIALS");
      expect(body.error.message).toBe("Invalid email or password.");
    }
  });
});
