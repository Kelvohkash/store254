import { and, asc, between, eq, ne, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import {
  kenyaCounties,
  kenyaConstituencies,
  kenyaLocations,
  kenyaLocationNeighbors,
  type KenyaCounty,
  type KenyaConstituency,
  type KenyaLocation,
} from "../../db/schema";
import type { Env } from "../../config/env";
import { generateUUID } from "../../security/crypto";

export const GOOGLE_MAPS_SOLUTION_ID = "gmp_git_agentskills_v1";
const PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACES_DETAILS_BASE_URL = "https://places.googleapis.com/v1/places";
const TOP_NEIGHBORS_LIMIT = 8;

type AppDb = DrizzleD1Database<typeof schema>;

export interface ResolvedStoreLocation {
  county: KenyaCounty;
  constituency: KenyaConstituency;
  location: KenyaLocation;
  locationLabel: string;
}

export class LocationResolutionError extends Error {
  status: 400 | 404 | 502 | 503;

  constructor(message: string, status: 400 | 404 | 502 | 503 = 400) {
    super(message);
    this.status = status;
  }
}

export function slugifyLocation(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371.0088;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatLocationLabel(
  locationName: string,
  constituencyName: string,
  countyName: string
): string {
  return `${locationName}, ${constituencyName}, ${countyName}`;
}

export async function getCountyAndConstituency(
  db: AppDb,
  countyId: string,
  constituencyId: string
): Promise<{ county: KenyaCounty; constituency: KenyaConstituency } | null> {
  const [county] = await db
    .select()
    .from(kenyaCounties)
    .where(eq(kenyaCounties.id, countyId))
    .limit(1);

  if (!county) return null;

  const [constituency] = await db
    .select()
    .from(kenyaConstituencies)
    .where(
      and(
        eq(kenyaConstituencies.id, constituencyId),
        eq(kenyaConstituencies.countyId, county.id)
      )
    )
    .limit(1);

  if (!constituency) return null;

  return { county, constituency };
}

export async function getNearestNeighborsForLocation(
  db: AppDb,
  locationId: string,
  limit: number = TOP_NEIGHBORS_LIMIT
) {
  const safeLimit = Math.min(Math.max(limit, 1), 24);
  return db
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
      distanceKm: kenyaLocationNeighbors.distanceKm,
      rank: kenyaLocationNeighbors.rank,
    })
    .from(kenyaLocationNeighbors)
    .innerJoin(
      kenyaLocations,
      eq(kenyaLocationNeighbors.neighborLocationId, kenyaLocations.id)
    )
    .innerJoin(
      kenyaConstituencies,
      eq(kenyaLocations.constituencyId, kenyaConstituencies.id)
    )
    .innerJoin(kenyaCounties, eq(kenyaLocations.countyId, kenyaCounties.id))
    .where(eq(kenyaLocationNeighbors.locationId, locationId))
    .orderBy(asc(kenyaLocationNeighbors.rank), asc(kenyaLocationNeighbors.distanceKm))
    .limit(safeLimit);
}

/**
 * Computes and stores the closest neighboring towns/centres for a newly created location,
 * plus reverse edges so existing towns become aware of the new shopping centre.
 */
export async function linkNeighborsForNewLocation(
  db: AppDb,
  location: KenyaLocation
): Promise<void> {
  // First query within ~45 km bounding box to avoid scanning all 20,000+ rows;
  // fall back to full table only in sparse frontier areas with < TOP_NEIGHBORS_LIMIT hits.
  let candidates = await db
    .select({
      id: kenyaLocations.id,
      latitude: kenyaLocations.latitude,
      longitude: kenyaLocations.longitude,
    })
    .from(kenyaLocations)
    .where(
      and(
        ne(kenyaLocations.id, location.id),
        between(kenyaLocations.latitude, location.latitude - 0.45, location.latitude + 0.45),
        between(kenyaLocations.longitude, location.longitude - 0.45, location.longitude + 0.45)
      )
    );

  if (candidates.length < TOP_NEIGHBORS_LIMIT) {
    candidates = await db
      .select({
        id: kenyaLocations.id,
        latitude: kenyaLocations.latitude,
        longitude: kenyaLocations.longitude,
      })
      .from(kenyaLocations)
      .where(ne(kenyaLocations.id, location.id));
  }

  if (candidates.length === 0) return;

  const ranked = candidates
    .map((candidate) => ({
      id: candidate.id,
      distanceKm: Number(
        haversineKm(
          location.latitude,
          location.longitude,
          candidate.latitude,
          candidate.longitude
        ).toFixed(2)
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, TOP_NEIGHBORS_LIMIT);

  if (ranked.length === 0) return;

  const outgoingRows = ranked.map((nbr, idx) => ({
    locationId: location.id,
    neighborLocationId: nbr.id,
    distanceKm: nbr.distanceKm,
    rank: idx + 1,
  }));

  await db
    .insert(kenyaLocationNeighbors)
    .values(outgoingRows)
    .onConflictDoNothing();

  const incomingRows = ranked.slice(0, 4).map((nbr) => ({
    locationId: nbr.id,
    neighborLocationId: location.id,
    distanceKm: nbr.distanceKm,
    rank: TOP_NEIGHBORS_LIMIT + 1,
  }));

  await db
    .insert(kenyaLocationNeighbors)
    .values(incomingRows)
    .onConflictDoNothing();
}

export async function autocompleteGooglePlacesKenya(
  apiKey: string,
  params: {
    input: string;
    biasLat?: number;
    biasLng?: number;
    sessionToken?: string;
  }
) {
  const body: Record<string, unknown> = {
    input: params.input,
    includedRegionCodes: ["ke"],
  };

  if (typeof params.biasLat === "number" && typeof params.biasLng === "number") {
    body.locationBias = {
      circle: {
        center: { latitude: params.biasLat, longitude: params.biasLng },
        radius: 25000,
      },
    };
  }

  if (params.sessionToken) {
    body.sessionToken = params.sessionToken;
  }

  const resp = await fetch(PLACES_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-Maps-Solution-ID": GOOGLE_MAPS_SOLUTION_ID,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new LocationResolutionError(
      `Google Places autocomplete failed (${resp.status})${errText ? `: ${errText.slice(0, 160)}` : ""}`,
      502
    );
  }

  const data = (await resp.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }>;
  };

  return (data.suggestions || [])
    .map((item) => item.placePrediction)
    .filter((pred): pred is NonNullable<typeof pred> & { placeId: string } => Boolean(pred?.placeId))
    .map((pred) => ({
      placeId: pred.placeId,
      mainText: pred.structuredFormat?.mainText?.text || pred.text?.text || "",
      secondaryText: pred.structuredFormat?.secondaryText?.text || "",
      fullText: pred.text?.text || "",
    }));
}

export async function fetchGooglePlaceDetails(apiKey: string, placeId: string) {
  const cleanPlaceId = placeId.replace(/^places\//, "").trim();
  if (!cleanPlaceId || !/^[A-Za-z0-9_-]{8,160}$/.test(cleanPlaceId)) {
    throw new LocationResolutionError("Invalid Google Place ID format", 400);
  }

  const resp = await fetch(`${PLACES_DETAILS_BASE_URL}/${encodeURIComponent(cleanPlaceId)}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-Maps-Solution-ID": GOOGLE_MAPS_SOLUTION_ID,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
    },
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new LocationResolutionError(
      `Google Place lookup failed (${resp.status})${errText ? `: ${errText.slice(0, 160)}` : ""}`,
      502
    );
  }

  const data = (await resp.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
  };

  const name = data.displayName?.text?.trim();
  const latitude = data.location?.latitude;
  const longitude = data.location?.longitude;

  if (!name || typeof latitude !== "number" || typeof longitude !== "number") {
    throw new LocationResolutionError(
      "Selected Google Maps place does not contain valid coordinates",
      400
    );
  }

  // Ensure coordinates sit inside Kenya's bounding envelope
  if (latitude < -5.2 || latitude > 5.6 || longitude < 33.5 || longitude > 42.2) {
    throw new LocationResolutionError(
      "Selected location appears to be outside Kenya",
      400
    );
  }

  return {
    placeId: data.id || cleanPlaceId,
    name,
    formattedAddress: data.formattedAddress || "",
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  };
}

export async function findClosestConstituencyInCounty(
  db: AppDb,
  countyId: string,
  latitude: number,
  longitude: number
): Promise<KenyaConstituency | null> {
  const rows = await db
    .select()
    .from(kenyaConstituencies)
    .where(eq(kenyaConstituencies.countyId, countyId));

  if (rows.length === 0) return null;

  let best = rows[0];
  let bestDist = haversineKm(latitude, longitude, best.centroidLat, best.centroidLng);
  for (let i = 1; i < rows.length; i += 1) {
    const candidate = rows[i];
    const dist = haversineKm(latitude, longitude, candidate.centroidLat, candidate.centroidLng);
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

export async function resolveOrCreateStoreLocation(
  db: AppDb,
  env: Env,
  input: {
    countyId: string;
    constituencyId?: string;
    locationId?: string;
    googlePlaceId?: string;
    customLocationName?: string;
  }
): Promise<ResolvedStoreLocation> {
  const [county] = await db
    .select()
    .from(kenyaCounties)
    .where(eq(kenyaCounties.id, input.countyId))
    .limit(1);

  if (!county) {
    throw new LocationResolutionError("Selected county is invalid", 400);
  }

  let explicitConstituency: KenyaConstituency | null = null;
  if (input.constituencyId) {
    const [matchedConst] = await db
      .select()
      .from(kenyaConstituencies)
      .where(
        and(
          eq(kenyaConstituencies.id, input.constituencyId),
          eq(kenyaConstituencies.countyId, county.id)
        )
      )
      .limit(1);

    if (!matchedConst) {
      throw new LocationResolutionError(
        "Selected constituency does not belong to the chosen county",
        400
      );
    }
    explicitConstituency = matchedConst;
  }

  // 1. Existing pre-seeded or previously resolved location (auto-resolves linked constituency)
  if (input.locationId) {
    const conditions = [
      eq(kenyaLocations.id, input.locationId),
      eq(kenyaLocations.countyId, county.id),
    ];
    if (explicitConstituency) {
      conditions.push(eq(kenyaLocations.constituencyId, explicitConstituency.id));
    }

    const [existing] = await db
      .select()
      .from(kenyaLocations)
      .where(and(...conditions))
      .limit(1);

    if (!existing) {
      throw new LocationResolutionError(
        "Selected town or shopping centre does not belong to the chosen county",
        400
      );
    }

    const linkedConst =
      explicitConstituency ||
      (
        await db
          .select()
          .from(kenyaConstituencies)
          .where(eq(kenyaConstituencies.id, existing.constituencyId))
          .limit(1)
      )[0];

    if (!linkedConst) {
      throw new LocationResolutionError("Linked constituency not found for location", 404);
    }

    return {
      county,
      constituency: linkedConst,
      location: existing,
      locationLabel: formatLocationLabel(existing.name, linkedConst.name, county.name),
    };
  }

  // 2. Live Google Maps Place selection (auto-links nearest constituency in county when omitted)
  if (input.googlePlaceId) {
    const cleanPlaceId = input.googlePlaceId.replace(/^places\//, "").trim();
    const placeConditions = [
      eq(kenyaLocations.googlePlaceId, cleanPlaceId),
      eq(kenyaLocations.countyId, county.id),
    ];
    if (explicitConstituency) {
      placeConditions.push(eq(kenyaLocations.constituencyId, explicitConstituency.id));
    }

    const [cachedByPlace] = await db
      .select()
      .from(kenyaLocations)
      .where(and(...placeConditions))
      .limit(1);

    if (cachedByPlace) {
      const linkedConst =
        explicitConstituency ||
        (
          await db
            .select()
            .from(kenyaConstituencies)
            .where(eq(kenyaConstituencies.id, cachedByPlace.constituencyId))
            .limit(1)
        )[0];

      if (linkedConst) {
        return {
          county,
          constituency: linkedConst,
          location: cachedByPlace,
          locationLabel: formatLocationLabel(
            cachedByPlace.name,
            linkedConst.name,
            county.name
          ),
        };
      }
    }

    const apiKey = env.GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) {
      throw new LocationResolutionError(
        "Google Maps lookup is not configured on the server; please select an existing town or enter your shopping centre name",
        503
      );
    }

    const details = await fetchGooglePlaceDetails(apiKey, cleanPlaceId);
    const linkedConst =
      explicitConstituency ||
      (await findClosestConstituencyInCounty(
        db,
        county.id,
        details.latitude,
        details.longitude
      ));

    if (!linkedConst) {
      throw new LocationResolutionError("No constituencies found for selected county", 404);
    }

    const id = `loc-gm-${generateUUID().slice(0, 12)}`;
    const slugBase = slugifyLocation(details.name) || "centre";
    const slug = `${slugBase}--${linkedConst.id.replace("const-", "")}-${id.slice(-4)}`;

    const [created] = await db
      .insert(kenyaLocations)
      .values({
        id,
        countyId: county.id,
        constituencyId: linkedConst.id,
        name: details.name,
        slug,
        kind: "SHOPPING_CENTRE",
        latitude: details.latitude,
        longitude: details.longitude,
        source: "GOOGLE_MAPS",
        googlePlaceId: details.placeId,
        population: 0,
      })
      .returning();

    await linkNeighborsForNewLocation(db, created);

    return {
      county,
      constituency: linkedConst,
      location: created,
      locationLabel: formatLocationLabel(created.name, linkedConst.name, county.name),
    };
  }

  // 3. Merchant-entered shopping centre inside selected county (uses optional constituency or county match)
  const customName = input.customLocationName?.trim();
  if (customName && customName.length >= 2) {
    const nameConditions = [
      eq(kenyaLocations.countyId, county.id),
      sql`lower(${kenyaLocations.name}) = ${customName.toLowerCase()}`,
    ];
    if (explicitConstituency) {
      nameConditions.push(eq(kenyaLocations.constituencyId, explicitConstituency.id));
    }

    const [existingByName] = await db
      .select()
      .from(kenyaLocations)
      .where(and(...nameConditions))
      .limit(1);

    if (existingByName) {
      const linkedConst =
        explicitConstituency ||
        (
          await db
            .select()
            .from(kenyaConstituencies)
            .where(eq(kenyaConstituencies.id, existingByName.constituencyId))
            .limit(1)
        )[0];

      if (linkedConst) {
        return {
          county,
          constituency: linkedConst,
          location: existingByName,
          locationLabel: formatLocationLabel(
            existingByName.name,
            linkedConst.name,
            county.name
          ),
        };
      }
    }

    const linkedConst =
      explicitConstituency ||
      (
        await db
          .select()
          .from(kenyaConstituencies)
          .where(eq(kenyaConstituencies.countyId, county.id))
          .orderBy(asc(kenyaConstituencies.code))
          .limit(1)
      )[0];

    if (!linkedConst) {
      throw new LocationResolutionError("No constituencies found for selected county", 404);
    }

    const id = `loc-mc-${generateUUID().slice(0, 12)}`;
    const slugBase = slugifyLocation(customName) || "centre";
    const slug = `${slugBase}--${linkedConst.id.replace("const-", "")}-${id.slice(-4)}`;

    const [created] = await db
      .insert(kenyaLocations)
      .values({
        id,
        countyId: county.id,
        constituencyId: linkedConst.id,
        name: customName,
        slug,
        kind: "SHOPPING_CENTRE",
        latitude: linkedConst.centroidLat,
        longitude: linkedConst.centroidLng,
        source: "MERCHANT",
        googlePlaceId: null,
        population: 0,
      })
      .returning();

    await linkNeighborsForNewLocation(db, created);

    return {
      county,
      constituency: linkedConst,
      location: created,
      locationLabel: formatLocationLabel(created.name, linkedConst.name, county.name),
    };
  }

  throw new LocationResolutionError(
    "Please search and select a town or shopping centre (or enter your shopping centre name)",
    400
  );
}
