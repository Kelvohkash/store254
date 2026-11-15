import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedDir = path.join(__dirname, "..", "drizzle", "kenya_seed");
const outPath = path.join(__dirname, "..", "src", "modules", "platform", "kenya-static-data.ts");

function parseSqlTuples(sqlText) {
  const rows = [];
  const valIdx = sqlText.indexOf("VALUES");
  if (valIdx === -1) return rows;
  let i = valIdx + 6;
  const n = sqlText.length;

  while (i < n) {
    while (i < n && sqlText[i] !== "(") i++;
    if (i >= n) break;
    i++; // skip '('
    const fields = [];
    let cur = "";
    let inStr = false;
    while (i < n) {
      const ch = sqlText[i];
      if (ch === "'") {
        if (inStr && sqlText[i + 1] === "'") {
          cur += "'";
          i += 2;
          continue;
        }
        inStr = !inStr;
        i++;
        continue;
      }
      if (!inStr && ch === ",") {
        fields.push(cur.trim());
        cur = "";
        i++;
        continue;
      }
      if (!inStr && ch === ")") {
        fields.push(cur.trim());
        i++;
        break;
      }
      cur += ch;
      i++;
    }
    if (fields.length >= 6 && /^(county|const|loc)-/.test(fields[0])) {
      rows.push(fields);
    }
  }
  return rows;
}

const ccSql = fs.readFileSync(path.join(seedDir, "01_counties_constituencies_01.sql"), "utf8");
const [countiesBlock, ...constituenciesBlocks] = ccSql.split("INSERT OR IGNORE INTO kenya_constituencies");
const constituenciesBlock = constituenciesBlocks.join("\n");

const countyRows = parseSqlTuples(countiesBlock);
const counties = countyRows.map((r) => ({
  id: r[0],
  code: Number(r[1]),
  name: r[2],
  slug: r[3],
  centroidLat: Number(r[4]),
  centroidLng: Number(r[5]),
}));

const constituencyRows = parseSqlTuples(constituenciesBlock);
const constituencies = constituencyRows.map((r) => ({
  id: r[0],
  code: Number(r[1]),
  countyId: r[2],
  name: r[3],
  slug: r[4],
  centroidLat: Number(r[5]),
  centroidLng: Number(r[6]),
}));

const KINDS = ["TRADING_CENTRE", "TOWN", "SHOPPING_CENTRE", "ESTATE", "CUSTOM"];
const locFiles = fs
  .readdirSync(seedDir)
  .filter((f) => f.startsWith("02_locations_") && f.endsWith(".sql"))
  .sort();

const compactLocations = [];
for (const file of locFiles) {
  const sql = fs.readFileSync(path.join(seedDir, file), "utf8");
  const rows = parseSqlTuples(sql);
  for (const r of rows) {
    // (id, county_id, constituency_id, name, slug, kind, latitude, longitude, source, google_place_id, population)
    const id = r[0];
    const countyNum = Number(r[1].replace("county-", ""));
    const constNum = Number(r[2].replace("const-", ""));
    const name = r[3];
    const kindIdx = Math.max(0, KINDS.indexOf(r[5]));
    const lat = Number(Number(r[6]).toFixed(5));
    const lng = Number(Number(r[7]).toFixed(5));
    const pop = Number(r[10]) || 0;
    compactLocations.push([id, countyNum, constNum, name, kindIdx, lat, lng, pop]);
  }
}

const locIndexById = new Map();
for (let i = 0; i < compactLocations.length; i++) {
  locIndexById.set(compactLocations[i][0], i);
}

const nbrFiles = fs
  .readdirSync(seedDir)
  .filter((f) => f.startsWith("03_neighbors_") && f.endsWith(".sql"))
  .sort();

const compactNeighbors = Array.from({ length: compactLocations.length }, () => []);
const nbrTupleRe = /\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*([-\d.]+)\s*,\s*(\d+)\s*\)/g;
for (const file of nbrFiles) {
  const sql = fs.readFileSync(path.join(seedDir, file), "utf8");
  let m;
  while ((m = nbrTupleRe.exec(sql)) !== null) {
    const [, uId, vId, distStr] = m;
    const uIdx = locIndexById.get(uId);
    const vIdx = locIndexById.get(vId);
    if (uIdx !== undefined && vIdx !== undefined) {
      compactNeighbors[uIdx].push(vIdx, Math.round(parseFloat(distStr) * 100));
    }
  }
}

const tsContent = `// AUTO-GENERATED from backend/drizzle/kenya_seed — DO NOT EDIT MANUALLY
import type { KenyaCounty, KenyaConstituency } from "../../db/schema";

export interface StaticKenyaLocation {
  id: string;
  name: string;
  slug: string;
  kind: "TOWN" | "SHOPPING_CENTRE" | "ESTATE" | "TRADING_CENTRE" | "CUSTOM";
  countyId: string;
  countyName: string;
  constituencyId: string;
  constituencyName: string;
  latitude: number;
  longitude: number;
  population: number;
  source: "GEONAMES" | "GOOGLE_PLACES" | "MERCHANT_CUSTOM";
}

export const STATIC_KENYA_COUNTIES: KenyaCounty[] = ${JSON.stringify(counties)};

export const STATIC_KENYA_CONSTITUENCIES: KenyaConstituency[] = ${JSON.stringify(constituencies)};

const KINDS: StaticKenyaLocation["kind"][] = ["TRADING_CENTRE", "TOWN", "SHOPPING_CENTRE", "ESTATE", "CUSTOM"];

type CompactLocTuple = [string, number, number, string, number, number, number, number];

const RAW_LOCATIONS: CompactLocTuple[] = ${JSON.stringify(compactLocations)};
// Flattened pairs [neighborIdx, distKmTimes100, ...] parallel to RAW_LOCATIONS (human-brain OSM road graph).
const RAW_NEIGHBORS: number[][] = ${JSON.stringify(compactNeighbors)};

export const STATIC_KENYA_STATS = (() => {
  const byKind: Record<string, number> = {
    TRADING_CENTRE: 0,
    TOWN: 0,
    SHOPPING_CENTRE: 0,
    ESTATE: 0,
    CUSTOM: 0,
  };
  for (let i = 0; i < RAW_LOCATIONS.length; i++) {
    const k = KINDS[RAW_LOCATIONS[i][4]] || "TRADING_CENTRE";
    byKind[k] = (byKind[k] || 0) + 1;
  }
  return {
    counties: STATIC_KENYA_COUNTIES.length,
    constituencies: STATIC_KENYA_CONSTITUENCIES.length,
    locations: RAW_LOCATIONS.length,
    neighbors: RAW_LOCATIONS.length * 8,
    byKind,
  };
})();

export function getStaticLocationStats() {
  return STATIC_KENYA_STATS;
}

let _allLocations: StaticKenyaLocation[] | null = null;
let _byId: Map<string, StaticKenyaLocation> | null = null;
let _locIndexById: Map<string, number> | null = null;
let _byCountyId: Map<string, StaticKenyaLocation[]> | null = null;

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

function ensureHydrated() {
  if (_allLocations && _byId && _byCountyId) return;
  const countyMap = new Map<string, KenyaCounty>();
  for (const c of STATIC_KENYA_COUNTIES) countyMap.set(c.id, c);
  const constMap = new Map<string, KenyaConstituency>();
  for (const cs of STATIC_KENYA_CONSTITUENCIES) constMap.set(cs.id, cs);

  _allLocations = new Array(RAW_LOCATIONS.length);
  _locIndexById = new Map();
  _byId = new Map();
  _byCountyId = new Map();

  for (let i = 0; i < RAW_LOCATIONS.length; i++) {
    const [id, cNum, csNum, name, kIdx, latitude, longitude, population] = RAW_LOCATIONS[i];
    const countyId = "county-" + pad3(cNum);
    const constituencyId = "const-" + pad3(csNum);
    const county = countyMap.get(countyId);
    const constituency = constMap.get(constituencyId);
    const kind = KINDS[kIdx] || "TRADING_CENTRE";
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") + "--" + pad3(csNum);
    const loc: StaticKenyaLocation = {
      id,
      name,
      slug,
      kind,
      countyId,
      countyName: county?.name || "",
      constituencyId,
      constituencyName: constituency?.name || "",
      latitude,
      longitude,
      population,
      source: "GEONAMES",
    };
    _allLocations[i] = loc;
    _byId.set(id, loc);
    _locIndexById!.set(id, i);
    let bucket = _byCountyId.get(countyId);
    if (!bucket) {
      bucket = [];
      _byCountyId.set(countyId, bucket);
    }
    bucket.push(loc);
  }

  const kindRank = (k: string) => (k === "TOWN" ? 1 : k === "SHOPPING_CENTRE" ? 2 : k === "ESTATE" ? 3 : 4);
  const sortFn = (a: StaticKenyaLocation, b: StaticKenyaLocation) => {
    const kr = kindRank(a.kind) - kindRank(b.kind);
    if (kr !== 0) return kr;
    if (b.population !== a.population) return b.population - a.population;
    return a.name.localeCompare(b.name);
  };
  _allLocations.sort(sortFn);
  for (const bucket of _byCountyId.values()) {
    bucket.sort(sortFn);
  }
}

export function getStaticCounties(): KenyaCounty[] {
  return STATIC_KENYA_COUNTIES;
}

export function getStaticCountyById(countyId: string): KenyaCounty | undefined {
  return STATIC_KENYA_COUNTIES.find((c) => c.id === countyId);
}

export function getStaticConstituencies(countyId?: string): KenyaConstituency[] {
  if (!countyId) return STATIC_KENYA_CONSTITUENCIES;
  return STATIC_KENYA_CONSTITUENCIES.filter((c) => c.countyId === countyId);
}

export function getStaticLocationById(locationId: string): StaticKenyaLocation | undefined {
  ensureHydrated();
  return _byId!.get(locationId);
}

export function searchStaticTowns(params: {
  countyId?: string;
  constituencyId?: string;
  q?: string;
  limit?: number;
}): StaticKenyaLocation[] {
  ensureHydrated();
  const limit = Math.min(Math.max(params.limit || 25, 1), 100);
  const pool = params.countyId
    ? (_byCountyId!.get(params.countyId) || [])
    : _allLocations!;

  const filteredPool = params.constituencyId
    ? pool.filter((l) => l.constituencyId === params.constituencyId)
    : pool;

  const qRaw = (params.q || "").trim().toLowerCase();
  if (!qRaw) {
    return filteredPool.slice(0, limit);
  }

  const qClean = qRaw.replace(/['’]/g, "");
  const prefixMatches: StaticKenyaLocation[] = [];
  const substringMatches: StaticKenyaLocation[] = [];

  for (const loc of filteredPool) {
    const nameLower = loc.name.toLowerCase();
    const nameClean = nameLower.replace(/['’]/g, "");
    const constLower = loc.constituencyName.toLowerCase();
    if (nameLower.startsWith(qRaw) || nameClean.startsWith(qClean)) {
      prefixMatches.push(loc);
      if (prefixMatches.length >= limit) break;
    } else if (
      nameLower.includes(qRaw) ||
      nameClean.includes(qClean) ||
      constLower.includes(qRaw)
    ) {
      if (substringMatches.length < limit) {
        substringMatches.push(loc);
      }
    }
  }

  return [...prefixMatches, ...substringMatches].slice(0, limit);
}

export function findStaticNearestLocation(lat: number, lng: number): (StaticKenyaLocation & { distanceKm: number }) | null {
  ensureHydrated();
  if (!_allLocations || _allLocations.length === 0) return null;
  const r = 6371.0088;
  const p1 = (lat * Math.PI) / 180;
  const cosP1 = Math.cos(p1);

  let best: StaticKenyaLocation | null = null;
  let bestDistKm = Infinity;

  for (let i = 0; i < _allLocations.length; i++) {
    const loc = _allLocations[i];
    const dLat = loc.latitude - lat;
    const dLng = loc.longitude - lng;
    if (Math.abs(dLat) > 2.5 || Math.abs(dLng) > 2.5) continue;
    const p2 = (loc.latitude * Math.PI) / 180;
    const dp = (dLat * Math.PI) / 180;
    const dl = (dLng * Math.PI) / 180;
    const a =
      Math.sin(dp / 2) * Math.sin(dp / 2) +
      cosP1 * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    const distKm = 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
    if (distKm < bestDistKm) {
      bestDistKm = distKm;
      best = loc;
    }
  }

  if (!best) {
    best = _allLocations[0];
    bestDistKm = 0;
  }

  return {
    ...best,
    distanceKm: Number(bestDistKm.toFixed(2)),
  };
}

const WARD_NAME_RE = /\\bward$/i;
const LOW_HUB_SIGNAL_RE = /\\b(sub[- ]?location|location|plantation|ranch|farm|forest|division)\\b/i;

export function findStaticNeighborsForLocation(
  locationId: string,
  limit = 8
): Array<StaticKenyaLocation & { distanceKm: number; rank: number }> {
  ensureHydrated();
  const originIdx = _locIndexById!.get(locationId);
  if (originIdx === undefined || !_allLocations) return [];
  const origin = _allLocations[originIdx];
  const safeLimit = Math.min(Math.max(limit, 1), 24);
  const packed = RAW_NEIGHBORS[originIdx] || [];
  const out: Array<StaticKenyaLocation & { distanceKm: number; rank: number }> = [];
  const seen = new Set<string>([origin.id]);

  // 1. Primary Ring-1 road-connected hubs (precomputed via OSM Kenya highway network)
  for (let i = 0; i < packed.length && out.length < safeLimit; i += 2) {
    const nbrId = RAW_LOCATIONS[packed[i]]?.[0];
    const nbr = nbrId ? _byId!.get(nbrId) : undefined;
    if (!nbr || seen.has(nbr.id) || nbr.id.startsWith("loc-ward-") || WARD_NAME_RE.test(nbr.name)) {
      continue;
    }
    seen.add(nbr.id);
    out.push({
      ...nbr,
      distanceKm: Math.round(packed[i + 1]) / 100,
      rank: out.length + 1,
    });
  }

  // 2. Extended Ring-2 horizon (limit > 8): walk 2nd-hop connected road hubs sorted by road travel km
  if (out.length < safeLimit && out.length > 0) {
    const hop2: Array<{ loc: StaticKenyaLocation; distKm: number }> = [];
    for (let i = 0; i < packed.length; i += 2) {
      const hop1Idx = packed[i];
      const hop1Dist = packed[i + 1] / 100;
      const hop2Packed = RAW_NEIGHBORS[hop1Idx] || [];
      for (let j = 0; j < hop2Packed.length; j += 2) {
        const hop2Id = RAW_LOCATIONS[hop2Packed[j]]?.[0];
        const hop2Loc = hop2Id ? _byId!.get(hop2Id) : undefined;
        if (
          !hop2Loc ||
          seen.has(hop2Loc.id) ||
          hop2Loc.id.startsWith("loc-ward-") ||
          WARD_NAME_RE.test(hop2Loc.name)
        ) {
          continue;
        }
        hop2.push({
          loc: hop2Loc,
          distKm: Math.round((hop1Dist + hop2Packed[j + 1] / 100) * 100) / 100,
        });
      }
    }
    hop2.sort((a, b) => a.distKm - b.distKm || a.loc.id.localeCompare(b.loc.id));
    for (const item of hop2) {
      if (out.length >= safeLimit) break;
      if (seen.has(item.loc.id)) continue;
      seen.add(item.loc.id);
      out.push({
        ...item.loc,
        distanceKm: item.distKm,
        rank: out.length + 1,
      });
    }
  }

  return out;
}
`;

fs.writeFileSync(outPath, tsContent, "utf8");
console.log(
  `Generated ${outPath}: ${counties.length} counties, ${constituencies.length} constituencies, ${compactLocations.length} locations (${(tsContent.length / 1024).toFixed(1)} KB)`
);
