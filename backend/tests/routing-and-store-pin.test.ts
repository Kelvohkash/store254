import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import app from "../src/index";
import { hashPassword } from "../src/security/crypto";
import { createAccessToken, createCustomerSsoToken } from "../src/security/jwt";
import { CUSTOMER_SESSION_COOKIE } from "../src/security/session-cookie";
import { computeRoadRoute } from "../src/modules/platform/routing.service";
import { searchStaticTowns } from "../src/modules/platform/kenya-static-data";

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

function initRoutingTestSchema(sqlite: DatabaseSync) {
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

describe("Store254 Road Routing, Exact Store Pinning & Subdomain Rides", () => {
  const jwtSecret = "test-routing-jwt-secret-key-1234567890123456";
  let sqlite: DatabaseSync;
  let d1: D1Database;
  let env: Record<string, any>;
  let ipCounter = 1;

  const nextIp = () => `203.0.113.${(ipCounter++ % 220) + 10}`;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    initRoutingTestSchema(sqlite);
    d1 = createSqliteD1Shim(sqlite);
    env = {
      DB: d1,
      PRIMARY_DOMAIN: "store254.co.ke",
      ENVIRONMENT: "production",
      JWT_SECRET: jwtSecret,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("computes OSRM road route with [lat, lng] polyline and turn-by-turn steps", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: "Ok",
          routes: [
            {
              distance: 4250,
              duration: 720,
              geometry: {
                type: "LineString",
                coordinates: [
                  [36.8108, -1.2676],
                  [36.805, -1.275],
                  [36.7831, -1.2895],
                ],
              },
              legs: [
                {
                  steps: [
                    {
                      name: "Waiyaki Way",
                      distance: 1500,
                      duration: 240,
                      maneuver: {
                        type: "depart",
                        modifier: "south",
                        location: [36.8108, -1.2676],
                      },
                    },
                    {
                      name: "Ring Road Kilimani",
                      distance: 2750,
                      duration: 480,
                      maneuver: {
                        type: "turn",
                        modifier: "left",
                        location: [36.805, -1.275],
                      },
                    },
                    {
                      name: "Argwings Kodhek Rd",
                      distance: 0,
                      duration: 0,
                      maneuver: {
                        type: "arrive",
                        location: [36.7831, -1.2895],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const route = await computeRoadRoute({
      fromLat: -1.2676,
      fromLng: 36.8108,
      toLat: -1.2895,
      toLng: 36.7831,
      mode: "driving",
      fetchImpl: mockFetch as any,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(route.source).toBe("osrm");
    expect(route.mode).toBe("driving");
    expect(route.distanceKm).toBe(4.25);
    expect(route.durationMinutes).toBe(12);
    expect(route.geometry).toEqual([
      [-1.2676, 36.8108],
      [-1.275, 36.805],
      [-1.2895, 36.7831],
    ]);
    expect(route.steps).toHaveLength(3);
    expect(route.steps[1].instruction).toBe("Turn left onto Ring Road Kilimani");
    expect(route.bbox).toEqual([-1.2895, 36.7831, -1.2676, 36.8108]);
  });

  it("falls back gracefully when OSRM fails or times out", async () => {
    const failingFetch = vi.fn().mockRejectedValueOnce(new Error("network timeout"));
    const route = await computeRoadRoute({
      fromLat: -1.2676,
      fromLng: 36.8108,
      toLat: -1.2895,
      toLng: 36.7831,
      mode: "walking",
      fetchImpl: failingFetch as any,
    });

    expect(route.source).toBe("fallback");
    expect(route.mode).toBe("walking");
    expect(route.distanceKm).toBeGreaterThan(1);
    expect(route.durationMinutes).toBeGreaterThanOrEqual(1);
    expect(route.geometry).toEqual([
      [-1.2676, 36.8108],
      [-1.2895, 36.7831],
    ]);
    expect(route.steps.length).toBeGreaterThanOrEqual(2);
  });

  it("validates GET /api/platform/locations/route bounds and serves driving/walking routes", async () => {
    const badRes = await app.request(
      "https://store254.co.ke/api/platform/locations/route?fromLat=99&fromLng=36.8&toLat=-1.28&toLng=36.81",
      { headers: { "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(badRes.status).toBe(400);

    const farRes = await app.request(
      "https://store254.co.ke/api/platform/locations/route?fromLat=-1.286&fromLng=36.817&toLat=51.507&toLng=-0.127",
      { headers: { "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(farRes.status).toBe(400);
    expect(((await farRes.json()) as any).error.code).toBe("ROUTE_TOO_FAR");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "Ok",
            routes: [
              {
                distance: 1850,
                duration: 1200,
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [36.81, -1.27],
                    [36.82, -1.28],
                  ],
                },
                legs: [{ steps: [{ name: "Kenyatta Ave", distance: 1850, duration: 1200, maneuver: { type: "depart", location: [36.81, -1.27] } }] }],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    const okDrive = await app.request(
      "https://store254.co.ke/api/platform/locations/route?fromLat=-1.27&fromLng=36.81&toLat=-1.28&toLng=36.82&mode=driving",
      { headers: { "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(okDrive.status).toBe(200);
    const driveBody = (await okDrive.json()) as any;
    expect(driveBody.success).toBe(true);
    expect(driveBody.data.source).toBe("osrm");
    expect(driveBody.data.mode).toBe("driving");

    const okWalk = await app.request(
      "https://store254.co.ke/api/platform/locations/route?fromLat=-1.27&fromLng=36.81&toLat=-1.28&toLng=36.82&mode=walking",
      { headers: { "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(okWalk.status).toBe(200);
    const walkBody = (await okWalk.json()) as any;
    expect(walkBody.data.mode).toBe("walking");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("saves, preserves, clears, and exposes exact store pins on /api/store and /api/platform/stores", async () => {
    const westlands = searchStaticTowns({ countyId: "county-047", q: "Westlands", limit: 1 })[0];
    expect(westlands).toBeDefined();

    const pwHash = await hashPassword("OwnerPass123!");
    sqlite
      .prepare(
        `INSERT INTO tenants (id, name, subdomain, status, location_id, location_label, settings) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "tenant-pin-1",
        "Pin Shop",
        "pinshop",
        "ACTIVE",
        westlands!.id,
        "Westlands, Nairobi",
        JSON.stringify({ physicalAddress: "Sarit Ground Floor" })
      );
    sqlite
      .prepare(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("owner-pin-1", "tenant-pin-1", "owner@pinshop.co.ke", pwHash, "Pin Owner", "OWNER", "ACTIVE", 1700000000);

    const ownerToken = await createAccessToken(
      {
        id: "owner-pin-1",
        tenantId: "tenant-pin-1",
        email: "owner@pinshop.co.ke",
        role: "OWNER",
        tokenVersion: 0,
      },
      jwtSecret
    );

    // Initially falls back to Westlands town coordinates (isExactPin: false)
    const beforeStoreRes = await app.request(
      "https://pinshop.store254.co.ke/api/store",
      { headers: { Host: "pinshop.store254.co.ke", "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(beforeStoreRes.status).toBe(200);
    const beforeStoreJson = (await beforeStoreRes.json()) as any;
    expect(beforeStoreJson.data.locationCoords.isExactPin).toBe(false);
    expect(beforeStoreJson.data.locationCoords.lat).toBeCloseTo(westlands!.latitude, 3);

    // Merchant pins exact shop entrance
    const pinRes = await app.request(
      "https://pinshop.store254.co.ke/api/store/settings",
      {
        method: "PATCH",
        headers: {
          Host: "pinshop.store254.co.ke",
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          settings: {
            exactLocation: {
              lat: -1.2614231,
              lng: 36.8021459,
              label: "Sarit Gate B",
              directionsNote: "Stall 14 beside main escalator",
            },
          },
        }),
      },
      env as any
    );
    expect(pinRes.status).toBe(200);

    // Subsequent unrelated PATCH omitting exactLocation must preserve the pin
    const keepRes = await app.request(
      "https://pinshop.store254.co.ke/api/store/settings",
      {
        method: "PATCH",
        headers: {
          Host: "pinshop.store254.co.ke",
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          settings: {
            tagline: "Open daily 8am - 8pm",
          },
        }),
      },
      env as any
    );
    expect(keepRes.status).toBe(200);

    // Public /api/store & /api/platform/stores return isExactPin: true
    const afterStoreRes = await app.request(
      "https://pinshop.store254.co.ke/api/store",
      { headers: { Host: "pinshop.store254.co.ke", "CF-Connecting-IP": nextIp() } },
      env as any
    );
    const afterStoreJson = (await afterStoreRes.json()) as any;
    expect(afterStoreJson.data.locationCoords).toMatchObject({
      lat: -1.261423,
      lng: 36.802146,
      isExactPin: true,
      label: "Sarit Gate B",
      directionsNote: "Stall 14 beside main escalator",
      physicalAddress: "Sarit Ground Floor",
    });

    const dirRes = await app.request(
      "https://store254.co.ke/api/platform/stores",
      { headers: { "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(dirRes.status).toBe(200);
    const dirBody = (await dirRes.json()) as any;
    const listed = dirBody.data.find((s: any) => s.id === "tenant-pin-1");
    expect(listed.locationCoords.isExactPin).toBe(true);
    expect(listed.locationCoords.lat).toBe(-1.261423);

    // Explicit exactLocation: null clears the exact pin and restores fallback area coords
    const clearRes = await app.request(
      "https://pinshop.store254.co.ke/api/store/settings",
      {
        method: "PATCH",
        headers: {
          Host: "pinshop.store254.co.ke",
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          settings: {
            exactLocation: null,
          },
        }),
      },
      env as any
    );
    expect(clearRes.status).toBe(200);

    const clearedStoreRes = await app.request(
      "https://pinshop.store254.co.ke/api/store",
      { headers: { Host: "pinshop.store254.co.ke", "CF-Connecting-IP": nextIp() } },
      env as any
    );
    const clearedJson = (await clearedStoreRes.json()) as any;
    expect(clearedJson.data.locationCoords.isExactPin).toBe(false);
  });

  it("stores optional exactLat/exactLng/directionsNote during /register-store", async () => {
    const westlands = searchStaticTowns({ countyId: "county-047", q: "Westlands", limit: 1 })[0];
    expect(westlands).toBeDefined();

    const ssoToken = await createCustomerSsoToken(
      {
        sub: "g-onboard-pin",
        email: "newshop@gmail.com",
        emailVerified: true,
        name: "New Shop Owner",
      },
      jwtSecret,
      3600
    );

    const regRes = await app.request(
      "https://store254.co.ke/api/platform/register-store",
      {
        method: "POST",
        headers: {
          Origin: "https://store254.co.ke",
          "Content-Type": "application/json",
          Cookie: `${CUSTOMER_SESSION_COOKIE}=${ssoToken}`,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          storeName: "Westgate Books",
          subdomain: "westgatebooks",
          businessType: "EDUCATION",
          ownerFullName: "New Shop Owner",
          ownerPhone: " +254 712 345 678 ",
          ownerEmail: "newshop@gmail.com",
          ownerPassword: "StrongPassword123!",
          countyId: westlands!.countyId,
          constituencyId: westlands!.constituencyId,
          locationId: westlands!.id,
          exactLat: -1.258234,
          exactLng: 36.803456,
          directionsNote: "2nd floor right wing",
          acceptedTerms: true,
        }),
      },
      env as any
    );
    expect(regRes.status).toBe(201);
    const regBody = (await regRes.json()) as any;
    expect(regBody.data.owner.phone).toBe("+254 712 345 678");

    const row = sqlite
      .prepare(`SELECT id, settings FROM tenants WHERE subdomain = ?`)
      .get("westgatebooks") as { id: string; settings: string };
    const savedSettings = JSON.parse(row.settings);
    expect(savedSettings.contactPhone).toBe("+254 712 345 678");
    expect(savedSettings.exactLocation).toMatchObject({
      lat: -1.258234,
      lng: 36.803456,
      directionsNote: "2nd floor right wing",
    });

    const ownerRow = sqlite
      .prepare(`SELECT phone FROM users WHERE tenant_id = ? AND role = 'OWNER'`)
      .get(row.id) as { phone: string | null } | undefined;
    expect(ownerRow?.phone).toBe("+254 712 345 678");

    const missingPhoneRes = await app.request(
      "https://store254.co.ke/api/platform/register-store",
      {
        method: "POST",
        headers: {
          Origin: "https://store254.co.ke",
          "Content-Type": "application/json",
          Cookie: `${CUSTOMER_SESSION_COOKIE}=${ssoToken}`,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          storeName: "Westgate Books Two",
          subdomain: "westgatebooks2",
          businessType: "EDUCATION",
          ownerFullName: "New Shop Owner",
          ownerEmail: "newshop@gmail.com",
          ownerPassword: "StrongPassword123!",
          countyId: westlands!.countyId,
          constituencyId: westlands!.constituencyId,
          locationId: westlands!.id,
          acceptedTerms: true,
        }),
      },
      env as any
    );
    expect(missingPhoneRes.status).toBe(400);
  });

  it("accepts bounded routeDistanceKm on rides and allows Store254 store subdomain origins while blocking attackers", async () => {
    // Subdomain origin allowed for ride estimate & request
    const subEstRes = await app.request(
      "https://pinshop.store254.co.ke/api/platform/rides/estimate",
      {
        method: "POST",
        headers: {
          Origin: "https://pinshop.store254.co.ke",
          "Content-Type": "application/json",
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          pickupLat: -1.2676,
          pickupLng: 36.8108,
          dropoffLat: -1.2895,
          dropoffLng: 36.7831,
          routeDistanceKm: 5.4,
          routeDurationMinutes: 14,
        }),
      },
      env as any
    );
    expect(subEstRes.status).toBe(200);
    const estJson = (await subEstRes.json()) as any;
    expect(estJson.data.distanceKm).toBe(5.4);
    expect(estJson.data.estimates.BODABODA.etaMinutes).toBe(14);

    // Subdomain origin allowed for ride request
    const subReqRes = await app.request(
      "https://pinshop.store254.co.ke/api/platform/rides/request",
      {
        method: "POST",
        headers: {
          Origin: "https://pinshop.store254.co.ke",
          "Content-Type": "application/json",
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          riderName: "Shopper",
          riderPhone: "0712345678",
          vehicleType: "BODABODA",
          pickupLat: -1.2676,
          pickupLng: 36.8108,
          dropoffLat: -1.2895,
          dropoffLng: 36.7831,
          routeDistanceKm: 5.4,
          routeDurationMinutes: 14,
        }),
      },
      env as any
    );
    expect(subReqRes.status).toBe(201);
    const reqJson = (await subReqRes.json()) as any;
    expect(reqJson.data.ride.distanceKm).toBe(5.4);

    // External attacker origin still blocked
    const evilReqRes = await app.request(
      "https://store254.co.ke/api/platform/rides/request",
      {
        method: "POST",
        headers: {
          Origin: "https://attacker.example.com",
          "Content-Type": "application/json",
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          riderName: "Attacker",
          riderPhone: "0712345678",
          vehicleType: "BODABODA",
          pickupLat: -1.2676,
          pickupLng: 36.8108,
          dropoffLat: -1.2895,
          dropoffLng: 36.7831,
        }),
      },
      env as any
    );
    expect(evilReqRes.status).toBe(403);
  });
});
