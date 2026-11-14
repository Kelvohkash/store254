import { and, asc, between, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import {
  categories,
  itemVariants,
  items,
  kenyaConstituencies,
  kenyaCounties,
  kenyaLocationNeighbors,
  kenyaLocations,
  tenants,
} from "../../db/schema";
import { haversineKm } from "./locations.service";

type AppDb = DrizzleD1Database<typeof schema>;

export type SearchSortMode = "smart" | "nearest" | "relevance" | "price_asc" | "price_desc";

export interface RippleSearchParams {
  q?: string;
  locationId?: string;
  countyId?: string;
  lat?: number;
  lng?: number;
  itemType?: "PHYSICAL" | "SERVICE" | "DIGITAL";
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sort?: SearchSortMode;
  minResults?: number;
  expand?: "auto" | "full";
  limit?: number;
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "near",
  "from",
  "into",
  "that",
  "this",
  "your",
  "you",
  "are",
  "was",
  "can",
  "get",
  "buy",
  "find",
  "kenya",
  "in",
  "on",
  "at",
  "of",
  "to",
  "by",
  "or",
  "a",
  "an",
]);

const SYNONYM_GROUPS: string[][] = [
  ["phone", "smartphone", "mobile", "handset", "cellphone", "simu"],
  ["iphone", "ios", "apple"],
  ["tv", "television", "smarttv", "screen", "oled", "qled"],
  ["laptop", "notebook", "macbook", "computer", "ultrabook", "pc"],
  ["shoe", "sneaker", "trainer", "kicks", "footwear", "viatu", "boot", "sandal", "heel"],
  ["fridge", "refrigerator", "freezer", "cooler"],
  ["sofa", "couch", "settee", "sectional"],
  ["bed", "mattress", "duvet", "bedding"],
  ["house", "apartment", "bedsitter", "flat", "home", "rental", "letting", "keja", "maisonette"],
  ["land", "plot", "acre", "property", "shamba", "estate"],
  ["salon", "hair", "braids", "wig", "weave", "beauty", "manicure", "pedicure"],
  ["barber", "barbershop", "kinyozi", "haircut", "grooming", "shave"],
  ["spa", "massage", "wellness", "facial", "therapy"],
  ["photo", "photography", "photographer", "photoshoot", "shoot", "camera", "studio"],
  ["driving", "license", "ntsa", "lesson", "school"],
  ["dress", "gown", "outfit", "fashion", "clothing", "apparel", "jacket", "coat", "hoodie", "shirt"],
  ["speaker", "subwoofer", "woofer", "soundbar", "audio", "headphone", "earbud", "earphone", "airpod"],
  ["watch", "smartwatch", "timepiece"],
  ["solar", "inverter", "battery", "panel"],
  ["web", "website", "software", "cloud", "app", "developer", "engineer"],
];

const SYNONYM_LOOKUP = (() => {
  const map = new Map<string, string[]>();
  for (const group of SYNONYM_GROUPS) {
    for (const word of group) {
      map.set(word, group);
    }
  }
  return map;
})();

export const RIPPLE_RING_DEFINITIONS = [
  { ring: 0, name: "Exact Centre", scopeLabel: "Selected town / shopping centre", maxDistanceKm: 0 },
  { ring: 1, name: "8 Nearest Centres", scopeLabel: "Direct smart-linked neighbours", maxDistanceKm: 18 },
  { ring: 2, name: "Constituency & Local Hubs", scopeLabel: "2nd-hop centres & town hubs (<= 35 km)", maxDistanceKm: 35 },
  { ring: 3, name: "Regional Commercial Towns", scopeLabel: "Larger regional trading towns (<= 100 km)", maxDistanceKm: 100 },
  { ring: 4, name: "Major National Hubs", scopeLabel: "Kenya-wide cities & county capitals", maxDistanceKm: 1200 },
  { ring: 5, name: "Nationwide Dispatch", scopeLabel: "Kenya & cross-border courier sellers", maxDistanceKm: null },
] as const;

const SHORT_S_EXCLUSIONS = new Set([
  "gas",
  "bus",
  "ios",
  "sms",
  "gps",
  "pos",
  "ups",
  "was",
  "has",
  "his",
  "its",
  "yes",
]);

export function stemToken(raw: string): string {
  const word = raw.toLowerCase().trim();
  if (word.length <= 2) return word;
  if (word.length === 3) {
    if (word.endsWith("s") && !word.endsWith("ss") && !SHORT_S_EXCLUSIONS.has(word)) {
      return word.slice(0, -1);
    }
    return word;
  }
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("es") && !/(ses|xes|zes|ches|shes)$/.test(word) && word.length > 4) {
    return word.slice(0, -1);
  }
  if (word.endsWith("es") && /(ses|xes|zes|ches|shes)$/.test(word) && word.length > 4) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us") && word.length > 3) {
    return word.slice(0, -1);
  }
  return word;
}

export interface ParsedSearchQuery {
  raw: string;
  normalized: string;
  tokens: string[];
  expandedGroups: string[][];
  strictFtsQuery: string;
  broadFtsQuery: string;
}

function sanitizeFtsToken(token: string): string {
  return token.replace(/[^a-z0-9]/gi, "").trim();
}

export function parseInternationalQuery(rawQuery: string): ParsedSearchQuery {
  const raw = String(rawQuery || "").trim();
  const normalized = raw
    .toLowerCase()
    .replace(/['’"`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return {
      raw,
      normalized: "",
      tokens: [],
      expandedGroups: [],
      strictFtsQuery: "",
      broadFtsQuery: "",
    };
  }

  const rawTokens = normalized.split(" ").filter(Boolean);
  const meaningful = rawTokens.filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  const tokens = meaningful.length > 0 ? meaningful : rawTokens;
  const dedupedTokens = Array.from(new Set(tokens)).slice(0, 8);

  const expandedGroups = dedupedTokens.map((token) => {
    const stemmed = stemToken(token);
    const syns = SYNONYM_LOOKUP.get(stemmed) || SYNONYM_LOOKUP.get(token) || [];
    const variants = new Set<string>();
    for (const candidate of [token, stemmed, ...syns]) {
      const cleaned = sanitizeFtsToken(candidate);
      if (cleaned.length >= 2) {
        variants.add(cleaned);
      } else if (cleaned.length === 1 && /^\d$/.test(cleaned)) {
        variants.add(cleaned);
      }
    }
    return Array.from(variants);
  });

  const groupExpressions = expandedGroups
    .filter((group) => group.length > 0)
    .map((group) => {
      const terms = group.map((term) => (term.length >= 2 ? `${term}*` : term));
      return terms.length === 1 ? terms[0] : `(${terms.join(" OR ")})`;
    });

  const strictFtsQuery = groupExpressions.join(" AND ");
  const broadFtsQuery = Array.from(new Set(expandedGroups.flat()))
    .slice(0, 18)
    .map((term) => (term.length >= 2 ? `${term}*` : term))
    .join(" OR ");

  return {
    raw,
    normalized,
    tokens: dedupedTokens,
    expandedGroups,
    strictFtsQuery,
    broadFtsQuery,
  };
}

/**
 * Optimal String Alignment (Damerau-Levenshtein) for international typo tolerance.
 * Handles swaps ("ipohne"), missing letters ("samsng"), extra letters ("shooes").
 */
export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (a === b) return 0;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = val;
    }
  }
  return dp[m][n];
}

interface TextScoreResult {
  matched: boolean;
  score: number;
  matchType: "exact" | "semantic" | "fuzzy" | "browse";
  correctedTokens: Array<{ typed: string; matched: string }>;
}

function scoreCandidateText(
  parsed: ParsedSearchQuery,
  fields: {
    title: string;
    description: string;
    categoryName: string;
    storeName: string;
    sku: string;
    attributesText: string;
    bm25Score?: number;
  }
): TextScoreResult {
  if (parsed.tokens.length === 0) {
    return { matched: true, score: 20, matchType: "browse", correctedTokens: [] };
  }

  const titleLower = fields.title.toLowerCase();
  const titleWords = titleLower
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length >= 2);
  const fullText = [
    fields.title,
    fields.categoryName,
    fields.storeName,
    fields.sku,
    fields.attributesText,
    fields.description,
  ]
    .join(" ")
    .toLowerCase();
  const corpusWords = Array.from(
    new Set(
      fullText
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .split(" ")
        .filter((w) => w.length >= 2)
    )
  );

  let score = 0;
  let exactOrPrefixHits = 0;
  let semanticHits = 0;
  let fuzzyHits = 0;
  const correctedTokens: Array<{ typed: string; matched: string }> = [];

  if (parsed.normalized.length >= 3) {
    if (titleLower === parsed.normalized) score += 90;
    else if (titleLower.startsWith(parsed.normalized)) score += 65;
    else if (titleLower.includes(parsed.normalized)) score += 45;
    else if (fullText.includes(parsed.normalized)) score += 22;
  }

  if (fields.sku && fields.sku.toLowerCase().trim() === parsed.normalized) {
    score += 100;
  }

  for (let i = 0; i < parsed.tokens.length; i += 1) {
    const token = parsed.tokens[i];
    const stemmed = stemToken(token);
    const group = parsed.expandedGroups[i] || [token];

    const directInTitle = titleWords.some(
      (w) => w === token || w === stemmed || w.startsWith(token) || w.startsWith(stemmed)
    );
    const directInCorpus =
      directInTitle ||
      (token.length <= 3
        ? corpusWords.some((w) => w === token || w === stemmed)
        : fullText.includes(token) || (stemmed.length >= 4 && fullText.includes(stemmed)));

    if (directInTitle) {
      exactOrPrefixHits += 1;
      score += 32;
      continue;
    }

    if (directInCorpus) {
      exactOrPrefixHits += 1;
      score += 18;
      continue;
    }

    const synMatch = group.find(
      (g) =>
        g !== token &&
        (titleWords.some((w) => (g.length <= 3 ? w === g : w.startsWith(g))) ||
          (g.length <= 3 ? corpusWords.some((w) => w === g) : fullText.includes(g)))
    );
    if (synMatch) {
      semanticHits += 1;
      score += 16;
      continue;
    }

    // Typo tolerance via Damerau-Levenshtein over candidate words
    if (token.length >= 4) {
      const maxEdits = token.length >= 7 ? 2 : 1;
      let bestDist = Infinity;
      let bestWord = "";
      for (const cand of corpusWords) {
        if (Math.abs(cand.length - token.length) > maxEdits) continue;
        const dist = damerauLevenshtein(token, cand);
        if (dist <= maxEdits && dist < bestDist) {
          bestDist = dist;
          bestWord = cand;
          if (dist === 1) break;
        }
      }
      if (bestWord) {
        fuzzyHits += 1;
        score += bestDist === 1 ? 15 : 9;
        correctedTokens.push({ typed: token, matched: bestWord });
      }
    }
  }

  const totalMatched = exactOrPrefixHits + semanticHits + fuzzyHits;
  if (totalMatched === 0) {
    return { matched: false, score: 0, matchType: "fuzzy", correctedTokens: [] };
  }

  // Coverage multiplier rewards items matching ALL query tokens
  const coverageRatio = totalMatched / parsed.tokens.length;
  score += Math.round(coverageRatio * 35);
  if (totalMatched === parsed.tokens.length && parsed.tokens.length > 1) {
    score += 20;
  }

  // Incorporate SQLite FTS5 BM25 signal when available (negative BM25 = stronger match)
  if (typeof fields.bm25Score === "number" && Number.isFinite(fields.bm25Score)) {
    score += Math.min(25, Math.max(0, Math.round(-fields.bm25Score * 2.5)));
  }

  const matchType =
    fuzzyHits > 0 && exactOrPrefixHits === 0 && semanticHits === 0
      ? "fuzzy"
      : semanticHits > 0 && exactOrPrefixHits < parsed.tokens.length
        ? "semantic"
        : "exact";

  return { matched: true, score, matchType, correctedTokens };
}

interface OriginRippleContext {
  origin: {
    id: string;
    name: string;
    kind: string;
    countyId: string;
    countyName: string;
    constituencyId: string;
    constituencyName: string;
    latitude: number;
    longitude: number;
  } | null;
  ring1Ids: Set<string>;
  ring1Dist: Map<string, number>;
  ring2Ids: Set<string>;
  ring2Dist: Map<string, number>;
}

async function resolveOriginContext(
  db: AppDb,
  params: RippleSearchParams
): Promise<OriginRippleContext> {
  let targetLocationId = params.locationId?.trim() || "";

  // If browser GPS coordinates provided without locationId, snap to closest centre in Kenya
  if (!targetLocationId && typeof params.lat === "number" && typeof params.lng === "number") {
    const nearby = await db
      .select({
        id: kenyaLocations.id,
        latitude: kenyaLocations.latitude,
        longitude: kenyaLocations.longitude,
      })
      .from(kenyaLocations)
      .where(
        and(
          between(kenyaLocations.latitude, params.lat - 0.5, params.lat + 0.5),
          between(kenyaLocations.longitude, params.lng - 0.5, params.lng + 0.5)
        )
      )
      .limit(120);

    let bestId = "";
    let bestKm = Infinity;
    for (const row of nearby) {
      const km = haversineKm(params.lat, params.lng, row.latitude, row.longitude);
      if (km < bestKm) {
        bestKm = km;
        bestId = row.id;
      }
    }
    targetLocationId = bestId;
  }

  // If only countyId provided, pick the County HQ / largest town in that county
  if (!targetLocationId && params.countyId?.trim()) {
    const [topInCounty] = await db
      .select({ id: kenyaLocations.id })
      .from(kenyaLocations)
      .where(eq(kenyaLocations.countyId, params.countyId.trim()))
      .orderBy(
        sql`CASE ${kenyaLocations.kind} WHEN 'TOWN' THEN 0 WHEN 'SHOPPING_CENTRE' THEN 1 ELSE 2 END`,
        desc(kenyaLocations.population),
        asc(kenyaLocations.name)
      )
      .limit(1);
    if (topInCounty) targetLocationId = topInCounty.id;
  }

  if (!targetLocationId) {
    return {
      origin: null,
      ring1Ids: new Set(),
      ring1Dist: new Map(),
      ring2Ids: new Set(),
      ring2Dist: new Map(),
    };
  }

  const [origin] = await db
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
    .innerJoin(kenyaConstituencies, eq(kenyaLocations.constituencyId, kenyaConstituencies.id))
    .where(eq(kenyaLocations.id, targetLocationId))
    .limit(1);

  if (!origin) {
    return {
      origin: null,
      ring1Ids: new Set(),
      ring1Dist: new Map(),
      ring2Ids: new Set(),
      ring2Dist: new Map(),
    };
  }

  // Ring 1: 8 direct neighbors from kenya_location_neighbors
  const directNeighbors = await db
    .select({
      neighborLocationId: kenyaLocationNeighbors.neighborLocationId,
      distanceKm: kenyaLocationNeighbors.distanceKm,
    })
    .from(kenyaLocationNeighbors)
    .where(eq(kenyaLocationNeighbors.locationId, origin.id))
    .orderBy(asc(kenyaLocationNeighbors.rank))
    .limit(8);

  const ring1Ids = new Set<string>(directNeighbors.map((n) => n.neighborLocationId));
  const ring1Dist = new Map<string, number>(
    directNeighbors.map((n) => [n.neighborLocationId, n.distanceKm])
  );

  // Ring 2: 2nd-hop neighbors + constituency hubs + locations <= 35 km
  const ring2Ids = new Set<string>();
  const ring2Dist = new Map<string, number>();

  const ring1Array = Array.from(ring1Ids);
  const [secondHopRows, nearbyHubRows] = await Promise.all([
    ring1Array.length > 0
      ? db
          .select({
            id: kenyaLocationNeighbors.neighborLocationId,
            lat: kenyaLocations.latitude,
            lng: kenyaLocations.longitude,
          })
          .from(kenyaLocationNeighbors)
          .innerJoin(kenyaLocations, eq(kenyaLocationNeighbors.neighborLocationId, kenyaLocations.id))
          .where(
            and(
              inArray(kenyaLocationNeighbors.locationId, ring1Array),
              lte(kenyaLocationNeighbors.rank, 6)
            )
          )
          .limit(64)
      : Promise.resolve([]),
    db
      .select({
        id: kenyaLocations.id,
        lat: kenyaLocations.latitude,
        lng: kenyaLocations.longitude,
        kind: kenyaLocations.kind,
        constituencyId: kenyaLocations.constituencyId,
      })
      .from(kenyaLocations)
      .where(
        and(
          between(kenyaLocations.latitude, origin.latitude - 0.34, origin.latitude + 0.34),
          between(kenyaLocations.longitude, origin.longitude - 0.34, origin.longitude + 0.34)
        )
      )
      .limit(450),
  ]);

  for (const row of [...secondHopRows, ...nearbyHubRows]) {
    if (row.id === origin.id || ring1Ids.has(row.id)) continue;
    const km = haversineKm(origin.latitude, origin.longitude, row.lat, row.lng);
    const sameConstituencyHub =
      "constituencyId" in row &&
      "kind" in row &&
      row.constituencyId === origin.constituencyId &&
      (row.kind === "TOWN" || row.kind === "SHOPPING_CENTRE");
    if (km <= 35 || sameConstituencyHub) {
      ring2Ids.add(row.id);
      ring2Dist.set(row.id, Number(km.toFixed(1)));
    }
  }

  return { origin, ring1Ids, ring1Dist, ring2Ids, ring2Dist };
}

function classifyLocationIntoRing(
  ctx: OriginRippleContext,
  storeLocationId: string | null,
  storeLat: number | null,
  storeLng: number | null,
  storeKind: string | null,
  storePopulation: number | null
): {
  ring: number;
  distanceKm: number | null;
  isHub: boolean;
} {
  const isHub = storeKind === "TOWN" || storeKind === "SHOPPING_CENTRE" || (storePopulation ?? 0) >= 10000;

  if (!ctx.origin) {
    // National/International mode without origin pin: commercial hubs sort smoothly first
    return {
      ring: storeLocationId ? (isHub ? 3 : 4) : 5,
      distanceKm: null,
      isHub,
    };
  }

  if (!storeLocationId || storeLat === null || storeLng === null) {
    return { ring: 5, distanceKm: null, isHub: false };
  }

  if (storeLocationId === ctx.origin.id) {
    return { ring: 0, distanceKm: 0, isHub };
  }

  if (ctx.ring1Ids.has(storeLocationId)) {
    return {
      ring: 1,
      distanceKm: Number((ctx.ring1Dist.get(storeLocationId) ?? 0).toFixed(1)),
      isHub,
    };
  }

  const dist = Number(
    (
      ctx.ring2Dist.get(storeLocationId) ??
      haversineKm(ctx.origin.latitude, ctx.origin.longitude, storeLat, storeLng)
    ).toFixed(1)
  );

  if (ctx.ring2Ids.has(storeLocationId) || dist <= 35) {
    return { ring: 2, distanceKm: dist, isHub };
  }

  if (dist <= 100) {
    return { ring: 3, distanceKm: dist, isHub };
  }

  return { ring: 4, distanceKm: dist, isHub };
}

interface RawItemCandidate {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  description: string | null;
  itemType: string;
  basePrice: number;
  compareAtPrice: number | null;
  sku: string | null;
  trackInventory: boolean;
  stockQuantity: number;
  images: string[] | null;
  attributes: Record<string, unknown> | null;
  createdAt: Date | number;
  categoryName: string | null;
  storeName: string;
  storeSubdomain: string;
  storeCurrency: string;
  storeBusinessType: string;
  storeCountyId: string | null;
  storeCountyName: string | null;
  storeConstituencyName: string | null;
  storeLocationId: string | null;
  storeLocationName: string | null;
  storeLocationLabel: string | null;
  storeLocationKind: string | null;
  storeLat: number | null;
  storeLng: number | null;
  storePopulation: number | null;
  bm25Score?: number;
}

async function fetchCandidatesByFts(
  db: AppDb,
  ftsExpression: string,
  filters: RippleSearchParams,
  limitRows: number
): Promise<RawItemCandidate[]> {
  if (!ftsExpression) return [];

  const rows = await db
    .select({
      id: items.id,
      tenantId: items.tenantId,
      title: items.title,
      slug: items.slug,
      description: items.description,
      itemType: items.itemType,
      basePrice: items.basePrice,
      compareAtPrice: items.compareAtPrice,
      sku: items.sku,
      trackInventory: items.trackInventory,
      stockQuantity: items.stockQuantity,
      images: items.images,
      attributes: items.attributes,
      createdAt: items.createdAt,
      categoryName: categories.name,
      storeName: tenants.name,
      storeSubdomain: tenants.subdomain,
      storeCurrency: tenants.currency,
      storeBusinessType: tenants.businessType,
      storeCountyId: tenants.countyId,
      storeCountyName: kenyaCounties.name,
      storeConstituencyName: kenyaConstituencies.name,
      storeLocationId: tenants.locationId,
      storeLocationName: kenyaLocations.name,
      storeLocationLabel: tenants.locationLabel,
      storeLocationKind: kenyaLocations.kind,
      storeLat: kenyaLocations.latitude,
      storeLng: kenyaLocations.longitude,
      storePopulation: kenyaLocations.population,
      bm25Score: sql<number>`bm25(items_fts)`,
    })
    .from(sql`items_fts`)
    .innerJoin(items, eq(items.id, sql`items_fts.item_id`))
    .innerJoin(tenants, eq(tenants.id, items.tenantId))
    .leftJoin(categories, eq(categories.id, items.categoryId))
    .leftJoin(kenyaLocations, eq(kenyaLocations.id, tenants.locationId))
    .leftJoin(kenyaCounties, eq(kenyaCounties.id, tenants.countyId))
    .leftJoin(kenyaConstituencies, eq(kenyaConstituencies.id, tenants.constituencyId))
    .where(
      and(
        sql`items_fts MATCH ${ftsExpression}`,
        eq(items.status, "PUBLISHED"),
        eq(tenants.status, "ACTIVE"),
        filters.itemType ? eq(items.itemType, filters.itemType) : undefined,
        typeof filters.minPrice === "number" ? gte(items.basePrice, filters.minPrice) : undefined,
        typeof filters.maxPrice === "number" ? lte(items.basePrice, filters.maxPrice) : undefined,
        filters.inStockOnly
          ? sql`(${items.itemType} = 'SERVICE' OR ${items.trackInventory} = 0 OR ${items.stockQuantity} > 0)`
          : undefined
      )
    )
    .orderBy(sql`bm25(items_fts) ASC`)
    .limit(limitRows);

  return rows;
}

async function fetchPublishedCatalogPool(
  db: AppDb,
  filters: RippleSearchParams,
  limitRows: number
): Promise<RawItemCandidate[]> {
  return db
    .select({
      id: items.id,
      tenantId: items.tenantId,
      title: items.title,
      slug: items.slug,
      description: items.description,
      itemType: items.itemType,
      basePrice: items.basePrice,
      compareAtPrice: items.compareAtPrice,
      sku: items.sku,
      trackInventory: items.trackInventory,
      stockQuantity: items.stockQuantity,
      images: items.images,
      attributes: items.attributes,
      createdAt: items.createdAt,
      categoryName: categories.name,
      storeName: tenants.name,
      storeSubdomain: tenants.subdomain,
      storeCurrency: tenants.currency,
      storeBusinessType: tenants.businessType,
      storeCountyId: tenants.countyId,
      storeCountyName: kenyaCounties.name,
      storeConstituencyName: kenyaConstituencies.name,
      storeLocationId: tenants.locationId,
      storeLocationName: kenyaLocations.name,
      storeLocationLabel: tenants.locationLabel,
      storeLocationKind: kenyaLocations.kind,
      storeLat: kenyaLocations.latitude,
      storeLng: kenyaLocations.longitude,
      storePopulation: kenyaLocations.population,
    })
    .from(items)
    .innerJoin(tenants, eq(tenants.id, items.tenantId))
    .leftJoin(categories, eq(categories.id, items.categoryId))
    .leftJoin(kenyaLocations, eq(kenyaLocations.id, tenants.locationId))
    .leftJoin(kenyaCounties, eq(kenyaCounties.id, tenants.countyId))
    .leftJoin(kenyaConstituencies, eq(kenyaConstituencies.id, tenants.constituencyId))
    .where(
      and(
        eq(items.status, "PUBLISHED"),
        eq(tenants.status, "ACTIVE"),
        filters.itemType ? eq(items.itemType, filters.itemType) : undefined,
        typeof filters.minPrice === "number" ? gte(items.basePrice, filters.minPrice) : undefined,
        typeof filters.maxPrice === "number" ? lte(items.basePrice, filters.maxPrice) : undefined,
        filters.inStockOnly
          ? sql`(${items.itemType} = 'SERVICE' OR ${items.trackInventory} = 0 OR ${items.stockQuantity} > 0)`
          : undefined
      )
    )
    .orderBy(desc(items.createdAt))
    .limit(limitRows);
}

export async function searchMarketplaceWithRipple(
  db: AppDb,
  rawParams: RippleSearchParams
) {
  const minResults = Math.min(Math.max(rawParams.minResults ?? 10, 1), 40);
  const limit = Math.min(Math.max(rawParams.limit ?? 24, 1), 60);
  const sortMode: SearchSortMode = rawParams.sort || "smart";
  const expandMode = rawParams.expand || "auto";

  const parsed = parseInternationalQuery(rawParams.q || "");
  const originCtx = await resolveOriginContext(db, rawParams);

  const candidateMap = new Map<string, RawItemCandidate>();
  const addCandidates = (rows: RawItemCandidate[]) => {
    for (const row of rows) {
      const existing = candidateMap.get(row.id);
      if (!existing) {
        candidateMap.set(row.id, row);
      } else if (existing.bm25Score === undefined && row.bm25Score !== undefined) {
        candidateMap.set(row.id, row);
      }
    }
  };

  if (parsed.tokens.length > 0) {
    // Stage 1: Fast FTS5 strict+synonym retrieval (gracefully falls back if items_fts unavailable in tests)
    try {
      const strictRows = await fetchCandidatesByFts(db, parsed.strictFtsQuery, rawParams, 160);
      addCandidates(strictRows);

      if (candidateMap.size < minResults && parsed.broadFtsQuery && parsed.broadFtsQuery !== parsed.strictFtsQuery) {
        const broadRows = await fetchCandidatesByFts(db, parsed.broadFtsQuery, rawParams, 160);
        addCandidates(broadRows);
      }
    } catch {
      // Fall back silently to catalog scan if FTS table is absent in a unit environment
    }

    // Stage 2: Fuzzy typo-tolerant fallback if FTS yielded fewer than minResults
    if (candidateMap.size < minResults) {
      const poolRows = await fetchPublishedCatalogPool(db, rawParams, 350);
      addCandidates(poolRows);
    }
  } else {
    // Browse mode without text query
    const poolRows = await fetchPublishedCatalogPool(db, rawParams, 220);
    addCandidates(poolRows);
  }

  // Score, filter, and assign spatial ripple ring to every candidate
  const correctionCounts = new Map<string, number>();

  interface ScoredItem {
    candidate: RawItemCandidate;
    ring: number;
    distanceKm: number | null;
    isHub: boolean;
    textScore: number;
    matchType: TextScoreResult["matchType"];
    compositeScore: number;
    inStock: boolean;
    rippleLabel: string;
  }

  const allScored: ScoredItem[] = [];
  for (const candidate of candidateMap.values()) {
    const attrsText = candidate.attributes
      ? Object.entries(candidate.attributes)
          .map(([k, v]) => `${k} ${String(v ?? "")}`)
          .join(" ")
      : "";

    const textEval = scoreCandidateText(parsed, {
      title: candidate.title,
      description: candidate.description || "",
      categoryName: candidate.categoryName || "",
      storeName: candidate.storeName,
      sku: candidate.sku || "",
      attributesText: attrsText,
      bm25Score: candidate.bm25Score,
    });

    if (!textEval.matched) continue;

    for (const corr of textEval.correctedTokens) {
      const key = `${corr.typed}=>${corr.matched}`;
      correctionCounts.set(key, (correctionCounts.get(key) ?? 0) + 1);
    }

    const ringInfo = classifyLocationIntoRing(
      originCtx,
      candidate.storeLocationId,
      candidate.storeLat,
      candidate.storeLng,
      candidate.storeLocationKind,
      candidate.storePopulation
    );

    const inStock =
      candidate.itemType === "SERVICE" ||
      !candidate.trackInventory ||
      candidate.stockQuantity > 0;
    const hasImages = Array.isArray(candidate.images) && candidate.images.length > 0;
    const hasDiscount =
      typeof candidate.compareAtPrice === "number" &&
      candidate.compareAtPrice > candidate.basePrice;

    const ringScoreMap = [60, 44, 30, 18, 8, 2];
    const hubBonus = ringInfo.isHub && ringInfo.ring >= 2 ? 7 : 0;
    const stockScore = inStock ? 14 : -24;
    const qualityScore = (hasImages ? 6 : 0) + (hasDiscount ? 4 : 0) + stockScore;
    const distancePenalty =
      typeof ringInfo.distanceKm === "number" ? Math.min(20, ringInfo.distanceKm / 25) : 12;

    const compositeScore = Number(
      (
        textEval.score +
        (ringScoreMap[ringInfo.ring] ?? 0) +
        hubBonus +
        qualityScore -
        distancePenalty
      ).toFixed(2)
    );

    let rippleLabel = "Nationwide Shipping";
    if (!originCtx.origin) {
      rippleLabel = candidate.storeLocationName
        ? `${candidate.storeLocationName}${candidate.storeCountyName ? `, ${candidate.storeCountyName}` : ""}`
        : "Nationwide Shipping";
    } else if (ringInfo.ring === 0) {
      rippleLabel = `In ${originCtx.origin.name}`;
    } else if (ringInfo.ring === 1) {
      rippleLabel = `Nearby ${candidate.storeLocationName || "Centre"} · ${ringInfo.distanceKm} km`;
    } else if (ringInfo.ring === 2) {
      rippleLabel = `${ringInfo.isHub ? "Area Hub" : "Local Ripple"} · ${candidate.storeLocationName} · ${ringInfo.distanceKm} km`;
    } else if (ringInfo.ring === 3) {
      rippleLabel = `Regional ${ringInfo.isHub ? "Town Hub" : "Centre"} · ${candidate.storeLocationName} · ${ringInfo.distanceKm} km`;
    } else if (ringInfo.ring === 4) {
      rippleLabel = `Major Hub · ${candidate.storeLocationName}, ${candidate.storeCountyName || ""} · ${ringInfo.distanceKm} km`;
    } else {
      rippleLabel = "Nationwide Courier Delivery";
    }

    allScored.push({
      candidate,
      ring: ringInfo.ring,
      distanceKm: ringInfo.distanceKm,
      isHub: ringInfo.isHub,
      textScore: textEval.score,
      matchType: textEval.matchType,
      compositeScore,
      inStock,
      rippleLabel,
    });
  }

  // Group counts per ring to compute the exact ripple progression trail
  const countsByRing = [0, 0, 0, 0, 0, 0];
  for (const row of allScored) {
    countsByRing[row.ring] = (countsByRing[row.ring] ?? 0) + 1;
  }

  let cumulative = 0;
  let stoppedAtRing = 0;
  const rippleTrail = RIPPLE_RING_DEFINITIONS.map((def) => {
    const ringCount = countsByRing[def.ring] ?? 0;
    const prevCumulative = cumulative;
    cumulative += ringCount;
    const reachedBefore = originCtx.origin && prevCumulative >= minResults && expandMode !== "full";
    if (!reachedBefore && ringCount > 0) {
      stoppedAtRing = Math.max(stoppedAtRing, def.ring);
    } else if (!reachedBefore && prevCumulative < minResults) {
      stoppedAtRing = def.ring;
    }
    return {
      ring: def.ring,
      name: def.ring === 0 && originCtx.origin ? originCtx.origin.name : def.name,
      scopeLabel: def.scopeLabel,
      maxDistanceKm: def.maxDistanceKm,
      newMatches: ringCount,
      cumulativeMatches: cumulative,
      inspected: !reachedBefore,
    };
  });

  if (allScored.length === 0) {
    stoppedAtRing = originCtx.origin ? 5 : 4;
  } else if (expandMode === "full" || !originCtx.origin) {
    stoppedAtRing = 5;
  }

  // Only keep items up to stoppedAtRing when expand === "auto" and origin is specified
  const visibleItems =
    originCtx.origin && expandMode === "auto"
      ? allScored.filter((r) => r.ring <= stoppedAtRing)
      : allScored;

  // International sorting strategies
  visibleItems.sort((a, b) => {
    if (sortMode === "nearest") {
      if (a.ring !== b.ring) return a.ring - b.ring;
      const distA = a.distanceKm ?? 99999;
      const distB = b.distanceKm ?? 99999;
      if (distA !== distB) return distA - distB;
      return b.textScore - a.textScore;
    }
    if (sortMode === "relevance") {
      if (b.textScore !== a.textScore) return b.textScore - a.textScore;
      return b.compositeScore - a.compositeScore;
    }
    if (sortMode === "price_asc") {
      if (a.candidate.basePrice !== b.candidate.basePrice) {
        return a.candidate.basePrice - b.candidate.basePrice;
      }
      return b.compositeScore - a.compositeScore;
    }
    if (sortMode === "price_desc") {
      if (b.candidate.basePrice !== a.candidate.basePrice) {
        return b.candidate.basePrice - a.candidate.basePrice;
      }
      return b.compositeScore - a.compositeScore;
    }
    // Default "smart": balanced ripple proximity + commercial hub + relevance + stock
    if (originCtx.origin && a.ring !== b.ring) {
      return a.ring - b.ring;
    }
    return b.compositeScore - a.compositeScore;
  });

  const sliced = visibleItems.slice(0, limit);

  // Batch fetch lowest starting variant price & variant count for returned items
  const returnedIds = sliced.map((s) => s.candidate.id);
  const variantSummary = new Map<string, { count: number; minPrice: number }>();
  if (returnedIds.length > 0) {
    const vRows = await db
      .select({
        itemId: itemVariants.itemId,
        price: itemVariants.price,
      })
      .from(itemVariants)
      .where(inArray(itemVariants.itemId, returnedIds));
    for (const v of vRows) {
      const prev = variantSummary.get(v.itemId);
      if (!prev) {
        variantSummary.set(v.itemId, { count: 1, minPrice: v.price });
      } else {
        prev.count += 1;
        prev.minPrice = Math.min(prev.minPrice, v.price);
      }
    }
  }

  // Facets across visible matches
  const typeFacet = new Map<string, number>();
  const countyFacet = new Map<string, { id: string; name: string; count: number }>();
  let minFacetPrice = Infinity;
  let maxFacetPrice = 0;
  for (const row of visibleItems) {
    typeFacet.set(row.candidate.itemType, (typeFacet.get(row.candidate.itemType) ?? 0) + 1);
    if (row.candidate.storeCountyId && row.candidate.storeCountyName) {
      const prev = countyFacet.get(row.candidate.storeCountyId);
      if (prev) prev.count += 1;
      else {
        countyFacet.set(row.candidate.storeCountyId, {
          id: row.candidate.storeCountyId,
          name: row.candidate.storeCountyName,
          count: 1,
        });
      }
    }
    minFacetPrice = Math.min(minFacetPrice, row.candidate.basePrice);
    maxFacetPrice = Math.max(maxFacetPrice, row.candidate.basePrice);
  }

  // Did-you-mean suggestion if fuzzy spelling corrections occurred
  let didYouMean: string | null = null;
  if (correctionCounts.size > 0 && parsed.tokens.length > 0) {
    const bestReplacement = new Map<string, string>();
    const bestVotes = new Map<string, number>();
    for (const [pair, votes] of correctionCounts.entries()) {
      const [typed, matched] = pair.split("=>");
      if (votes > (bestVotes.get(typed) ?? 0)) {
        bestVotes.set(typed, votes);
        bestReplacement.set(typed, matched);
      }
    }
    const rebuilt = parsed.tokens.map((t) => bestReplacement.get(t) || t).join(" ");
    if (rebuilt !== parsed.normalized) {
      didYouMean = rebuilt;
    }
  }

  // Human-readable ripple headline
  let headline = "";
  if (originCtx.origin) {
    const localCount = countsByRing[0] ?? 0;
    const neighborCount = countsByRing[1] ?? 0;
    if (allScored.length === 0) {
      headline = `Searched ${originCtx.origin.name}, its 8 closest centres, regional towns, and nationwide sellers — 0 matches found.`;
    } else if (localCount >= minResults && stoppedAtRing === 0) {
      headline = `Found ${visibleItems.length} match${visibleItems.length === 1 ? "" : "es"} directly in ${originCtx.origin.name}.`;
    } else if (localCount === 0 && neighborCount === 0) {
      const expandedRings = rippleTrail
        .filter((r) => r.ring >= 2 && r.inspected && r.newMatches > 0)
        .map((r) => `${r.name} (+${r.newMatches})`);
      headline = `0 in ${originCtx.origin.name} & 8 closest centres → Rippled outward to ${expandedRings.join(" → ") || "wider Kenyan hubs"}.`;
    } else {
      const expandedRings = rippleTrail
        .filter((r) => r.inspected && r.newMatches > 0)
        .map((r) => `${r.ring === 0 ? originCtx.origin?.name : r.name} (${r.newMatches})`);
      headline = `Smart Ripple active from ${originCtx.origin.name}: ${expandedRings.join(" → ")}.`;
    }
  } else {
    headline =
      allScored.length > 0
        ? `Showing ${visibleItems.length} match${visibleItems.length === 1 ? "" : "es"} across Store254 Kenya.`
        : "No matching products or services found nationwide.";
  }

  const results = sliced.map((entry) => {
    const c = entry.candidate;
    const vInfo = variantSummary.get(c.id);
    const createdEpoch =
      c.createdAt instanceof Date ? c.createdAt.getTime() : Number(c.createdAt || 0);
    return {
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      itemType: c.itemType,
      basePrice: c.basePrice,
      compareAtPrice: c.compareAtPrice,
      currency: c.storeCurrency || "KES",
      inStock: entry.inStock,
      stockQuantity: c.stockQuantity,
      images: Array.isArray(c.images) ? c.images : [],
      categoryName: c.categoryName || c.storeBusinessType,
      variantCount: vInfo?.count ?? 0,
      startingPrice: vInfo ? Math.min(c.basePrice, vInfo.minPrice) : c.basePrice,
      createdAt: createdEpoch,
      store: {
        id: c.tenantId,
        name: c.storeName,
        subdomain: c.storeSubdomain,
        businessType: c.storeBusinessType,
        countyName: c.storeCountyName,
        constituencyName: c.storeConstituencyName,
        locationName: c.storeLocationName,
        locationLabel: c.storeLocationLabel,
      },
      geo: {
        rippleRing: entry.ring,
        rippleLabel: entry.rippleLabel,
        distanceKm: entry.distanceKm,
        isMajorHub: entry.isHub,
      },
      ranking: {
        matchType: entry.matchType,
        textScore: entry.textScore,
        compositeScore: entry.compositeScore,
      },
    };
  });

  return {
    query: parsed.raw,
    didYouMean,
    sort: sortMode,
    totalMatches: allScored.length,
    returnedCount: results.length,
    hasMoreNationalMatches:
      originCtx.origin !== null &&
      expandMode === "auto" &&
      allScored.length > visibleItems.length,
    rippleSummary: {
      origin: originCtx.origin,
      expanded: originCtx.origin !== null && stoppedAtRing > 0,
      stoppedAtRing,
      headline,
      rings: rippleTrail,
    },
    facets: {
      itemTypes: Array.from(typeFacet.entries()).map(([type, count]) => ({ type, count })),
      counties: Array.from(countyFacet.values()).sort((a, b) => b.count - a.count),
      priceRange: {
        min: Number.isFinite(minFacetPrice) ? minFacetPrice : 0,
        max: maxFacetPrice,
      },
    },
    results,
  };
}

export async function suggestMarketplaceTerms(db: AppDb, rawQuery: string, limit = 8) {
  const clean = String(rawQuery || "").trim();
  if (clean.length < 2) {
    return { suggestions: [], stores: [] };
  }

  const parsed = parseInternationalQuery(clean);
  const safeLimit = Math.min(Math.max(limit, 1), 15);
  let titleRows: Array<{ title: string; categoryName: string | null; itemType: string }> = [];

  try {
    if (parsed.broadFtsQuery) {
      titleRows = await db
        .select({
          title: items.title,
          categoryName: categories.name,
          itemType: items.itemType,
        })
        .from(sql`items_fts`)
        .innerJoin(items, eq(items.id, sql`items_fts.item_id`))
        .innerJoin(tenants, eq(tenants.id, items.tenantId))
        .leftJoin(categories, eq(categories.id, items.categoryId))
        .where(
          and(
            sql`items_fts MATCH ${parsed.broadFtsQuery}`,
            eq(items.status, "PUBLISHED"),
            eq(tenants.status, "ACTIVE")
          )
        )
        .orderBy(sql`bm25(items_fts) ASC`)
        .limit(safeLimit);
    }
  } catch {
    titleRows = [];
  }

  if (titleRows.length === 0) {
    const likePattern = `%${clean.toLowerCase()}%`;
    titleRows = await db
      .select({
        title: items.title,
        categoryName: categories.name,
        itemType: items.itemType,
      })
      .from(items)
      .innerJoin(tenants, eq(tenants.id, items.tenantId))
      .leftJoin(categories, eq(categories.id, items.categoryId))
      .where(
        and(
          eq(items.status, "PUBLISHED"),
          eq(tenants.status, "ACTIVE"),
          sql`lower(${items.title}) LIKE ${likePattern}`
        )
      )
      .limit(safeLimit);
  }

  const likeStore = `%${clean.toLowerCase()}%`;
  const matchingStores = await db
    .select({
      name: tenants.name,
      subdomain: tenants.subdomain,
      locationLabel: tenants.locationLabel,
    })
    .from(tenants)
    .where(and(eq(tenants.status, "ACTIVE"), sql`lower(${tenants.name}) LIKE ${likeStore}`))
    .limit(4);

  const uniqueTitles = Array.from(new Set(titleRows.map((r) => r.title))).slice(0, safeLimit);

  return {
    suggestions: uniqueTitles,
    stores: matchingStores,
  };
}
