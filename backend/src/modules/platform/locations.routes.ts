import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import {
  kenyaCounties,
  kenyaConstituencies,
  kenyaLocations,
  kenyaLocationNeighbors,
} from "../../db/schema";
import {
  autocompleteGooglePlacesKenya,
  getCountyAndConstituency,
  getNearestNeighborsForLocation,
  LocationResolutionError,
  resolveOrCreateStoreLocation,
} from "./locations.service";

export const locationsRouter = new Hono<AppEnv>();

const googleAutocompleteSchema = z.object({
  query: z.string().trim().min(2, "Enter at least 2 characters").max(120),
  countyId: z.string().optional(),
  constituencyId: z.string().optional(),
  sessionToken: z.string().max(128).optional(),
});

const resolveLocationSchema = z
  .object({
    countyId: z.string().min(1, "County is required"),
    constituencyId: z.string().optional(),
    locationId: z.string().optional(),
    googlePlaceId: z.string().optional(),
    customLocationName: z.string().trim().min(2).max(80).optional(),
  })
  .refine(
    (v) => Boolean(v.locationId || v.googlePlaceId || v.customLocationName),
    {
      message:
        "Select a town/shopping centre, choose a Google Maps result, or enter a centre name",
    }
  );

/**
 * GET /api/platform/locations/counties
 * Lists all 47 Kenyan counties sorted alphabetically.
 */
locationsRouter.get("/counties", async (c) => {
  const db = createDb(c.env.DB);
  const counties = await db
    .select({
      id: kenyaCounties.id,
      code: kenyaCounties.code,
      name: kenyaCounties.name,
      slug: kenyaCounties.slug,
      centroidLat: kenyaCounties.centroidLat,
      centroidLng: kenyaCounties.centroidLng,
    })
    .from(kenyaCounties)
    .orderBy(asc(kenyaCounties.name));

  return c.json({ counties });
});

/**
 * GET /api/platform/locations/constituencies?countyId=...
 * Lists constituencies (filtered by countyId when provided).
 */
locationsRouter.get("/constituencies", async (c) => {
  const countyId = c.req.query("countyId")?.trim();
  const db = createDb(c.env.DB);

  const query = db
    .select({
      id: kenyaConstituencies.id,
      code: kenyaConstituencies.code,
      countyId: kenyaConstituencies.countyId,
      name: kenyaConstituencies.name,
      slug: kenyaConstituencies.slug,
      centroidLat: kenyaConstituencies.centroidLat,
      centroidLng: kenyaConstituencies.centroidLng,
    })
    .from(kenyaConstituencies);

  const constituencies = countyId
    ? await query
        .where(eq(kenyaConstituencies.countyId, countyId))
        .orderBy(asc(kenyaConstituencies.name))
    : await query.orderBy(asc(kenyaConstituencies.name));

  return c.json({ constituencies });
});

/**
 * GET /api/platform/locations/towns?countyId=...&constituencyId=...&q=...&limit=...
 * Lists towns, estates, markets & shopping centres inside a constituency or county.
 */
locationsRouter.get("/towns", async (c) => {
  const countyId = c.req.query("countyId")?.trim();
  const constituencyId = c.req.query("constituencyId")?.trim();
  const qRaw = c.req.query("q")?.trim() || "";
  const qClean = qRaw.replace(/[%_]/g, "");
  const rawLimit = Number(c.req.query("limit") || 40);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 1000)
    : 40;

  const db = createDb(c.env.DB);
  const conditions = [];
  if (countyId) conditions.push(eq(kenyaLocations.countyId, countyId));
  if (constituencyId) conditions.push(eq(kenyaLocations.constituencyId, constituencyId));
  if (qClean.length >= 1) {
    conditions.push(like(kenyaLocations.name, `%${qClean}%`));
  }

  const base = db
    .select({
      id: kenyaLocations.id,
      countyId: kenyaLocations.countyId,
      countyName: kenyaCounties.name,
      constituencyId: kenyaLocations.constituencyId,
      constituencyName: kenyaConstituencies.name,
      name: kenyaLocations.name,
      slug: kenyaLocations.slug,
      kind: kenyaLocations.kind,
      latitude: kenyaLocations.latitude,
      longitude: kenyaLocations.longitude,
      source: kenyaLocations.source,
      population: kenyaLocations.population,
    })
    .from(kenyaLocations)
    .innerJoin(kenyaCounties, eq(kenyaLocations.countyId, kenyaCounties.id))
    .innerJoin(
      kenyaConstituencies,
      eq(kenyaLocations.constituencyId, kenyaConstituencies.id)
    );

  const filtered = conditions.length > 0 ? base.where(and(...conditions)) : base;
  const orderClauses = [];
  if (qClean.length >= 1) {
    const prefix = `${qClean.toLowerCase()}%`;
    orderClauses.push(
      sql`CASE WHEN lower(${kenyaLocations.name}) LIKE ${prefix} THEN 0 ELSE 1 END`
    );
  }
  orderClauses.push(desc(kenyaLocations.population), asc(kenyaLocations.name));

  const locations = await filtered.orderBy(...orderClauses).limit(limit);

  return c.json({ locations });
});

/**
 * GET /api/platform/locations/towns/:id/nearby?limit=8
 * Returns smart connected neighboring towns/centres ordered by Haversine distance.
 */
locationsRouter.get("/towns/:id/nearby", async (c) => {
  const locationId = c.req.param("id");
  const rawLimit = Number(c.req.query("limit") || 8);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 24)
    : 8;

  const db = createDb(c.env.DB);
  const [location] = await db
    .select({
      id: kenyaLocations.id,
      name: kenyaLocations.name,
      kind: kenyaLocations.kind,
      countyId: kenyaLocations.countyId,
      countyName: kenyaCounties.name,
      constituencyId: kenyaLocations.constituencyId,
      constituencyName: kenyaConstituencies.name,
      latitude: kenyaLocations.latitude,
      longitude: kenyaLocations.longitude,
    })
    .from(kenyaLocations)
    .innerJoin(kenyaCounties, eq(kenyaLocations.countyId, kenyaCounties.id))
    .innerJoin(
      kenyaConstituencies,
      eq(kenyaLocations.constituencyId, kenyaConstituencies.id)
    )
    .where(eq(kenyaLocations.id, locationId))
    .limit(1);

  if (!location) {
    return c.json({ error: "Location not found" }, 404);
  }

  const neighbors = await getNearestNeighborsForLocation(db, location.id, limit);
  return c.json({ location, neighbors });
});

/**
 * GET /api/platform/locations/google-status
 * Indicates whether live Google Maps Places lookup is configured.
 */
locationsRouter.get("/google-status", (c) => {
  const configured = Boolean(c.env?.GOOGLE_MAPS_API_KEY?.trim());
  return c.json({ googleMapsConfigured: configured });
});

/**
 * POST /api/platform/locations/google-autocomplete
 * Proxies Kenyan place/shopping-centre autocomplete via Places API (New).
 */
locationsRouter.post(
  "/google-autocomplete",
  zValidator("json", googleAutocompleteSchema),
  async (c) => {
    const apiKey = c.env?.GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) {
      return c.json(
        {
          error:
            "Google Maps API key is not configured on the server. Choose from the pre-loaded towns or enter your shopping centre name.",
          configured: false,
        },
        503
      );
    }

    const body = c.req.valid("json");
    const db = createDb(c.env.DB);

    let biasLat: number | undefined;
    let biasLng: number | undefined;
    let searchInput = body.query;

    if (body.countyId && body.constituencyId) {
      const pair = await getCountyAndConstituency(db, body.countyId, body.constituencyId);
      if (pair) {
        biasLat = pair.constituency.centroidLat;
        biasLng = pair.constituency.centroidLng;
        if (!searchInput.toLowerCase().includes(pair.county.name.toLowerCase())) {
          searchInput = `${searchInput}, ${pair.constituency.name}, ${pair.county.name}`;
        }
      }
    } else if (body.countyId) {
      const [county] = await db
        .select()
        .from(kenyaCounties)
        .where(eq(kenyaCounties.id, body.countyId))
        .limit(1);
      if (county) {
        biasLat = county.centroidLat;
        biasLng = county.centroidLng;
      }
    }

    try {
      const suggestions = await autocompleteGooglePlacesKenya(apiKey, {
        input: searchInput,
        biasLat,
        biasLng,
        sessionToken: body.sessionToken,
      });
      return c.json({ suggestions });
    } catch (err) {
      if (err instanceof LocationResolutionError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "Unable to query Google Maps Places" }, 502);
    }
  }
);

/**
 * POST /api/platform/locations/resolve-location
 * Resolves a location selection (DB ID, Google Place ID, or custom centre) and returns its neighbor graph.
 */
locationsRouter.post(
  "/resolve-location",
  zValidator("json", resolveLocationSchema),
  async (c) => {
    const body = c.req.valid("json");
    const db = createDb(c.env.DB);

    try {
      const resolved = await resolveOrCreateStoreLocation(db, c.env, body);
      const neighbors = await getNearestNeighborsForLocation(
        db,
        resolved.location.id,
        8
      );
      return c.json({
        county: {
          id: resolved.county.id,
          name: resolved.county.name,
        },
        constituency: {
          id: resolved.constituency.id,
          name: resolved.constituency.name,
        },
        location: resolved.location,
        locationLabel: resolved.locationLabel,
        neighbors,
      });
    } catch (err) {
      if (err instanceof LocationResolutionError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "Failed to resolve location" }, 500);
    }
  }
);

/**
 * GET /api/platform/locations/stats
 * Lightweight summary count for verification/health checks.
 */
locationsRouter.get("/stats", async (c) => {
  const db = createDb(c.env.DB);
  const [[counties], [constituencies], [locations], [neighbors], kindRows] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(kenyaCounties),
      db.select({ count: sql<number>`count(*)` }).from(kenyaConstituencies),
      db.select({ count: sql<number>`count(*)` }).from(kenyaLocations),
      db.select({ count: sql<number>`count(*)` }).from(kenyaLocationNeighbors),
      db
        .select({
          kind: kenyaLocations.kind,
          count: sql<number>`count(*)`,
        })
        .from(kenyaLocations)
        .groupBy(kenyaLocations.kind),
    ]);

  const byKind: Record<string, number> = {};
  for (const row of kindRows) {
    byKind[row.kind] = Number(row.count ?? 0);
  }

  return c.json({
    counties: Number(counties?.count ?? 0),
    constituencies: Number(constituencies?.count ?? 0),
    locations: Number(locations?.count ?? 0),
    neighbors: Number(neighbors?.count ?? 0),
    byKind,
  });
});
