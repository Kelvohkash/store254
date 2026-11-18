import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import type { AppEnv } from "../src/types/context";
import { globalErrorHandler, notFoundHandler } from "../src/security/error-handler";
import { requestIdMiddleware } from "../src/middlewares/request-id.middleware";
import { createCustomerSsoToken } from "../src/security/jwt";
import { CUSTOMER_SESSION_COOKIE } from "../src/security/session-cookie";
import { ridesRouter } from "../src/modules/platform/rides.routes";
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

function createRidesTestApp() {
  const app = new Hono<AppEnv>();
  app.use("*", requestIdMiddleware());
  app.onError(globalErrorHandler);
  app.notFound(notFoundHandler);
  app.route("/api/platform/rides", ridesRouter);
  return app;
}

describe("Store254 Rides (Bodaboda & Taxi Live Tracking, 0% Commission)", () => {
  const jwtSecret = "test-rides-jwt-secret-key-12345678901234567890";
  const testApp = createRidesTestApp();
  let sqlite: DatabaseSync;
  let d1: D1Database;
  let env: Record<string, unknown>;
  let ipSeq = 1;

  const nextIp = () => `198.51.100.${(ipSeq++ % 240) + 10}`;
  const originHeaders = (extra: Record<string, string> = {}) => ({
    Origin: "https://store254.co.ke",
    "Content-Type": "application/json",
    "CF-Connecting-IP": nextIp(),
    ...extra,
  });

  async function makeGoogleCookie(email: string, name: string, sub: string) {
    const token = await createCustomerSsoToken(
      {
        sub,
        email,
        emailVerified: true,
        name,
      },
      jwtSecret,
      3600
    );
    return `${CUSTOMER_SESSION_COOKIE}=${token}`;
  }

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    d1 = createSqliteD1Shim(sqlite);
    env = {
      DB: d1,
      PRIMARY_DOMAIN: "store254.co.ke",
      ENVIRONMENT: "development",
      JWT_SECRET: jwtSecret,
    };
  });

  it("applies migration 0016 cleanly and creates ride_drivers and ride_requests with expected indexes", () => {
    const migrationSql = fs.readFileSync(
      path.resolve(__dirname, "../drizzle/0016_rides_portfolio_single_items.sql"),
      "utf8"
    );
    for (const stmt of migrationSql.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) sqlite.exec(trimmed);
    }

    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;
    expect(tables.map((t) => t.name)).toContain("ride_drivers");
    expect(tables.map((t) => t.name)).toContain("ride_requests");

    const indexes = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all() as Array<{ name: string }>;
    const idxNames = indexes.map((i) => i.name);
    expect(idxNames).toContain("ride_drivers_user_email_unique");
    expect(idxNames).toContain("ride_drivers_online_vehicle_status_idx");
    expect(idxNames).toContain("ride_requests_status_vehicle_driver_idx");
  });

  it("idempotently creates ride tables on an empty DB and estimates fares with 0% commission", async () => {
    // Coords estimation without pre-running migration (tests ensureRideTables too)
    const estRes = await testApp.request(
      "https://store254.co.ke/api/platform/rides/estimate",
      {
        method: "POST",
        headers: originHeaders(),
        body: JSON.stringify({
          pickupLat: -1.2676,
          pickupLng: 36.8108,
          pickupLabel: "Westlands",
          dropoffLat: -1.2895,
          dropoffLng: 36.7831,
          dropoffLabel: "Kilimani",
        }),
      },
      env as any
    );
    expect(estRes.status).toBe(200);
    const estJson = (await estRes.json()) as any;
    expect(estJson.success).toBe(true);
    expect(estJson.data.commissionKes).toBe(0);
    expect(estJson.data.commissionRate).toBe(0);
    expect(estJson.data.distanceKm).toBeGreaterThanOrEqual(1);
    expect(estJson.data.estimates.BODABODA.baseFareKes).toBe(50);
    expect(estJson.data.estimates.BODABODA.perKmRateKes).toBe(35);
    expect(estJson.data.estimates.BODABODA.commissionKes).toBe(0);
    expect(estJson.data.estimates.BODABODA.fareKes).toBeGreaterThanOrEqual(70);
    expect(estJson.data.estimates.TAXI.baseFareKes).toBe(180);
    expect(estJson.data.estimates.TAXI.perKmRateKes).toBe(65);
    expect(estJson.data.estimates.TAXI.commissionKes).toBe(0);
    expect(estJson.data.estimates.TAXI.fareKes).toBeGreaterThanOrEqual(250);

    // LocationId-based estimation using static Kenya towns
    const thika = searchStaticTowns({ q: "Thika", limit: 1 })[0];
    const kenol = searchStaticTowns({ countyId: "county-021", q: "Kenol", limit: 5 }).find(
      (l) => l.name.toLowerCase() === "kenol"
    );
    expect(thika).toBeDefined();
    expect(kenol).toBeDefined();

    const locEstRes = await testApp.request(
      "https://store254.co.ke/api/platform/rides/estimate",
      {
        method: "POST",
        headers: originHeaders(),
        body: JSON.stringify({
          pickupLocationId: thika!.id,
          dropoffLocationId: kenol!.id,
        }),
      },
      env as any
    );
    expect(locEstRes.status).toBe(200);
    const locEstJson = (await locEstRes.json()) as any;
    expect(locEstJson.data.pickup.locationId).toBe(thika!.id);
    expect(locEstJson.data.dropoff.locationId).toBe(kenol!.id);
    expect(locEstJson.data.distanceKm).toBeGreaterThan(5);
  });

  it("enforces Google auth and platform origin checks on driver and ride mutations", async () => {
    const noAuthRes = await testApp.request(
      "https://store254.co.ke/api/platform/rides/driver/register",
      {
        method: "POST",
        headers: originHeaders(),
        body: JSON.stringify({
          fullName: "Kamau Rider",
          phone: "0712345678",
          vehicleType: "BODABODA",
        }),
      },
      env as any
    );
    expect(noAuthRes.status).toBe(401);

    const driverCookie = await makeGoogleCookie("kamau@gmail.com", "Kamau Rider", "g-drv-1");
    const badOriginRes = await testApp.request(
      "https://store254.co.ke/api/platform/rides/driver/register",
      {
        method: "POST",
        headers: {
          Origin: "https://attacker.example.com",
          "Content-Type": "application/json",
          Cookie: driverCookie,
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          fullName: "Kamau Rider",
          phone: "0712345678",
          vehicleType: "BODABODA",
        }),
      },
      env as any
    );
    expect(badOriginRes.status).toBe(403);

    const noOriginRequestRes = await testApp.request(
      "https://store254.co.ke/api/platform/rides/request",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": nextIp(),
        },
        body: JSON.stringify({
          riderName: "Wanjiku",
          riderPhone: "0722111222",
          vehicleType: "BODABODA",
          pickupLat: -1.2676,
          pickupLng: 36.8108,
          dropoffLat: -1.2895,
          dropoffLng: 36.7831,
        }),
      },
      env as any
    );
    expect(noOriginRequestRes.status).toBe(403);
  });

  it("supports end-to-end ride lifecycle: driver upsert, online toggle, nearby discovery, request, accept, live GPS, polling, completion, and rating", async () => {
    const bodaCookie = await makeGoogleCookie("boda1@gmail.com", "Kamau Boda", "g-boda-1");
    const taxiCookie = await makeGoogleCookie("taxi1@gmail.com", "Otieno Taxi", "g-taxi-1");
    const otherBodaCookie = await makeGoogleCookie("boda2@gmail.com", "Mwangi Boda", "g-boda-2");
    const riderCookie = await makeGoogleCookie("wanjiku@gmail.com", "Wanjiku Buyer", "g-rider-1");

    // 1. Register Bodaboda driver and upsert profile
    const regRes1 = await testApp.request(
      "https://store254.co.ke/api/platform/rides/driver/register",
      {
        method: "POST",
        headers: originHeaders({ Cookie: bodaCookie }),
        body: JSON.stringify({
          fullName: "Kamau Boda",
          phone: "0712345678",
          mpesaPaymentInfo: "Send Money 0712345678 (Kamau)",
          vehicleType: "BODABODA",
          vehicleMakeModel: "Bajaj Boxer 150",
          plateNumber: "kmca 123b",
          locationLabel: "Westlands Stage",
          currentLat: -1.268,
          currentLng: 36.811,
        }),
      },
      env as any
    );
    expect(regRes1.status).toBe(200);
    const regJson1 = (await regRes1.json()) as any;
    expect(regJson1.data.driver.plateNumber).toBe("KMCA 123B");
    expect(regJson1.data.driver.isOnline).toBe(false);
    const bodaDriverId = regJson1.data.driver.id;

    // Upsert updates existing driver row rather than creating duplicate
    const regResUpsert = await testApp.request(
      "https://store254.co.ke/api/platform/rides/driver/register",
      {
        method: "POST",
        headers: originHeaders({ Cookie: bodaCookie }),
        body: JSON.stringify({
          fullName: "Kamau Boda Updated",
          phone: "0712345678",
          mpesaPaymentInfo: "Till 554433",
          vehicleType: "BODABODA",
          vehicleMakeModel: "TVS Apache 160",
          plateNumber: "kmca 123b",
          currentLat: -1.268,
          currentLng: 36.811,
        }),
      },
      env as any
    );
    expect(regResUpsert.status).toBe(200);
    expect(((await regResUpsert.json()) as any).data.driver.id).toBe(bodaDriverId);

    // Register Taxi driver nearby and second Bodaboda driver far away (Mombasa)
    await testApp.request(
      "https://store254.co.ke/api/platform/rides/driver/register",
      {
        method: "POST",
        headers: originHeaders({ Cookie: taxiCookie }),
        body: JSON.stringify({
          fullName: "Otieno Taxi",
          phone: "0733111222",
          mpesaPaymentInfo: "Paybill 400200 Acc 12345",
          vehicleType: "TAXI",
          vehicleMakeModel: "Toyota Axio",
          plateNumber: "KDD 456Z",
          currentLat: -1.269,
          currentLng: 36.812,
        }),
      },
      env as any
    );
    await testApp.request(
      "https://store254.co.ke/api/platform/rides/driver/register",
      {
        method: "POST",
        headers: originHeaders({ Cookie: otherBodaCookie }),
        body: JSON.stringify({
          fullName: "Mwangi Mombasa",
          phone: "0744555666",
          vehicleType: "BODABODA",
          plateNumber: "KMEE 789X",
          currentLat: -4.0435,
          currentLng: 39.6682,
        }),
      },
      env as any
    );

    // 2. Toggle drivers online
    const onlineBoda = await testApp.request(
      "https://store254.co.ke/api/platform/rides/driver/status",
      {
        method: "POST",
        headers: originHeaders({ Cookie: bodaCookie }),
        body: JSON.stringify({
          isOnline: true,
          currentLat: -1.2682,
          currentLng: 36.8112,
          heading: 90,
        }),
      },
      env as any
    );
    expect(onlineBoda.status).toBe(200);
    expect(((await onlineBoda.json()) as any).data.driver.isOnline).toBe(true);

    await testApp.request(
      "https://store254.co.ke/api/platform/rides/driver/status",
      {
        method: "POST",
        headers: originHeaders({ Cookie: taxiCookie }),
        body: JSON.stringify({ isOnline: true }),
      },
      env as any
    );
    await testApp.request(
      "https://store254.co.ke/api/platform/rides/driver/status",
      {
        method: "POST",
        headers: originHeaders({ Cookie: otherBodaCookie }),
        body: JSON.stringify({ isOnline: true }),
      },
      env as any
    );

    // 3. Nearby discovery filters by vehicleType & radiusKm and omits PII
    const nearbyBoda = await testApp.request(
      "https://store254.co.ke/api/platform/rides/nearby?lat=-1.2676&lng=36.8108&vehicleType=BODABODA&radiusKm=25",
      { headers: { "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(nearbyBoda.status).toBe(200);
    const nearbyJson = (await nearbyBoda.json()) as any;
    expect(nearbyJson.data.commissionKes).toBe(0);
    expect(nearbyJson.data.drivers).toHaveLength(1);
    expect(nearbyJson.data.drivers[0].id).toBe(bodaDriverId);
    expect(nearbyJson.data.drivers[0].distanceKm).toBeLessThan(1);
    expect(nearbyJson.data.drivers[0].etaMinutes).toBeGreaterThanOrEqual(2);
    expect(nearbyJson.data.drivers[0].userEmail).toBeUndefined();
    expect(nearbyJson.data.drivers[0].phone).toBeUndefined();

    // Nearby discovery via static locationId
    const westlandsLoc = searchStaticTowns({ countyId: "county-047", q: "Westlands", limit: 1 })[0];
    if (westlandsLoc) {
      const nearbyLocRes = await testApp.request(
        `https://store254.co.ke/api/platform/rides/nearby?locationId=${encodeURIComponent(westlandsLoc.id)}`,
        { headers: { "CF-Connecting-IP": nextIp() } },
        env as any
      );
      expect(nearbyLocRes.status).toBe(200);
      const nearbyLocJson = (await nearbyLocRes.json()) as any;
      expect(nearbyLocJson.data.drivers.length).toBe(2);
    }

    // 4. Rider creates a ride request
    const reqRes = await testApp.request(
      "https://store254.co.ke/api/platform/rides/request",
      {
        method: "POST",
        headers: originHeaders({ Cookie: riderCookie }),
        body: JSON.stringify({
          riderName: "Wanjiku",
          riderPhone: "0722987654",
          vehicleType: "BODABODA",
          pickupLabel: "Sarit Centre",
          pickupLat: -1.2615,
          pickupLng: 36.8019,
          dropoffLabel: "Yaya Centre",
          dropoffLat: -1.2929,
          dropoffLng: 36.7879,
        }),
      },
      env as any
    );
    expect(reqRes.status).toBe(201);
    const reqJson = (await reqRes.json()) as any;
    expect(reqJson.data.commissionKes).toBe(0);
    expect(reqJson.data.ride.status).toBe("REQUESTED");
    expect(reqJson.data.ride.trackingTokenHash).toBeUndefined();
    const rideId = reqJson.data.ride.id;
    const trackingToken = reqJson.data.trackingToken;
    expect(typeof trackingToken).toBe("string");
    expect(trackingToken.length).toBeGreaterThanOrEqual(32);

    // 5. Driver /me returns open REQUESTED rides within 25km matching vehicleType
    const bodaMeRes = await testApp.request(
      "https://store254.co.ke/api/platform/rides/driver/me",
      { headers: { Cookie: bodaCookie, "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(bodaMeRes.status).toBe(200);
    const bodaMeJson = (await bodaMeRes.json()) as any;
    expect(bodaMeJson.data.openRequests).toHaveLength(1);
    expect(bodaMeJson.data.openRequests[0].id).toBe(rideId);
    expect(bodaMeJson.data.openRequests[0].trackingTokenHash).toBeUndefined();

    // Taxi driver does NOT see BODABODA open request
    const taxiMeRes = await testApp.request(
      "https://store254.co.ke/api/platform/rides/driver/me",
      { headers: { Cookie: taxiCookie, "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(((await taxiMeRes.json()) as any).data.openRequests).toHaveLength(0);

    // Unauthorized polling is blocked
    const unauthPoll = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${rideId}`,
      { headers: { "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(unauthPoll.status).toBe(401);

    const wrongTokenPoll = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${rideId}?trackingToken=invalid-token`,
      { headers: { "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(wrongTokenPoll.status).toBe(403);

    // 6. Bodaboda driver accepts the ride
    const acceptRes = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${rideId}/status`,
      {
        method: "POST",
        headers: originHeaders({ Cookie: bodaCookie }),
        body: JSON.stringify({ action: "ACCEPT" }),
      },
      env as any
    );
    expect(acceptRes.status).toBe(200);
    expect(((await acceptRes.json()) as any).data.ride.status).toBe("ACCEPTED");

    // Second bodaboda driver cannot accept an already claimed ride
    const doubleAcceptRes = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${rideId}/status`,
      {
        method: "POST",
        headers: originHeaders({ Cookie: otherBodaCookie }),
        body: JSON.stringify({ action: "ACCEPT" }),
      },
      env as any
    );
    expect(doubleAcceptRes.status).toBe(409);

    // 7. Live GPS update syncs to both driver and active ride
    const gpsRes = await testApp.request(
      "https://store254.co.ke/api/platform/rides/driver/location",
      {
        method: "POST",
        headers: originHeaders({ Cookie: bodaCookie }),
        body: JSON.stringify({ lat: -1.263, lng: 36.805, heading: 210 }),
      },
      env as any
    );
    expect(gpsRes.status).toBe(200);
    expect(((await gpsRes.json()) as any).data.syncedActiveRides).toBe(1);

    // 8. Rider live polls via trackingToken
    const pollRes = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${rideId}?trackingToken=${encodeURIComponent(trackingToken)}`,
      { headers: { "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(pollRes.status).toBe(200);
    const pollJson = (await pollRes.json()) as any;
    expect(pollJson.data.commissionKes).toBe(0);
    expect(pollJson.data.ride.status).toBe("ACCEPTED");
    expect(pollJson.data.ride.driverLat).toBeCloseTo(-1.263, 4);
    expect(pollJson.data.ride.driverLng).toBeCloseTo(36.805, 4);
    expect(pollJson.data.ride.trackingTokenHash).toBeUndefined();
    expect(pollJson.data.driver.phone).toBe("0712345678");
    expect(pollJson.data.driver.mpesaPaymentInfo).toBe("Till 554433");
    expect(pollJson.data.driver.userEmail).toBeUndefined();
    expect(pollJson.data.driverDistanceKm).toBeLessThan(1);
    expect(pollJson.data.driverEtaMinutes).toBeGreaterThanOrEqual(2);

    // Rider & assigned driver can also poll via Google session without trackingToken; unrelated user is rejected
    const riderCookiePoll = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${rideId}`,
      { headers: { Cookie: riderCookie, "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(riderCookiePoll.status).toBe(200);

    const driverCookiePoll = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${rideId}`,
      { headers: { Cookie: bodaCookie, "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(driverCookiePoll.status).toBe(200);

    const strangerCookiePoll = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${rideId}`,
      { headers: { Cookie: taxiCookie, "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(strangerCookiePoll.status).toBe(403);

    // Cannot rate before completion
    const earlyRateRes = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${rideId}/rate`,
      {
        method: "POST",
        headers: originHeaders(),
        body: JSON.stringify({ rating: 5, trackingToken }),
      },
      env as any
    );
    expect(earlyRateRes.status).toBe(400);

    // 9. Driver transitions ARRIVING -> START -> COMPLETE
    const arrivingRes = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${rideId}/status`,
      {
        method: "POST",
        headers: originHeaders({ Cookie: bodaCookie }),
        body: JSON.stringify({ action: "ARRIVING" }),
      },
      env as any
    );
    expect(arrivingRes.status).toBe(200);
    expect(((await arrivingRes.json()) as any).data.ride.status).toBe("ARRIVING");

    const startRes = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${rideId}/status`,
      {
        method: "POST",
        headers: originHeaders({ Cookie: bodaCookie }),
        body: JSON.stringify({ action: "START" }),
      },
      env as any
    );
    expect(startRes.status).toBe(200);
    expect(((await startRes.json()) as any).data.ride.status).toBe("IN_PROGRESS");

    const completeRes = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${rideId}/status`,
      {
        method: "POST",
        headers: originHeaders({ Cookie: bodaCookie }),
        body: JSON.stringify({ action: "COMPLETE" }),
      },
      env as any
    );
    expect(completeRes.status).toBe(200);
    expect(((await completeRes.json()) as any).data.ride.status).toBe("COMPLETED");

    // Driver is no longer busy and completedRides incremented
    const afterCompleteMe = await testApp.request(
      "https://store254.co.ke/api/platform/rides/driver/me",
      { headers: { Cookie: bodaCookie, "CF-Connecting-IP": nextIp() } },
      env as any
    );
    const afterCompleteJson = (await afterCompleteMe.json()) as any;
    expect(afterCompleteJson.data.driver.isBusy).toBe(false);
    expect(afterCompleteJson.data.driver.completedRides).toBe(1);
    expect(afterCompleteJson.data.activeRide).toBeNull();

    // 10. Rider rates completed ride & duplicate rating is rejected
    const rateRes = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${rideId}/rate`,
      {
        method: "POST",
        headers: originHeaders(),
        body: JSON.stringify({
          rating: 4,
          review: "Smooth and quick ride!",
          trackingToken,
        }),
      },
      env as any
    );
    expect(rateRes.status).toBe(200);
    const rateJson = (await rateRes.json()) as any;
    expect(rateJson.data.ride.riderRating).toBe(4);
    expect(rateJson.data.driver.ratingAvg).toBe(4);
    expect(rateJson.data.driver.ratingCount).toBe(1);

    const dupRateRes = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${rideId}/rate`,
      {
        method: "POST",
        headers: originHeaders(),
        body: JSON.stringify({ rating: 5, trackingToken }),
      },
      env as any
    );
    expect(dupRateRes.status).toBe(409);

    // 11. Second ride cancelled by rider clears driver isBusy
    const req2Res = await testApp.request(
      "https://store254.co.ke/api/platform/rides/request",
      {
        method: "POST",
        headers: originHeaders(),
        body: JSON.stringify({
          riderName: "Guest Rider",
          riderPhone: "0700112233",
          vehicleType: "BODABODA",
          pickupLabel: "ABC Place",
          pickupLat: -1.2605,
          pickupLng: 36.7915,
          dropoffLabel: "CBD",
          dropoffLat: -1.2864,
          dropoffLng: 36.8172,
        }),
      },
      env as any
    );
    expect(req2Res.status).toBe(201);
    const req2Json = (await req2Res.json()) as any;
    const ride2Id = req2Json.data.ride.id;
    const token2 = req2Json.data.trackingToken;

    await testApp.request(
      `https://store254.co.ke/api/platform/rides/${ride2Id}/status`,
      {
        method: "POST",
        headers: originHeaders({ Cookie: bodaCookie }),
        body: JSON.stringify({ action: "ACCEPT" }),
      },
      env as any
    );

    // Unrelated user cannot cancel
    const intruderCancel = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${ride2Id}/status`,
      {
        method: "POST",
        headers: originHeaders({ Cookie: taxiCookie }),
        body: JSON.stringify({ action: "CANCEL" }),
      },
      env as any
    );
    expect(intruderCancel.status).toBe(403);

    // Authorized rider cancels via trackingToken
    const riderCancel = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${ride2Id}/status`,
      {
        method: "POST",
        headers: originHeaders(),
        body: JSON.stringify({ action: "CANCEL", trackingToken: token2 }),
      },
      env as any
    );
    expect(riderCancel.status).toBe(200);
    expect(((await riderCancel.json()) as any).data.ride.status).toBe("CANCELLED");

    const finalMe = await testApp.request(
      "https://store254.co.ke/api/platform/rides/driver/me",
      { headers: { Cookie: bodaCookie, "CF-Connecting-IP": nextIp() } },
      env as any
    );
    expect(((await finalMe.json()) as any).data.driver.isBusy).toBe(false);

    // 12. Third ride completed and rated 5 updates ratingAvg from 4 -> 4.5; omitted isOnline toggles cleanly
    const req3Res = await testApp.request(
      "https://store254.co.ke/api/platform/rides/request",
      {
        method: "POST",
        headers: originHeaders({ Cookie: riderCookie }),
        body: JSON.stringify({
          riderName: "Wanjiku",
          riderPhone: "0722987654",
          vehicleType: "BODABODA",
          pickupLabel: "Westlands",
          pickupLat: -1.2676,
          pickupLng: 36.8108,
          dropoffLabel: "Parklands",
          dropoffLat: -1.2624,
          dropoffLng: 36.8165,
        }),
      },
      env as any
    );
    expect(req3Res.status).toBe(201);
    const ride3 = ((await req3Res.json()) as any).data;
    await testApp.request(
      `https://store254.co.ke/api/platform/rides/${ride3.ride.id}/status`,
      {
        method: "POST",
        headers: originHeaders({ Cookie: bodaCookie }),
        body: JSON.stringify({ action: "ACCEPT" }),
      },
      env as any
    );
    await testApp.request(
      `https://store254.co.ke/api/platform/rides/${ride3.ride.id}/status`,
      {
        method: "POST",
        headers: originHeaders({ Cookie: bodaCookie }),
        body: JSON.stringify({ action: "COMPLETE" }),
      },
      env as any
    );
    const rate3Res = await testApp.request(
      `https://store254.co.ke/api/platform/rides/${ride3.ride.id}/rate`,
      {
        method: "POST",
        headers: originHeaders({ Cookie: riderCookie }),
        body: JSON.stringify({ score: 5 }),
      },
      env as any
    );
    expect(rate3Res.status).toBe(200);
    const rate3Json = (await rate3Res.json()) as any;
    expect(rate3Json.data.driver.ratingAvg).toBe(4.5);
    expect(rate3Json.data.driver.ratingCount).toBe(2);

    const toggleOff = await testApp.request(
      "https://store254.co.ke/api/platform/rides/driver/status",
      {
        method: "POST",
        headers: originHeaders({ Cookie: bodaCookie }),
        body: JSON.stringify({}),
      },
      env as any
    );
    expect(toggleOff.status).toBe(200);
    expect(((await toggleOff.json()) as any).data.driver.isOnline).toBe(false);
  });
});
