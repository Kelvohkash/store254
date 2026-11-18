import { Hono, type Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import {
  RIDE_VEHICLE_TYPES,
  rideDrivers,
  rideRequests,
  type RideDriver,
  type RideRequest,
  type RideVehicleType,
} from "../../db/schema/rides";
import { kenyaLocations } from "../../db/schema/kenya-locations";
import { AppError } from "../../security/error-handler";
import { rateLimiter } from "../../security/rate-limiter";
import {
  generateSecureToken,
  generateUUID,
  hashOtp,
  timingSafeEqual,
} from "../../security/crypto";
import { verifyCustomerSsoToken } from "../../security/jwt";
import {
  CUSTOMER_SESSION_COOKIE,
  getCookieValue,
} from "../../security/session-cookie";
import type { GoogleTokenPayload } from "../../security/google-auth";
import { haversineKm } from "./locations.service";
import { getStaticLocationById } from "./kenya-static-data";

export const ridesRouter = new Hono<AppEnv>();

const DEFAULT_RADIUS_KM = 25;
const MAX_RADIUS_KM = 200;
const DRIVER_SPEED_KMH = 28;
const ACTIVE_RIDE_STATUSES = ["ACCEPTED", "ARRIVING", "IN_PROGRESS"] as const;

const ensuredRideDatabases = new WeakMap<object, Promise<void>>();

const RIDE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS ride_drivers (
    id text PRIMARY KEY NOT NULL,
    user_email text NOT NULL,
    full_name text NOT NULL,
    phone text NOT NULL,
    mpesa_payment_info text,
    vehicle_type text DEFAULT 'BODABODA' NOT NULL,
    vehicle_make_model text,
    plate_number text,
    county_id text,
    location_id text,
    location_label text,
    is_online integer DEFAULT 0 NOT NULL,
    is_busy integer DEFAULT 0 NOT NULL,
    current_lat real,
    current_lng real,
    heading real,
    last_location_at integer,
    base_fare_kes integer DEFAULT 50 NOT NULL,
    per_km_rate_kes integer DEFAULT 35 NOT NULL,
    rating_avg real DEFAULT 5 NOT NULL,
    rating_count integer DEFAULT 0 NOT NULL,
    completed_rides integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'ACTIVE' NOT NULL,
    created_at integer DEFAULT (unixepoch()) NOT NULL,
    updated_at integer DEFAULT (unixepoch()) NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ride_drivers_user_email_unique ON ride_drivers (user_email)`,
  `CREATE INDEX IF NOT EXISTS ride_drivers_online_vehicle_status_idx ON ride_drivers (is_online, vehicle_type, status)`,
  `CREATE TABLE IF NOT EXISTS ride_requests (
    id text PRIMARY KEY NOT NULL,
    rider_email text,
    rider_name text NOT NULL,
    rider_phone text NOT NULL,
    vehicle_type text DEFAULT 'BODABODA' NOT NULL,
    driver_id text,
    pickup_label text NOT NULL,
    pickup_lat real NOT NULL,
    pickup_lng real NOT NULL,
    pickup_location_id text,
    dropoff_label text NOT NULL,
    dropoff_lat real NOT NULL,
    dropoff_lng real NOT NULL,
    dropoff_location_id text,
    distance_km real NOT NULL,
    estimated_fare_kes integer NOT NULL,
    status text DEFAULT 'REQUESTED' NOT NULL,
    driver_lat real,
    driver_lng real,
    driver_updated_at integer,
    tracking_token_hash text NOT NULL,
    rider_rating integer,
    rider_review text,
    created_at integer DEFAULT (unixepoch()) NOT NULL,
    updated_at integer DEFAULT (unixepoch()) NOT NULL,
    FOREIGN KEY (driver_id) REFERENCES ride_drivers(id) ON UPDATE no action ON DELETE set null
  )`,
  `CREATE INDEX IF NOT EXISTS ride_requests_status_vehicle_driver_idx ON ride_requests (status, vehicle_type, driver_id)`,
  `CREATE INDEX IF NOT EXISTS ride_requests_driver_status_idx ON ride_requests (driver_id, status)`,
  `CREATE INDEX IF NOT EXISTS ride_requests_rider_email_idx ON ride_requests (rider_email)`,
];

/**
 * Idempotently guarantees ride_drivers and ride_requests tables exist on the bound D1 database.
 */
export async function ensureRideTables(db: D1Database): Promise<void> {
  const key = db as unknown as object;
  const inflight = ensuredRideDatabases.get(key);
  if (inflight) {
    await inflight;
    return;
  }

  const initPromise = (async () => {
    for (const stmt of RIDE_SCHEMA_STATEMENTS) {
      await db.prepare(stmt).run();
    }
  })();

  ensuredRideDatabases.set(key, initPromise);
  try {
    await initPromise;
  } catch (err) {
    ensuredRideDatabases.delete(key);
    throw err;
  }
}

async function readPlatformGoogleUser(
  c: Context<AppEnv>
): Promise<GoogleTokenPayload | null> {
  const jwtSecret = c.env?.JWT_SECRET;
  if (!jwtSecret) return null;
  const ssoToken = getCookieValue(
    c.req.header("cookie"),
    CUSTOMER_SESSION_COOKIE
  );
  if (!ssoToken) return null;
  try {
    return await verifyCustomerSsoToken(ssoToken, jwtSecret);
  } catch {
    return null;
  }
}

function assertAllowedPlatformOrigin(c: Context<AppEnv>): void {
  const originHeader = c.req.header("origin") || c.req.header("referer");
  if (!originHeader) {
    if (c.req.header("sec-fetch-site") === "same-origin") {
      return;
    }
    throw new AppError("Origin is required for platform mutations.", 403, "FORBIDDEN_ORIGIN");
  }

  try {
    const parsed = new URL(originHeader);
    const primaryDomain = (c.env?.PRIMARY_DOMAIN || "store254.co.ke").toLowerCase();
    const isDev = c.env?.ENVIRONMENT === "development";
    const hostname = parsed.hostname.toLowerCase();

    if (
      isDev &&
      (hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.endsWith(".localhost"))
    ) {
      return;
    }

    const isAllowed =
      parsed.protocol === "https:" &&
      (hostname === primaryDomain || hostname === `www.${primaryDomain}`);

    if (!isAllowed) {
      throw new AppError("Origin is not authorized for platform requests.", 403, "FORBIDDEN_ORIGIN");
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Invalid request origin.", 403, "FORBIDDEN_ORIGIN");
  }
}

async function requireRideDb(c: Context<AppEnv>) {
  if (!c.env?.DB) {
    throw new AppError("Database not ready.", 500, "DB_NOT_INITIALIZED");
  }
  await ensureRideTables(c.env.DB);
  return createDb(c.env.DB);
}

async function requireGoogleUser(c: Context<AppEnv>) {
  const googleUser = await readPlatformGoogleUser(c);
  if (!googleUser?.email) {
    throw new AppError(
      "Please sign in with Google to continue.",
      401,
      "UNAUTHORIZED"
    );
  }
  return googleUser;
}

function normalizePhoneInput(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  const digitCount = cleaned.replace(/\D/g, "").length;
  if (digitCount < 9 || digitCount > 15) {
    throw new AppError("Enter a valid Kenyan phone number.", 400, "INVALID_PHONE");
  }
  return cleaned;
}

function parseOptionalQueryNumber(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const num = Number(raw);
  return Number.isFinite(num) ? num : NaN;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

type DbClient = ReturnType<typeof createDb>;

interface ResolvedCoords {
  lat: number;
  lng: number;
  locationId: string | null;
  countyId: string | null;
  label: string;
}

async function lookupLocationById(
  db: DbClient | null,
  locationId: string
): Promise<{
  id: string;
  name: string;
  countyId: string;
  countyName?: string;
  latitude: number;
  longitude: number;
} | null> {
  const cleanId = locationId.trim();
  if (!cleanId) return null;

  const staticLoc = getStaticLocationById(cleanId);
  if (staticLoc) {
    return {
      id: staticLoc.id,
      name: staticLoc.name,
      countyId: staticLoc.countyId,
      countyName: staticLoc.countyName,
      latitude: staticLoc.latitude,
      longitude: staticLoc.longitude,
    };
  }

  if (!db) return null;
  try {
    const [dbLoc] = await db
      .select({
        id: kenyaLocations.id,
        name: kenyaLocations.name,
        countyId: kenyaLocations.countyId,
        latitude: kenyaLocations.latitude,
        longitude: kenyaLocations.longitude,
      })
      .from(kenyaLocations)
      .where(eq(kenyaLocations.id, cleanId))
      .limit(1);
    return dbLoc || null;
  } catch {
    return null;
  }
}

async function resolveRideEndpoint(
  db: DbClient | null,
  input: {
    lat?: number | null;
    lng?: number | null;
    locationId?: string | null;
    label?: string | null;
  },
  fallbackLabel: string
): Promise<ResolvedCoords | null> {
  const hasLat = typeof input.lat === "number";
  const hasLng = typeof input.lng === "number";
  if (hasLat !== hasLng) {
    return null;
  }

  const loc = input.locationId ? await lookupLocationById(db, input.locationId) : null;
  const locLabel = loc
    ? loc.countyName
      ? `${loc.name}, ${loc.countyName}`
      : loc.name
    : null;

  if (hasLat && hasLng) {
    if (!isValidLatLng(input.lat!, input.lng!)) {
      return null;
    }
    return {
      lat: Number(input.lat!.toFixed(6)),
      lng: Number(input.lng!.toFixed(6)),
      locationId: loc?.id || input.locationId?.trim() || null,
      countyId: loc?.countyId || null,
      label: input.label?.trim() || locLabel || fallbackLabel,
    };
  }

  if (loc) {
    return {
      lat: Number(loc.latitude.toFixed(6)),
      lng: Number(loc.longitude.toFixed(6)),
      locationId: loc.id,
      countyId: loc.countyId,
      label: input.label?.trim() || locLabel || fallbackLabel,
    };
  }

  return null;
}

function computeEtaMinutes(distanceKm: number): number {
  return Math.max(2, Math.round((distanceKm / DRIVER_SPEED_KMH) * 60));
}

function calculateFareAndEstimates(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number
) {
  const straightKm = haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const distanceKm = Math.max(1, Number((straightKm * 1.25).toFixed(1)));
  const bodaFareKes = Math.max(70, Math.round(50 + distanceKm * 35));
  const taxiFareKes = Math.max(250, Math.round(180 + distanceKm * 65));
  const etaMinutes = computeEtaMinutes(distanceKm);

  return {
    distanceKm,
    estimates: {
      BODABODA: {
        fareKes: bodaFareKes,
        etaMinutes,
        baseFareKes: 50,
        perKmRateKes: 35,
        commissionKes: 0,
      },
      TAXI: {
        fareKes: taxiFareKes,
        etaMinutes,
        baseFareKes: 180,
        perKmRateKes: 65,
        commissionKes: 0,
      },
    },
  };
}

function sanitizeRide(ride: RideRequest) {
  const { trackingTokenHash: _hidden, ...publicRide } = ride;
  return publicRide;
}

function formatNearbyDriver(
  driver: RideDriver,
  distanceKm: number | null,
  etaMinutes: number | null
) {
  return {
    id: driver.id,
    fullName: driver.fullName,
    vehicleType: driver.vehicleType,
    vehicleMakeModel: driver.vehicleMakeModel,
    plateNumber: driver.plateNumber,
    countyId: driver.countyId,
    locationId: driver.locationId,
    locationLabel: driver.locationLabel,
    currentLat: driver.currentLat,
    currentLng: driver.currentLng,
    heading: driver.heading,
    lastLocationAt: driver.lastLocationAt,
    baseFareKes: driver.baseFareKes,
    perKmRateKes: driver.perKmRateKes,
    ratingAvg: driver.ratingAvg,
    ratingCount: driver.ratingCount,
    completedRides: driver.completedRides,
    isBusy: driver.isBusy,
    distanceKm,
    etaMinutes,
  };
}

function formatAssignedDriver(
  driver: RideDriver,
  ride?: Pick<RideRequest, "driverLat" | "driverLng" | "driverUpdatedAt">
) {
  return {
    id: driver.id,
    fullName: driver.fullName,
    phone: driver.phone,
    mpesaPaymentInfo: driver.mpesaPaymentInfo,
    vehicleType: driver.vehicleType,
    vehicleMakeModel: driver.vehicleMakeModel,
    plateNumber: driver.plateNumber,
    countyId: driver.countyId,
    locationId: driver.locationId,
    locationLabel: driver.locationLabel,
    currentLat: ride?.driverLat ?? driver.currentLat,
    currentLng: ride?.driverLng ?? driver.currentLng,
    heading: driver.heading,
    lastLocationAt: ride?.driverUpdatedAt ?? driver.lastLocationAt,
    baseFareKes: driver.baseFareKes,
    perKmRateKes: driver.perKmRateKes,
    ratingAvg: driver.ratingAvg,
    ratingCount: driver.ratingCount,
    completedRides: driver.completedRides,
  };
}

function defaultRatesForVehicle(vehicleType: RideVehicleType) {
  return vehicleType === "TAXI"
    ? { baseFareKes: 180, perKmRateKes: 65 }
    : { baseFareKes: 50, perKmRateKes: 35 };
}

function readTrackingTokenFromRequest(c: Context<AppEnv>, bodyToken?: string): string {
  return (
    bodyToken?.trim() ||
    c.req.query("trackingToken")?.trim() ||
    c.req.header("x-ride-tracking-token")?.trim() ||
    ""
  );
}

async function authorizeRideParticipant(
  c: Context<AppEnv>,
  ride: RideRequest,
  driver: RideDriver | null,
  rawToken: string
): Promise<{ isRider: boolean; isDriver: boolean }> {
  let matchesToken = false;
  if (rawToken && ride.trackingTokenHash) {
    const providedHash = await hashOtp(rawToken);
    matchesToken = timingSafeEqual(providedHash, ride.trackingTokenHash);
  }

  const googleUser = await readPlatformGoogleUser(c);
  const email = googleUser?.email?.toLowerCase().trim() || "";
  const matchesRiderEmail = Boolean(
    email && ride.riderEmail && ride.riderEmail.toLowerCase().trim() === email
  );
  const matchesDriverEmail = Boolean(
    email && driver && driver.userEmail.toLowerCase().trim() === email
  );

  if (!matchesToken && !matchesRiderEmail && !matchesDriverEmail) {
    if (!rawToken && !googleUser) {
      throw new AppError(
        "Tracking token or Google sign-in is required to view this ride.",
        401,
        "UNAUTHORIZED"
      );
    }
    throw new AppError("You are not authorized to access this ride.", 403, "FORBIDDEN");
  }

  return {
    isRider: matchesToken || matchesRiderEmail,
    isDriver: matchesDriverEmail,
  };
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const estimateSchema = z.object({
  pickupLat: z.number().min(-90).max(90).optional(),
  pickupLng: z.number().min(-180).max(180).optional(),
  pickupLocationId: z.string().trim().max(80).optional().nullable(),
  pickupLabel: z.string().trim().max(200).optional().nullable(),
  dropoffLat: z.number().min(-90).max(90).optional(),
  dropoffLng: z.number().min(-180).max(180).optional(),
  dropoffLocationId: z.string().trim().max(80).optional().nullable(),
  dropoffLabel: z.string().trim().max(200).optional().nullable(),
});

const driverRegisterSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(100),
  phone: z.string().trim().min(7, "Phone number is required").max(30),
  mpesaPaymentInfo: z.string().trim().max(240).optional().nullable(),
  vehicleType: z.enum(RIDE_VEHICLE_TYPES).default("BODABODA"),
  vehicleMakeModel: z.string().trim().max(120).optional().nullable(),
  plateNumber: z.string().trim().min(2).max(30).optional().nullable(),
  countyId: z.string().trim().max(64).optional().nullable(),
  locationId: z.string().trim().max(80).optional().nullable(),
  locationLabel: z.string().trim().max(160).optional().nullable(),
  currentLat: z.number().min(-90).max(90).optional().nullable(),
  currentLng: z.number().min(-180).max(180).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  baseFareKes: z.number().int().min(0).max(50000).optional(),
  perKmRateKes: z.number().int().min(0).max(10000).optional(),
});

const driverStatusSchema = z.object({
  isOnline: z.boolean().optional(),
  currentLat: z.number().min(-90).max(90).optional().nullable(),
  currentLng: z.number().min(-180).max(180).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  heading: z.number().min(0).max(360).optional().nullable(),
});

const driverLocationSchema = z
  .object({
    currentLat: z.number().min(-90).max(90).optional(),
    currentLng: z.number().min(-180).max(180).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    heading: z.number().min(0).max(360).optional().nullable(),
  })
  .refine(
    (v) =>
      (typeof v.currentLat === "number" || typeof v.lat === "number") &&
      (typeof v.currentLng === "number" || typeof v.lng === "number"),
    { message: "Both latitude and longitude are required." }
  );

const createRideRequestSchema = z.object({
  riderName: z.string().trim().min(2, "Your name is required").max(100),
  riderPhone: z.string().trim().min(7, "Phone number is required").max(30),
  vehicleType: z.enum(RIDE_VEHICLE_TYPES).default("BODABODA"),
  pickupLabel: z.string().trim().max(200).optional().nullable(),
  pickupLat: z.number().min(-90).max(90).optional(),
  pickupLng: z.number().min(-180).max(180).optional(),
  pickupLocationId: z.string().trim().max(80).optional().nullable(),
  dropoffLabel: z.string().trim().max(200).optional().nullable(),
  dropoffLat: z.number().min(-90).max(90).optional(),
  dropoffLng: z.number().min(-180).max(180).optional(),
  dropoffLocationId: z.string().trim().max(80).optional().nullable(),
});

const rideStatusActionSchema = z.object({
  action: z.enum(["ACCEPT", "ARRIVING", "START", "COMPLETE", "CANCEL"]),
  trackingToken: z.string().trim().max(128).optional(),
});

const rateRideSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    score: z.number().int().min(1).max(5).optional(),
    review: z.string().trim().max(500).optional().nullable(),
    trackingToken: z.string().trim().max(128).optional(),
  })
  .refine((v) => typeof (v.rating ?? v.score) === "number", {
    message: "Rating between 1 and 5 is required.",
  });

// ---------------------------------------------------------------------------
// 1. Public Nearby Drivers Radar (GET /nearby)
// ---------------------------------------------------------------------------
ridesRouter.get(
  "/nearby",
  rateLimiter({ max: 90, windowMs: 60 * 1000 }),
  async (c) => {
    const db = await requireRideDb(c);

    const rawLat = parseOptionalQueryNumber(c.req.query("lat"));
    const rawLng = parseOptionalQueryNumber(c.req.query("lng"));
    const locationId = c.req.query("locationId")?.trim() || undefined;
    const rawVehicleType = c.req.query("vehicleType")?.trim().toUpperCase() || undefined;
    const rawRadius = parseOptionalQueryNumber(c.req.query("radiusKm"));

    if (
      (rawLat !== undefined && Number.isNaN(rawLat)) ||
      (rawLng !== undefined && Number.isNaN(rawLng)) ||
      (rawLat !== undefined) !== (rawLng !== undefined)
    ) {
      throw new AppError("Both lat and lng must be valid numbers.", 400, "INVALID_COORDINATES");
    }

    if (rawLat !== undefined && rawLng !== undefined && !isValidLatLng(rawLat, rawLng)) {
      throw new AppError("Latitude or longitude out of valid range.", 400, "INVALID_COORDINATES");
    }

    let vehicleTypeFilter: RideVehicleType | undefined;
    if (rawVehicleType) {
      if (rawVehicleType !== "BODABODA" && rawVehicleType !== "TAXI") {
        throw new AppError("vehicleType must be BODABODA or TAXI.", 400, "INVALID_VEHICLE_TYPE");
      }
      vehicleTypeFilter = rawVehicleType;
    }

    let radiusKm = DEFAULT_RADIUS_KM;
    if (rawRadius !== undefined) {
      if (Number.isNaN(rawRadius) || rawRadius <= 0) {
        throw new AppError("radiusKm must be a positive number.", 400, "INVALID_RADIUS");
      }
      radiusKm = Math.min(Math.max(rawRadius, 1), MAX_RADIUS_KM);
    }

    let centerLat: number | null = rawLat ?? null;
    let centerLng: number | null = rawLng ?? null;

    if (centerLat === null && locationId) {
      const resolved = await lookupLocationById(db, locationId);
      if (!resolved) {
        throw new AppError("Selected locationId was not found.", 400, "LOCATION_NOT_FOUND");
      }
      centerLat = resolved.latitude;
      centerLng = resolved.longitude;
    }

    if (centerLat === null) {
      const cf = (
        c.req.raw as Request & {
          cf?: { latitude?: string | number; longitude?: string | number };
        }
      ).cf;
      const cfLat = parseOptionalQueryNumber(
        cf?.latitude !== undefined ? String(cf.latitude) : c.req.header("x-cf-latitude")
      );
      const cfLng = parseOptionalQueryNumber(
        cf?.longitude !== undefined ? String(cf.longitude) : c.req.header("x-cf-longitude")
      );
      if (
        cfLat !== undefined &&
        cfLng !== undefined &&
        !Number.isNaN(cfLat) &&
        !Number.isNaN(cfLng) &&
        isValidLatLng(cfLat, cfLng)
      ) {
        centerLat = cfLat;
        centerLng = cfLng;
      }
    }

    const conditions = [
      eq(rideDrivers.status, "ACTIVE"),
      eq(rideDrivers.isOnline, true),
      eq(rideDrivers.isBusy, false),
    ];
    if (vehicleTypeFilter) {
      conditions.push(eq(rideDrivers.vehicleType, vehicleTypeFilter));
    }

    const candidates = await db
      .select()
      .from(rideDrivers)
      .where(and(...conditions))
      .limit(200);

    const matched: Array<{
      row: RideDriver;
      distanceKm: number | null;
      etaMinutes: number | null;
    }> = [];

    for (const drv of candidates) {
      let drvLat = drv.currentLat;
      let drvLng = drv.currentLng;
      if ((drvLat == null || drvLng == null) && drv.locationId) {
        const staticLoc = getStaticLocationById(drv.locationId);
        if (staticLoc) {
          drvLat = staticLoc.latitude;
          drvLng = staticLoc.longitude;
        }
      }

      if (centerLat !== null && centerLng !== null) {
        if (drvLat == null || drvLng == null) continue;
        const rawDist = haversineKm(centerLat, centerLng, drvLat, drvLng);
        if (rawDist > radiusKm) continue;
        const distanceKm = Number(rawDist.toFixed(2));
        matched.push({
          row: { ...drv, currentLat: drvLat, currentLng: drvLng },
          distanceKm,
          etaMinutes: computeEtaMinutes(distanceKm),
        });
      } else {
        matched.push({
          row: { ...drv, currentLat: drvLat, currentLng: drvLng },
          distanceKm: null,
          etaMinutes: null,
        });
      }
    }

    matched.sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm;
      }
      return b.row.ratingAvg - a.row.ratingAvg;
    });

    const sliced = matched.slice(0, 50);
    const bodabodaCount = sliced.filter((d) => d.row.vehicleType === "BODABODA").length;
    const taxiCount = sliced.filter((d) => d.row.vehicleType === "TAXI").length;

    return c.json({
      success: true,
      data: {
        drivers: sliced.map((d) => formatNearbyDriver(d.row, d.distanceKm, d.etaMinutes)),
        counts: {
          BODABODA: bodabodaCount,
          TAXI: taxiCount,
          total: sliced.length,
        },
        commissionKes: 0,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// 2. Fare & Distance Estimator (POST /estimate) — 0% Commission
// ---------------------------------------------------------------------------
ridesRouter.post(
  "/estimate",
  rateLimiter({ max: 90, windowMs: 60 * 1000 }),
  zValidator("json", estimateSchema),
  async (c) => {
    const body = c.req.valid("json");
    const db = c.env?.DB ? createDb(c.env.DB) : null;

    const pickup = await resolveRideEndpoint(
      db,
      {
        lat: body.pickupLat,
        lng: body.pickupLng,
        locationId: body.pickupLocationId,
        label: body.pickupLabel,
      },
      "Pickup Point"
    );
    if (!pickup) {
      throw new AppError(
        "Provide valid pickup coordinates or pickupLocationId.",
        400,
        "INVALID_PICKUP"
      );
    }

    const dropoff = await resolveRideEndpoint(
      db,
      {
        lat: body.dropoffLat,
        lng: body.dropoffLng,
        locationId: body.dropoffLocationId,
        label: body.dropoffLabel,
      },
      "Dropoff Point"
    );
    if (!dropoff) {
      throw new AppError(
        "Provide valid dropoff coordinates or dropoffLocationId.",
        400,
        "INVALID_DROPOFF"
      );
    }

    const { distanceKm, estimates } = calculateFareAndEstimates(
      pickup.lat,
      pickup.lng,
      dropoff.lat,
      dropoff.lng
    );

    return c.json({
      success: true,
      data: {
        distanceKm,
        pickup: {
          lat: pickup.lat,
          lng: pickup.lng,
          locationId: pickup.locationId,
          label: pickup.label,
        },
        dropoff: {
          lat: dropoff.lat,
          lng: dropoff.lng,
          locationId: dropoff.locationId,
          label: dropoff.label,
        },
        estimates,
        commissionKes: 0,
        commissionRate: 0,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// 3. Driver Registration / Profile Upsert (POST /driver/register)
// ---------------------------------------------------------------------------
ridesRouter.post(
  "/driver/register",
  rateLimiter({ max: 30, windowMs: 60 * 1000 }),
  async (c, next) => {
    assertAllowedPlatformOrigin(c);
    await next();
  },
  zValidator("json", driverRegisterSchema),
  async (c) => {
    const googleUser = await requireGoogleUser(c);
    const db = await requireRideDb(c);
    const body = c.req.valid("json");
    const userEmail = googleUser.email.toLowerCase().trim();
    const phone = normalizePhoneInput(body.phone);
    const now = new Date();

    const rawLat = body.currentLat ?? body.lat ?? null;
    const rawLng = body.currentLng ?? body.lng ?? null;
    if ((rawLat !== null) !== (rawLng !== null)) {
      throw new AppError("Provide both latitude and longitude.", 400, "INVALID_COORDINATES");
    }

    const resolvedLoc = body.locationId
      ? await lookupLocationById(db, body.locationId)
      : null;
    if (body.locationId && !resolvedLoc) {
      throw new AppError("Selected locationId was not found.", 400, "LOCATION_NOT_FOUND");
    }

    const effectiveLat =
      rawLat !== null ? Number(rawLat.toFixed(6)) : resolvedLoc?.latitude ?? null;
    const effectiveLng =
      rawLng !== null ? Number(rawLng.toFixed(6)) : resolvedLoc?.longitude ?? null;
    const effectiveCountyId = body.countyId?.trim() || resolvedLoc?.countyId || null;
    const effectiveLocationId = resolvedLoc?.id || body.locationId?.trim() || null;
    const effectiveLocationLabel =
      body.locationLabel?.trim() ||
      (resolvedLoc
        ? resolvedLoc.countyName
          ? `${resolvedLoc.name}, ${resolvedLoc.countyName}`
          : resolvedLoc.name
        : null);

    const defaults = defaultRatesForVehicle(body.vehicleType);
    const plateNumber = body.plateNumber ? body.plateNumber.trim().toUpperCase() : null;

    const [existing] = await db
      .select()
      .from(rideDrivers)
      .where(eq(rideDrivers.userEmail, userEmail))
      .limit(1);

    if (existing) {
      if (existing.status === "SUSPENDED") {
        throw new AppError("Your driver profile is suspended.", 403, "DRIVER_SUSPENDED");
      }

      const [updated] = await db
        .update(rideDrivers)
        .set({
          fullName: body.fullName,
          phone,
          mpesaPaymentInfo:
            body.mpesaPaymentInfo !== undefined
              ? body.mpesaPaymentInfo?.trim() || null
              : existing.mpesaPaymentInfo,
          vehicleType: body.vehicleType,
          vehicleMakeModel:
            body.vehicleMakeModel !== undefined
              ? body.vehicleMakeModel?.trim() || null
              : existing.vehicleMakeModel,
          plateNumber: plateNumber ?? existing.plateNumber,
          countyId: effectiveCountyId ?? existing.countyId,
          locationId: effectiveLocationId ?? existing.locationId,
          locationLabel: effectiveLocationLabel ?? existing.locationLabel,
          currentLat: effectiveLat ?? existing.currentLat,
          currentLng: effectiveLng ?? existing.currentLng,
          lastLocationAt:
            effectiveLat !== null ? now : existing.lastLocationAt,
          baseFareKes:
            body.baseFareKes !== undefined
              ? body.baseFareKes
              : body.vehicleType !== existing.vehicleType
                ? defaults.baseFareKes
                : existing.baseFareKes,
          perKmRateKes:
            body.perKmRateKes !== undefined
              ? body.perKmRateKes
              : body.vehicleType !== existing.vehicleType
                ? defaults.perKmRateKes
                : existing.perKmRateKes,
          updatedAt: now,
        })
        .where(eq(rideDrivers.id, existing.id))
        .returning();

      return c.json({
        success: true,
        data: { driver: updated, commissionKes: 0 },
      });
    }

    const [created] = await db
      .insert(rideDrivers)
      .values({
        id: `drv-${generateUUID()}`,
        userEmail,
        fullName: body.fullName,
        phone,
        mpesaPaymentInfo: body.mpesaPaymentInfo?.trim() || null,
        vehicleType: body.vehicleType,
        vehicleMakeModel: body.vehicleMakeModel?.trim() || null,
        plateNumber,
        countyId: effectiveCountyId,
        locationId: effectiveLocationId,
        locationLabel: effectiveLocationLabel,
        isOnline: false,
        isBusy: false,
        currentLat: effectiveLat,
        currentLng: effectiveLng,
        heading: null,
        lastLocationAt: effectiveLat !== null ? now : null,
        baseFareKes: body.baseFareKes ?? defaults.baseFareKes,
        perKmRateKes: body.perKmRateKes ?? defaults.perKmRateKes,
        ratingAvg: 5.0,
        ratingCount: 0,
        completedRides: 0,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json({
      success: true,
      data: { driver: created, commissionKes: 0 },
    });
  }
);

// ---------------------------------------------------------------------------
// 4. Driver Online Status Toggle (POST /driver/status)
// ---------------------------------------------------------------------------
ridesRouter.post(
  "/driver/status",
  rateLimiter({ max: 60, windowMs: 60 * 1000 }),
  async (c, next) => {
    assertAllowedPlatformOrigin(c);
    await next();
  },
  zValidator("json", driverStatusSchema),
  async (c) => {
    const googleUser = await requireGoogleUser(c);
    const db = await requireRideDb(c);
    const body = c.req.valid("json");
    const userEmail = googleUser.email.toLowerCase().trim();

    const [driver] = await db
      .select()
      .from(rideDrivers)
      .where(eq(rideDrivers.userEmail, userEmail))
      .limit(1);

    if (!driver) {
      throw new AppError(
        "Please register your driver profile before going online.",
        404,
        "DRIVER_NOT_REGISTERED"
      );
    }
    if (driver.status === "SUSPENDED") {
      throw new AppError("Your driver profile is suspended.", 403, "DRIVER_SUSPENDED");
    }

    const rawLat = body.currentLat ?? body.lat ?? null;
    const rawLng = body.currentLng ?? body.lng ?? null;
    if ((rawLat !== null) !== (rawLng !== null)) {
      throw new AppError("Provide both latitude and longitude.", 400, "INVALID_COORDINATES");
    }

    let nextLat = rawLat !== null ? Number(rawLat.toFixed(6)) : driver.currentLat;
    let nextLng = rawLng !== null ? Number(rawLng.toFixed(6)) : driver.currentLng;
    if ((nextLat == null || nextLng == null) && driver.locationId) {
      const staticLoc = getStaticLocationById(driver.locationId);
      if (staticLoc) {
        nextLat = staticLoc.latitude;
        nextLng = staticLoc.longitude;
      }
    }

    const now = new Date();
    const nextOnline = body.isOnline !== undefined ? body.isOnline : !driver.isOnline;

    const [updated] = await db
      .update(rideDrivers)
      .set({
        isOnline: nextOnline,
        currentLat: nextLat,
        currentLng: nextLng,
        heading: body.heading !== undefined ? body.heading : driver.heading,
        lastLocationAt: rawLat !== null || nextLat !== null ? now : driver.lastLocationAt,
        updatedAt: now,
      })
      .where(eq(rideDrivers.id, driver.id))
      .returning();

    return c.json({
      success: true,
      data: { driver: updated },
    });
  }
);

// ---------------------------------------------------------------------------
// 5. Driver Live GPS Heartbeat (POST /driver/location)
// ---------------------------------------------------------------------------
ridesRouter.post(
  "/driver/location",
  rateLimiter({ max: 90, windowMs: 60 * 1000 }),
  async (c, next) => {
    assertAllowedPlatformOrigin(c);
    await next();
  },
  zValidator("json", driverLocationSchema),
  async (c) => {
    const googleUser = await requireGoogleUser(c);
    const db = await requireRideDb(c);
    const body = c.req.valid("json");
    const userEmail = googleUser.email.toLowerCase().trim();

    const [driver] = await db
      .select()
      .from(rideDrivers)
      .where(eq(rideDrivers.userEmail, userEmail))
      .limit(1);

    if (!driver) {
      throw new AppError("Driver profile not found.", 404, "DRIVER_NOT_REGISTERED");
    }
    if (driver.status === "SUSPENDED") {
      throw new AppError("Your driver profile is suspended.", 403, "DRIVER_SUSPENDED");
    }

    const lat = Number((body.currentLat ?? body.lat)!.toFixed(6));
    const lng = Number((body.currentLng ?? body.lng)!.toFixed(6));
    const now = new Date();

    const [updatedDriver] = await db
      .update(rideDrivers)
      .set({
        currentLat: lat,
        currentLng: lng,
        heading: body.heading !== undefined ? body.heading : driver.heading,
        lastLocationAt: now,
        updatedAt: now,
      })
      .where(eq(rideDrivers.id, driver.id))
      .returning();

    const syncedRides = await db
      .update(rideRequests)
      .set({
        driverLat: lat,
        driverLng: lng,
        driverUpdatedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(rideRequests.driverId, driver.id),
          inArray(rideRequests.status, [...ACTIVE_RIDE_STATUSES])
        )
      )
      .returning({ id: rideRequests.id });

    return c.json({
      success: true,
      data: {
        driver: updatedDriver,
        syncedActiveRides: syncedRides.length,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// 6. Driver Dashboard & Open Nearby Requests (GET /driver/me)
// ---------------------------------------------------------------------------
ridesRouter.get(
  "/driver/me",
  rateLimiter({ max: 90, windowMs: 60 * 1000 }),
  async (c) => {
    const googleUser = await requireGoogleUser(c);
    const db = await requireRideDb(c);
    const userEmail = googleUser.email.toLowerCase().trim();

    const [driver] = await db
      .select()
      .from(rideDrivers)
      .where(eq(rideDrivers.userEmail, userEmail))
      .limit(1);

    if (!driver) {
      return c.json({
        success: true,
        data: {
          registered: false,
          driver: null,
          activeRide: null,
          openRequests: [],
        },
      });
    }

    const [activeRideRow] = await db
      .select()
      .from(rideRequests)
      .where(
        and(
          eq(rideRequests.driverId, driver.id),
          inArray(rideRequests.status, [...ACTIVE_RIDE_STATUSES])
        )
      )
      .orderBy(desc(rideRequests.updatedAt))
      .limit(1);

    let driverLat = driver.currentLat;
    let driverLng = driver.currentLng;
    if ((driverLat == null || driverLng == null) && driver.locationId) {
      const staticLoc = getStaticLocationById(driver.locationId);
      if (staticLoc) {
        driverLat = staticLoc.latitude;
        driverLng = staticLoc.longitude;
      }
    }

    let openRequests: Array<
      ReturnType<typeof sanitizeRide> & {
        distanceToPickupKm: number;
        etaToPickupMinutes: number;
      }
    > = [];

    if (driver.status === "ACTIVE" && driverLat != null && driverLng != null) {
      const candidates = await db
        .select()
        .from(rideRequests)
        .where(
          and(
            eq(rideRequests.status, "REQUESTED"),
            eq(rideRequests.vehicleType, driver.vehicleType),
            isNull(rideRequests.driverId)
          )
        )
        .orderBy(desc(rideRequests.createdAt))
        .limit(80);

      openRequests = candidates
        .map((req) => {
          const dist = haversineKm(driverLat!, driverLng!, req.pickupLat, req.pickupLng);
          return {
            req,
            dist,
          };
        })
        .filter((entry) => entry.dist <= DEFAULT_RADIUS_KM)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 25)
        .map(({ req, dist }) => {
          const distanceToPickupKm = Number(dist.toFixed(2));
          return {
            ...sanitizeRide(req),
            distanceToPickupKm,
            etaToPickupMinutes: computeEtaMinutes(distanceToPickupKm),
          };
        });
    }

    return c.json({
      success: true,
      data: {
        registered: true,
        driver,
        activeRide: activeRideRow ? sanitizeRide(activeRideRow) : null,
        openRequests,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// 7. Request a Ride (POST /request)
// ---------------------------------------------------------------------------
ridesRouter.post(
  "/request",
  rateLimiter({ max: 20, windowMs: 60 * 1000 }),
  async (c, next) => {
    assertAllowedPlatformOrigin(c);
    await next();
  },
  zValidator("json", createRideRequestSchema),
  async (c) => {
    const db = await requireRideDb(c);
    const body = c.req.valid("json");
    const googleUser = await readPlatformGoogleUser(c);
    const riderPhone = normalizePhoneInput(body.riderPhone);

    const pickup = await resolveRideEndpoint(
      db,
      {
        lat: body.pickupLat,
        lng: body.pickupLng,
        locationId: body.pickupLocationId,
        label: body.pickupLabel,
      },
      "Pickup Point"
    );
    if (!pickup) {
      throw new AppError(
        "Provide valid pickup coordinates or pickupLocationId.",
        400,
        "INVALID_PICKUP"
      );
    }

    const dropoff = await resolveRideEndpoint(
      db,
      {
        lat: body.dropoffLat,
        lng: body.dropoffLng,
        locationId: body.dropoffLocationId,
        label: body.dropoffLabel,
      },
      "Dropoff Point"
    );
    if (!dropoff) {
      throw new AppError(
        "Provide valid dropoff coordinates or dropoffLocationId.",
        400,
        "INVALID_DROPOFF"
      );
    }

    const { distanceKm, estimates } = calculateFareAndEstimates(
      pickup.lat,
      pickup.lng,
      dropoff.lat,
      dropoff.lng
    );
    const estimatedFareKes = estimates[body.vehicleType].fareKes;

    const trackingToken = generateSecureToken(24);
    const trackingTokenHash = await hashOtp(trackingToken);
    const now = new Date();

    const [created] = await db
      .insert(rideRequests)
      .values({
        id: `ride-${generateUUID()}`,
        riderEmail: googleUser?.email ? googleUser.email.toLowerCase().trim() : null,
        riderName: body.riderName,
        riderPhone,
        vehicleType: body.vehicleType,
        driverId: null,
        pickupLabel: pickup.label,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        pickupLocationId: pickup.locationId,
        dropoffLabel: dropoff.label,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        dropoffLocationId: dropoff.locationId,
        distanceKm,
        estimatedFareKes,
        status: "REQUESTED",
        driverLat: null,
        driverLng: null,
        driverUpdatedAt: null,
        trackingTokenHash,
        riderRating: null,
        riderReview: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json(
      {
        success: true,
        data: {
          ride: sanitizeRide(created),
          trackingToken,
          commissionKes: 0,
        },
      },
      201
    );
  }
);

// ---------------------------------------------------------------------------
// 8. Live Ride Polling (GET /:id)
// ---------------------------------------------------------------------------
ridesRouter.get(
  "/:id",
  rateLimiter({ max: 120, windowMs: 60 * 1000 }),
  async (c) => {
    const rideId = c.req.param("id");
    const db = await requireRideDb(c);

    const [ride] = await db
      .select()
      .from(rideRequests)
      .where(eq(rideRequests.id, rideId))
      .limit(1);

    if (!ride) {
      throw new AppError("Ride request not found.", 404, "RIDE_NOT_FOUND");
    }

    let driver: RideDriver | null = null;
    if (ride.driverId) {
      const [drv] = await db
        .select()
        .from(rideDrivers)
        .where(eq(rideDrivers.id, ride.driverId))
        .limit(1);
      driver = drv || null;
    }

    const rawToken = readTrackingTokenFromRequest(c);
    await authorizeRideParticipant(c, ride, driver, rawToken);

    let driverDistanceKm: number | null = null;
    let driverEtaMinutes: number | null = null;

    if (
      driver &&
      (ride.status === "ACCEPTED" ||
        ride.status === "ARRIVING" ||
        ride.status === "IN_PROGRESS")
    ) {
      const dLat = ride.driverLat ?? driver.currentLat;
      const dLng = ride.driverLng ?? driver.currentLng;
      if (dLat != null && dLng != null) {
        const targetLat = ride.status === "IN_PROGRESS" ? ride.dropoffLat : ride.pickupLat;
        const targetLng = ride.status === "IN_PROGRESS" ? ride.dropoffLng : ride.pickupLng;
        const rawDist = haversineKm(dLat, dLng, targetLat, targetLng);
        driverDistanceKm = Number(rawDist.toFixed(2));
        driverEtaMinutes = computeEtaMinutes(driverDistanceKm);
      }
    }

    return c.json({
      success: true,
      data: {
        ride: sanitizeRide(ride),
        driver: driver ? formatAssignedDriver(driver, ride) : null,
        driverDistanceKm,
        driverEtaMinutes,
        commissionKes: 0,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// 9. Ride Status Transitions (POST /:id/status)
// ---------------------------------------------------------------------------
ridesRouter.post(
  "/:id/status",
  rateLimiter({ max: 60, windowMs: 60 * 1000 }),
  async (c, next) => {
    assertAllowedPlatformOrigin(c);
    await next();
  },
  zValidator("json", rideStatusActionSchema),
  async (c) => {
    const rideId = c.req.param("id");
    const db = await requireRideDb(c);
    const body = c.req.valid("json");
    const now = new Date();

    const [ride] = await db
      .select()
      .from(rideRequests)
      .where(eq(rideRequests.id, rideId))
      .limit(1);

    if (!ride) {
      throw new AppError("Ride request not found.", 404, "RIDE_NOT_FOUND");
    }

    if (body.action === "CANCEL") {
      if (ride.status === "COMPLETED" || ride.status === "CANCELLED") {
        throw new AppError(
          `Cannot cancel a ride that is already ${ride.status}.`,
          400,
          "INVALID_STATE_TRANSITION"
        );
      }

      let assignedDriver: RideDriver | null = null;
      if (ride.driverId) {
        const [drv] = await db
          .select()
          .from(rideDrivers)
          .where(eq(rideDrivers.id, ride.driverId))
          .limit(1);
        assignedDriver = drv || null;
      }

      const rawToken = readTrackingTokenFromRequest(c, body.trackingToken);
      await authorizeRideParticipant(c, ride, assignedDriver, rawToken);

      const [updatedRide] = await db
        .update(rideRequests)
        .set({ status: "CANCELLED", updatedAt: now })
        .where(
          and(
            eq(rideRequests.id, rideId),
            inArray(rideRequests.status, ["REQUESTED", "ACCEPTED", "ARRIVING", "IN_PROGRESS"])
          )
        )
        .returning();

      if (!updatedRide) {
        throw new AppError("Ride can no longer be cancelled.", 409, "INVALID_STATE_TRANSITION");
      }

      let updatedDriver: RideDriver | null = assignedDriver;
      if (assignedDriver) {
        const [drv] = await db
          .update(rideDrivers)
          .set({ isBusy: false, updatedAt: now })
          .where(eq(rideDrivers.id, assignedDriver.id))
          .returning();
        updatedDriver = drv || assignedDriver;
      }

      return c.json({
        success: true,
        data: {
          ride: sanitizeRide(updatedRide),
          driver: updatedDriver ? formatAssignedDriver(updatedDriver, updatedRide) : null,
          commissionKes: 0,
        },
      });
    }

    // Driver-only actions: ACCEPT | ARRIVING | START | COMPLETE
    const googleUser = await requireGoogleUser(c);
    const driverEmail = googleUser.email.toLowerCase().trim();
    const [driver] = await db
      .select()
      .from(rideDrivers)
      .where(eq(rideDrivers.userEmail, driverEmail))
      .limit(1);

    if (!driver) {
      throw new AppError(
        "Only registered drivers can update ride progress.",
        403,
        "DRIVER_NOT_REGISTERED"
      );
    }
    if (driver.status === "SUSPENDED") {
      throw new AppError("Your driver profile is suspended.", 403, "DRIVER_SUSPENDED");
    }

    if (body.action === "ACCEPT") {
      if (driver.vehicleType !== ride.vehicleType) {
        throw new AppError(
          `This ride requested a ${ride.vehicleType}.`,
          403,
          "VEHICLE_TYPE_MISMATCH"
        );
      }
      if (driver.isBusy) {
        throw new AppError(
          "Finish your active ride before accepting another request.",
          409,
          "DRIVER_BUSY"
        );
      }
      if (ride.status !== "REQUESTED" || ride.driverId !== null) {
        throw new AppError(
          "This ride request has already been claimed or closed.",
          409,
          "RIDE_UNAVAILABLE"
        );
      }

      const [updatedRide] = await db
        .update(rideRequests)
        .set({
          status: "ACCEPTED",
          driverId: driver.id,
          driverLat: driver.currentLat,
          driverLng: driver.currentLng,
          driverUpdatedAt: driver.currentLat != null ? now : null,
          updatedAt: now,
        })
        .where(
          and(
            eq(rideRequests.id, rideId),
            eq(rideRequests.status, "REQUESTED"),
            isNull(rideRequests.driverId)
          )
        )
        .returning();

      if (!updatedRide) {
        throw new AppError(
          "This ride request has already been claimed or closed.",
          409,
          "RIDE_UNAVAILABLE"
        );
      }

      const [updatedDriver] = await db
        .update(rideDrivers)
        .set({ isBusy: true, updatedAt: now })
        .where(eq(rideDrivers.id, driver.id))
        .returning();

      return c.json({
        success: true,
        data: {
          ride: sanitizeRide(updatedRide),
          driver: formatAssignedDriver(updatedDriver || driver, updatedRide),
          commissionKes: 0,
        },
      });
    }

    // ARRIVING | START | COMPLETE require this driver to be assigned to the ride
    if (ride.driverId !== driver.id) {
      throw new AppError("You are not assigned to this ride.", 403, "FORBIDDEN");
    }

    if (body.action === "ARRIVING") {
      if (ride.status !== "ACCEPTED") {
        throw new AppError(
          `Cannot mark ARRIVING from status ${ride.status}.`,
          400,
          "INVALID_STATE_TRANSITION"
        );
      }
      const [updatedRide] = await db
        .update(rideRequests)
        .set({
          status: "ARRIVING",
          driverLat: driver.currentLat ?? ride.driverLat,
          driverLng: driver.currentLng ?? ride.driverLng,
          driverUpdatedAt: driver.currentLat != null ? now : ride.driverUpdatedAt,
          updatedAt: now,
        })
        .where(and(eq(rideRequests.id, rideId), eq(rideRequests.driverId, driver.id)))
        .returning();

      return c.json({
        success: true,
        data: {
          ride: sanitizeRide(updatedRide),
          driver: formatAssignedDriver(driver, updatedRide),
          commissionKes: 0,
        },
      });
    }

    if (body.action === "START") {
      if (ride.status !== "ACCEPTED" && ride.status !== "ARRIVING") {
        throw new AppError(
          `Cannot start ride from status ${ride.status}.`,
          400,
          "INVALID_STATE_TRANSITION"
        );
      }
      const [updatedRide] = await db
        .update(rideRequests)
        .set({
          status: "IN_PROGRESS",
          driverLat: driver.currentLat ?? ride.driverLat,
          driverLng: driver.currentLng ?? ride.driverLng,
          driverUpdatedAt: driver.currentLat != null ? now : ride.driverUpdatedAt,
          updatedAt: now,
        })
        .where(and(eq(rideRequests.id, rideId), eq(rideRequests.driverId, driver.id)))
        .returning();

      return c.json({
        success: true,
        data: {
          ride: sanitizeRide(updatedRide),
          driver: formatAssignedDriver(driver, updatedRide),
          commissionKes: 0,
        },
      });
    }

    // COMPLETE
    if (
      ride.status !== "ACCEPTED" &&
      ride.status !== "ARRIVING" &&
      ride.status !== "IN_PROGRESS"
    ) {
      throw new AppError(
        `Cannot complete ride from status ${ride.status}.`,
        400,
        "INVALID_STATE_TRANSITION"
      );
    }

    const [updatedRide] = await db
      .update(rideRequests)
      .set({
        status: "COMPLETED",
        updatedAt: now,
      })
      .where(
        and(
          eq(rideRequests.id, rideId),
          eq(rideRequests.driverId, driver.id),
          inArray(rideRequests.status, [...ACTIVE_RIDE_STATUSES])
        )
      )
      .returning();

    if (!updatedRide) {
      throw new AppError("Ride could not be completed.", 409, "INVALID_STATE_TRANSITION");
    }

    const [updatedDriver] = await db
      .update(rideDrivers)
      .set({
        isBusy: false,
        completedRides: sql`${rideDrivers.completedRides} + 1`,
        updatedAt: now,
      })
      .where(eq(rideDrivers.id, driver.id))
      .returning();

    return c.json({
      success: true,
      data: {
        ride: sanitizeRide(updatedRide),
        driver: formatAssignedDriver(updatedDriver || driver, updatedRide),
        commissionKes: 0,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// 10. Rate Completed Ride (POST /:id/rate)
// ---------------------------------------------------------------------------
ridesRouter.post(
  "/:id/rate",
  rateLimiter({ max: 20, windowMs: 60 * 1000 }),
  async (c, next) => {
    assertAllowedPlatformOrigin(c);
    await next();
  },
  zValidator("json", rateRideSchema),
  async (c) => {
    const rideId = c.req.param("id");
    const db = await requireRideDb(c);
    const body = c.req.valid("json");
    const ratingScore = (body.rating ?? body.score)!;
    const now = new Date();

    const [ride] = await db
      .select()
      .from(rideRequests)
      .where(eq(rideRequests.id, rideId))
      .limit(1);

    if (!ride) {
      throw new AppError("Ride request not found.", 404, "RIDE_NOT_FOUND");
    }

    const rawToken = readTrackingTokenFromRequest(c, body.trackingToken);
    let matchesToken = false;
    if (rawToken && ride.trackingTokenHash) {
      const providedHash = await hashOtp(rawToken);
      matchesToken = timingSafeEqual(providedHash, ride.trackingTokenHash);
    }

    const googleUser = await readPlatformGoogleUser(c);
    const matchesRiderEmail = Boolean(
      googleUser?.email &&
        ride.riderEmail &&
        ride.riderEmail.toLowerCase().trim() === googleUser.email.toLowerCase().trim()
    );

    if (!matchesToken && !matchesRiderEmail) {
      if (!rawToken && !googleUser) {
        throw new AppError(
          "Tracking token or Google sign-in is required to rate this ride.",
          401,
          "UNAUTHORIZED"
        );
      }
      throw new AppError("Only the rider can rate this trip.", 403, "FORBIDDEN");
    }

    if (ride.status !== "COMPLETED") {
      throw new AppError(
        "You can only rate a completed ride.",
        400,
        "RIDE_NOT_COMPLETED"
      );
    }

    if (ride.riderRating !== null) {
      throw new AppError(
        "This ride has already been rated.",
        409,
        "ALREADY_RATED"
      );
    }

    if (!ride.driverId) {
      throw new AppError("No driver is assigned to this ride.", 400, "NO_DRIVER_ASSIGNED");
    }

    const [updatedRide] = await db
      .update(rideRequests)
      .set({
        riderRating: ratingScore,
        riderReview: body.review?.trim() || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(rideRequests.id, rideId),
          eq(rideRequests.status, "COMPLETED"),
          isNull(rideRequests.riderRating)
        )
      )
      .returning();

    if (!updatedRide) {
      throw new AppError("This ride has already been rated.", 409, "ALREADY_RATED");
    }

    const [driver] = await db
      .select()
      .from(rideDrivers)
      .where(eq(rideDrivers.id, ride.driverId))
      .limit(1);

    let updatedDriver: RideDriver | null = driver || null;
    if (driver) {
      const newCount = driver.ratingCount + 1;
      const newAvg = Number(
        ((driver.ratingAvg * driver.ratingCount + ratingScore) / newCount).toFixed(2)
      );
      const [drv] = await db
        .update(rideDrivers)
        .set({
          ratingAvg: newAvg,
          ratingCount: newCount,
          updatedAt: now,
        })
        .where(eq(rideDrivers.id, driver.id))
        .returning();
      updatedDriver = drv || driver;
    }

    return c.json({
      success: true,
      data: {
        ride: sanitizeRide(updatedRide),
        driver: updatedDriver
          ? {
              id: updatedDriver.id,
              ratingAvg: updatedDriver.ratingAvg,
              ratingCount: updatedDriver.ratingCount,
            }
          : null,
      },
    });
  }
);
