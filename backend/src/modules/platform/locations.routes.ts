import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import {
  autocompleteGooglePlacesKenya,
  formatLocationLabel,
  getNearestNeighborsForLocation,
  LocationResolutionError,
  resolveOrCreateStoreLocation,
} from "./locations.service";
import {
  findStaticNearestLocation,
  findStaticNeighborsForLocation,
  getStaticConstituencies,
  getStaticCounties,
  getStaticCountyById,
  getStaticLocationById,
  searchStaticTowns,
} from "./kenya-static-data";

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
 * Lists all 47 Kenyan counties sorted alphabetically (served from zero-latency static memory).
 */
locationsRouter.get("/counties", (c) => {
  const counties = [...getStaticCounties()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  return c.json({ counties });
});

/**
 * GET /api/platform/locations/nearest?lat=...&lng=...
 * Resolves GPS coordinates (or Cloudflare edge coordinates as fallback) to the closest Kenyan centre.
 */
locationsRouter.get("/nearest", (c) => {
  const rawLat = c.req.query("lat");
  const rawLng = c.req.query("lng");
  const cf = (
    c.req.raw as Request & {
      cf?: { latitude?: string | number; longitude?: string | number; city?: string };
    }
  ).cf;

  let lat = rawLat !== undefined && rawLat !== "" ? Number(rawLat) : NaN;
  let lng = rawLng !== undefined && rawLng !== "" ? Number(rawLng) : NaN;
  let source: "gps" | "network" = "gps";

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const rawCfLat = cf?.latitude ?? c.req.header("x-cf-latitude");
    const rawCfLng = cf?.longitude ?? c.req.header("x-cf-longitude");
    const cfLat = rawCfLat !== undefined && rawCfLat !== "" ? Number(rawCfLat) : NaN;
    const cfLng = rawCfLng !== undefined && rawCfLng !== "" ? Number(rawCfLng) : NaN;
    if (Number.isFinite(cfLat) && Number.isFinite(cfLng)) {
      lat = cfLat;
      lng = cfLng;
      source = "network";
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return c.json(
      { error: "Location coordinates are unavailable. Please select your County below." },
      400
    );
  }

  const nearest = findStaticNearestLocation(lat, lng);
  if (!nearest) {
    return c.json({ error: "No matching Kenyan location found" }, 404);
  }

  return c.json({
    source,
    coordinates: { latitude: lat, longitude: lng },
    location: nearest,
  });
});

/**
 * GET /api/platform/locations/constituencies?countyId=county-047
 * Lists constituencies (optionally filtered by countyId) sorted alphabetically.
 */
locationsRouter.get("/constituencies", (c) => {
  const countyId = c.req.query("countyId")?.trim();
  if (countyId) {
    const county = getStaticCountyById(countyId);
    if (!county) {
      return c.json({ error: "County not found" }, 404);
    }
    const constituencies = [...getStaticConstituencies(countyId)].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    return c.json({ county, constituencies });
  }

  const constituencies = [...getStaticConstituencies()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  return c.json({ constituencies });
});

/**
 * GET /api/platform/locations/towns?countyId=...&constituencyId=...&q=...&limit=...
 * Searches Kenyan towns, shopping centres, estates, and trading centres.
 */
locationsRouter.get("/towns", (c) => {
  const countyId = c.req.query("countyId")?.trim() || undefined;
  const constituencyId = c.req.query("constituencyId")?.trim() || undefined;
  const q = c.req.query("q")?.trim() || "";
  const kindFilter = c.req.query("kind")?.trim() || "";
  const rawLimit = Number(c.req.query("limit") || 50);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100)
    : 50;

  let locations = searchStaticTowns({
    countyId,
    constituencyId,
    q,
    limit: kindFilter ? Math.min(limit * 3, 100) : limit,
  });

  if (kindFilter) {
    locations = locations.filter((l) => l.kind === kindFilter).slice(0, limit);
  }

  return c.json({ locations });
});

/**
 * GET /api/platform/locations/towns/:id/nearby
 * Returns a specific Kenyan location and its closest neighboring centres for ripple discovery.
 */
locationsRouter.get("/towns/:id/nearby", (c) => {
  const locationId = c.req.param("id");
  const rawLimit = Number(c.req.query("limit") || 8);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 24)
    : 8;

  const location = getStaticLocationById(locationId);
  if (!location) {
    return c.json({ error: "Location not found" }, 404);
  }

  const neighbors = findStaticNeighborsForLocation(location.id, limit);
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

    let biasLat: number | undefined;
    let biasLng: number | undefined;
    let searchInput = body.query;

    if (body.countyId && body.constituencyId) {
      const county = getStaticCountyById(body.countyId);
      const constituency = getStaticConstituencies(body.countyId).find(
        (cs) => cs.id === body.constituencyId
      );
      if (county && constituency) {
        biasLat = constituency.centroidLat;
        biasLng = constituency.centroidLng;
        if (!searchInput.toLowerCase().includes(county.name.toLowerCase())) {
          searchInput = `${searchInput}, ${constituency.name}, ${county.name}`;
        }
      }
    } else if (body.countyId) {
      const county = getStaticCountyById(body.countyId);
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

    if (body.locationId) {
      const staticLoc = getStaticLocationById(body.locationId);
      if (staticLoc) {
        const neighbors = findStaticNeighborsForLocation(staticLoc.id, 8);
        return c.json({
          county: {
            id: staticLoc.countyId,
            name: staticLoc.countyName,
          },
          constituency: {
            id: staticLoc.constituencyId,
            name: staticLoc.constituencyName,
          },
          location: staticLoc,
          locationLabel: formatLocationLabel(
            staticLoc.name,
            staticLoc.constituencyName,
            staticLoc.countyName
          ),
          neighbors,
        });
      }
    }

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
locationsRouter.get("/stats", (c) => {
  return c.json({
    counties: getStaticCounties().length,
    constituencies: getStaticConstituencies().length,
    locations: 22794,
    neighbors: 182352,
    byKind: {
      TRADING_CENTRE: 18829,
      TOWN: 1689,
      ESTATE: 1218,
      SHOPPING_CENTRE: 1058,
    },
  });
});
