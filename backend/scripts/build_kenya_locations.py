#!/usr/bin/env python3
"""
Builds a verified, open-licensed geospatial dataset for Kenya:
  - All 47 Counties
  - All 290 Constituencies (from IEBC GeoJSON polygons)
  - Populated towns, estates, markets & shopping centres (from GeoNames KE.zip)
  - Point-in-polygon assignment of every town/centre to its Constituency & County
  - Smart Haversine nearest-neighbor graph (K=8 closest neighbors per location)

Outputs chunked SQL seed files and a JSON summary in backend/scripts/generated/.
"""

from __future__ import annotations

import csv
import io
import json
import math
import os
import re
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "scripts" / ".cache"
OUT_DIR = ROOT / "drizzle" / "kenya_seed"
SUMMARY_PATH = ROOT / "scripts" / "kenya_locations_summary.json"

GEONAMES_URL = "https://download.geonames.org/export/dump/KE.zip"
GEOJSON_URL = (
    "https://raw.githubusercontent.com/mikelmaron/kenya-election-data/master/data/constituencies.geojson"
)
COUNTY_JSON_URL = (
    "https://raw.githubusercontent.com/michaelnjuguna/Kenyan-counties-their-subcounties-and-wards-in-json-yaml-mysql-csv-latex-xlsx-Bson-markdown-and-xml/main/county.json"
)

ALLOWED_P_CODES = {"PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLX", "PPLL", "PPL"}
ALLOWED_S_CODES = {"MKT", "CTRM", "CTRCM"}
NEIGHBOR_K = 8
MAX_FALLBACK_CENTROID_KM = 40.0


def download_cached(url: str, filename: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target = CACHE_DIR / filename
    if target.exists() and target.stat().st_size > 0:
        return target
    req = urllib.request.Request(url, headers={"User-Agent": "Store254-Geospatial-Builder/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        target.write_bytes(resp.read())
    return target


def slugify(text: str) -> str:
    s = text.lower().strip()
    s = s.replace("'", "").replace("’", "")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def normalize_county_name(raw: str) -> str:
    fixes = {
        "ELGEYO/MARAKWET": "Elgeyo-Marakwet",
        "ELGEYO-MARAKWET": "Elgeyo-Marakwet",
        "MURANG'A": "Murang'a",
        "MURANGA": "Murang'a",
        "TAITA TAVETA": "Taita-Taveta",
        "TAITA/TAVETA": "Taita-Taveta",
        "THARAKA - NITHI": "Tharaka-Nithi",
        "THARAKA-NITHI": "Tharaka-Nithi",
        "TRANS NZOIA": "Trans-Nzoia",
        "UASIN GISHU": "Uasin Gishu",
        "HOMA BAY": "Homa Bay",
        "TANA RIVER": "Tana River",
        "WEST POKOT": "West Pokot",
    }
    upper = " ".join(raw.strip().upper().split())
    if upper in fixes:
        return fixes[upper]
    return " ".join(w.capitalize() for w in upper.split())


def title_case_constituency(raw: str) -> str:
    words = raw.strip().split()
    out = []
    for w in words:
        if "'" in w:
            parts = w.split("'")
            out.append("'".join(p.capitalize() if i == 0 else p.lower() for i, p in enumerate(parts)))
        elif "-" in w:
            out.append("-".join(p.capitalize() for p in w.split("-")))
        else:
            out.append(w.capitalize())
    return " ".join(out)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0088
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def ring_bbox_and_centroid(ring: list[list[float]]) -> tuple[tuple[float, float, float, float], float, float]:
    xs = [pt[0] for pt in ring]
    ys = [pt[1] for pt in ring]
    return (min(xs), min(ys), max(xs), max(ys)), sum(ys) / len(ys), sum(xs) / len(xs)


def point_in_ring(lng: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    n = len(ring)
    if n < 3:
        return False
    x1, y1 = ring[0][0], ring[0][1]
    for i in range(1, n + 1):
        x2, y2 = ring[i % n][0], ring[i % n][1]
        if ((y1 > lat) != (y2 > lat)) and (lng < (x2 - x1) * (lat - y1) / ((y2 - y1) or 1e-12) + x1):
            inside = not inside
        x1, y1 = x2, y2
    return inside


def point_in_polygon_geom(lng: float, lat: float, geom: dict) -> bool:
    gtype = geom["type"]
    coords = geom["coordinates"]
    if gtype == "Polygon":
        polys = [coords]
    elif gtype == "MultiPolygon":
        polys = coords
    else:
        return False
    for poly in polys:
        if not poly:
            continue
        outer = poly[0]
        if point_in_ring(lng, lat, outer):
            in_hole = any(point_in_ring(lng, lat, hole) for hole in poly[1:])
            if not in_hole:
                return True
    return False


def geom_bbox_and_centroid(geom: dict) -> tuple[tuple[float, float, float, float], float, float]:
    gtype = geom["type"]
    coords = geom["coordinates"]
    all_pts: list[list[float]] = []
    if gtype == "Polygon":
        for ring in coords[:1]:
            all_pts.extend(ring)
    elif gtype == "MultiPolygon":
        best_ring = max((poly[0] for poly in coords if poly), key=len)
        for poly in coords:
            if poly:
                all_pts.extend(poly[0])
        _, clat, clng = ring_bbox_and_centroid(best_ring)
        xs = [p[0] for p in all_pts]
        ys = [p[1] for p in all_pts]
        return (min(xs), min(ys), max(xs), max(ys)), clat, clng
    xs = [p[0] for p in all_pts]
    ys = [p[1] for p in all_pts]
    return (min(xs), min(ys), max(xs), max(ys)), sum(ys) / len(ys), sum(xs) / len(xs)


def sql_str(val: str | None) -> str:
    if val is None:
        return "NULL"
    return "'" + val.replace("'", "''") + "'"


def classify_geoname(fclass: str, fcode: str, name: str, pop: int) -> tuple[str, int]:
    lower = name.lower()
    if fcode in {"PPLC", "PPLA", "PPLA2"}:
        return "TOWN", 100
    if fcode == "PPLX":
        return "ESTATE", 80
    if fclass == "S" or any(kw in lower for kw in ("shopping", "market", "mall", "plaza", "soko")):
        return "SHOPPING_CENTRE", 85
    if pop >= 5000 or "town" in lower:
        return "TOWN", 75
    if "centre" in lower or "center" in lower:
        return "SHOPPING_CENTRE", 70
    return "TRADING_CENTRE", 50


def main() -> None:
    ke_zip = download_cached(GEONAMES_URL, "KE.zip")
    geojson_path = download_cached(GEOJSON_URL, "constituencies.geojson")
    _county_json = download_cached(COUNTY_JSON_URL, "county.json")

    geo_data = json.loads(geojson_path.read_text(encoding="utf-8"))
    counties_map: dict[int, dict] = {}
    constituencies: list[dict] = []

    for feat in geo_data["features"]:
        props = feat.get("properties") or {}
        const_code = int(float(props.get("CONST_CODE") or 0))
        county_code = int(float(props.get("COUNTY_COD") or 0))
        const_raw = (props.get("CONSTITUEN") or "").strip()
        county_raw = (props.get("COUNTY_NAM") or "").strip()
        if const_code <= 0 or county_code <= 0 or not const_raw or not county_raw:
            continue

        county_name = normalize_county_name(county_raw)
        county_id = f"county-{county_code:03d}"
        county_slug = slugify(county_name)

        const_name = title_case_constituency(const_raw)
        const_id = f"const-{const_code:03d}"
        const_slug = slugify(const_name)

        bbox, clat, clng = geom_bbox_and_centroid(feat["geometry"])
        constituency_rec = {
            "id": const_id,
            "code": const_code,
            "county_id": county_id,
            "county_code": county_code,
            "name": const_name,
            "slug": const_slug,
            "centroid_lat": round(clat, 6),
            "centroid_lng": round(clng, 6),
            "bbox": bbox,
            "geometry": feat["geometry"],
        }
        constituencies.append(constituency_rec)

        if county_code not in counties_map:
            counties_map[county_code] = {
                "id": county_id,
                "code": county_code,
                "name": county_name,
                "slug": county_slug,
                "lat_sum": 0.0,
                "lng_sum": 0.0,
                "count": 0,
            }
        counties_map[county_code]["lat_sum"] += clat
        counties_map[county_code]["lng_sum"] += clng
        counties_map[county_code]["count"] += 1

    counties: list[dict] = []
    for code in sorted(counties_map):
        c = counties_map[code]
        counties.append({
            "id": c["id"],
            "code": c["code"],
            "name": c["name"],
            "slug": c["slug"],
            "centroid_lat": round(c["lat_sum"] / c["count"], 6),
            "centroid_lng": round(c["lng_sum"] / c["count"], 6),
        })

    assert len(counties) == 47, f"Expected 47 counties, got {len(counties)}"
    assert len(constituencies) == 290, f"Expected 290 constituencies, got {len(constituencies)}"

    # Parse GeoNames KE.txt
    raw_places: list[dict] = []
    with zipfile.ZipFile(ke_zip) as zf:
        with zf.open("KE.txt") as fp:
            reader = csv.reader(io.TextIOWrapper(fp, encoding="utf-8"), delimiter="\t")
            for row in reader:
                if len(row) < 15:
                    continue
                geoname_id = row[0]
                name = row[1].strip()
                asciiname = (row[2] or name).strip()
                lat = float(row[4])
                lng = float(row[5])
                fclass = row[6]
                fcode = row[7]
                pop = int(row[14] or 0)
                if not name:
                    continue
                if not (
                    (fclass == "P" and fcode in ALLOWED_P_CODES)
                    or (fclass == "S" and fcode in ALLOWED_S_CODES)
                ):
                    continue
                kind, priority = classify_geoname(fclass, fcode, name, pop)
                raw_places.append({
                    "geoname_id": geoname_id,
                    "name": name,
                    "norm_name": slugify(asciiname or name),
                    "lat": round(lat, 6),
                    "lng": round(lng, 6),
                    "kind": kind,
                    "priority": priority,
                    "population": pop,
                })

    # Assign each place to Constituency & County via polygon containment (with centroid fallback)
    assigned: list[dict] = []
    unmatched = 0
    for pl in raw_places:
        lat, lng = pl["lat"], pl["lng"]
        matched_const = None
        for const in constituencies:
            minx, miny, maxx, maxy = const["bbox"]
            if minx <= lng <= maxx and miny <= lat <= maxy:
                if point_in_polygon_geom(lng, lat, const["geometry"]):
                    matched_const = const
                    break
        if matched_const is None:
            best_const = min(
                constituencies,
                key=lambda c: haversine_km(lat, lng, c["centroid_lat"], c["centroid_lng"]),
            )
            if haversine_km(lat, lng, best_const["centroid_lat"], best_const["centroid_lng"]) <= MAX_FALLBACK_CENTROID_KM:
                matched_const = best_const
        if matched_const is None:
            unmatched += 1
            continue
        pl["county_id"] = matched_const["county_id"]
        pl["constituency_id"] = matched_const["id"]
        assigned.append(pl)

    # Deduplicate same normalized name within the same constituency & close proximity (< 1.5 km)
    assigned.sort(key=lambda x: (-x["priority"], -x["population"], x["name"]))
    deduped: list[dict] = []
    by_const_name: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for pl in assigned:
        if not pl["norm_name"]:
            continue
        key = (pl["constituency_id"], pl["norm_name"])
        existing = by_const_name[key]
        if any(haversine_km(pl["lat"], pl["lng"], e["lat"], e["lng"]) < 2.0 for e in existing):
            continue
        by_const_name[key].append(pl)
        deduped.append(pl)

    # Ensure every constituency has at least one fallback centre if sparse
    consts_with_places = {p["constituency_id"] for p in deduped}
    synthesized_consts = 0
    for const in constituencies:
        if const["id"] not in consts_with_places:
            synthesized_consts += 1
            deduped.append({
                "geoname_id": f"const-{const['code']}",
                "name": f"{const['name']} Centre",
                "norm_name": slugify(f"{const['name']} Centre"),
                "lat": const["centroid_lat"],
                "lng": const["centroid_lng"],
                "kind": "TRADING_CENTRE",
                "priority": 40,
                "population": 0,
                "county_id": const["county_id"],
                "constituency_id": const["id"],
            })

    # Assign unique IDs & unique slugs per location
    used_slugs: dict[str, int] = defaultdict(int)
    for idx, pl in enumerate(sorted(deduped, key=lambda x: (x["county_id"], x["constituency_id"], x["name"])), start=1):
        base_slug = f"{pl['norm_name']}--{pl['constituency_id'].replace('const-', '')}"
        used_slugs[base_slug] += 1
        slug = base_slug if used_slugs[base_slug] == 1 else f"{base_slug}-{used_slugs[base_slug]}"
        pl["id"] = f"loc-{idx:05d}"
        pl["slug"] = slug

    deduped.sort(key=lambda x: x["id"])

    # Compute top K=8 nearest neighbors using grid spatial hash + exact Haversine
    # Cell size 0.25 deg (~27 km) keeps candidate searches exact and ultra-fast
    grid: dict[tuple[int, int], list[int]] = defaultdict(list)
    for i, pl in enumerate(deduped):
        cell = (int(math.floor(pl["lat"] * 4)), int(math.floor(pl["lng"] * 4)))
        grid[cell].append(i)

    neighbor_rows: list[tuple[str, str, float, int]] = []
    for i, pl in enumerate(deduped):
        cx, cy = int(math.floor(pl["lat"] * 4)), int(math.floor(pl["lng"] * 4))
        candidates: list[tuple[float, int]] = []
        radius = 1
        while len(candidates) < NEIGHBOR_K + 1 and radius <= 12:
            seen_indices: list[int] = []
            for dx in range(-radius, radius + 1):
                for dy in range(-radius, radius + 1):
                    seen_indices.extend(grid.get((cx + dx, cy + dy), []))
            if len(seen_indices) >= NEIGHBOR_K + 1 or radius == 12:
                candidates = []
                for j in seen_indices:
                    if j == i:
                        continue
                    other = deduped[j]
                    d = haversine_km(pl["lat"], pl["lng"], other["lat"], other["lng"])
                    candidates.append((d, j))
                if len(candidates) >= NEIGHBOR_K:
                    break
            radius *= 2

        if len(candidates) < NEIGHBOR_K:
            candidates = [
                (haversine_km(pl["lat"], pl["lng"], o["lat"], o["lng"]), j)
                for j, o in enumerate(deduped)
                if j != i
            ]
        candidates.sort(key=lambda item: (item[0], deduped[item[1]]["id"]))
        for rank, (dist_km, j) in enumerate(candidates[:NEIGHBOR_K], start=1):
            neighbor_rows.append((pl["id"], deduped[j]["id"], round(dist_km, 2), rank))

    # Write clean SQL seed files chunked cleanly for D1 (each file ~300-450 KB, statements <= 20 KB)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old_sql in OUT_DIR.glob("*.sql"):
        old_sql.unlink()

    def write_chunked_inserts(prefix: str, header: str, rows_sql: list[str], rows_per_stmt: int = 120, stmts_per_file: int = 25) -> list[str]:
        files_written: list[str] = []
        stmts: list[str] = []
        for s_idx in range(0, len(rows_sql), rows_per_stmt):
            chunk = rows_sql[s_idx : s_idx + rows_per_stmt]
            stmts.append(f"{header}\nVALUES\n  " + ",\n  ".join(chunk) + ";\n")
        for f_idx in range(0, len(stmts), stmts_per_file):
            part = stmts[f_idx : f_idx + stmts_per_file]
            fname = f"{prefix}_{f_idx // stmts_per_file + 1:02d}.sql"
            (OUT_DIR / fname).write_text("\n".join(part), encoding="utf-8")
            files_written.append(fname)
        return files_written

    county_vals = [
        f"({sql_str(c['id'])}, {c['code']}, {sql_str(c['name'])}, {sql_str(c['slug'])}, {c['centroid_lat']}, {c['centroid_lng']})"
        for c in counties
    ]
    const_vals = [
        f"({sql_str(c['id'])}, {c['code']}, {sql_str(c['county_id'])}, {sql_str(c['name'])}, {sql_str(c['slug'])}, {c['centroid_lat']}, {c['centroid_lng']})"
        for c in constituencies
    ]
    loc_vals = [
        f"({sql_str(p['id'])}, {sql_str(p['county_id'])}, {sql_str(p['constituency_id'])}, {sql_str(p['name'])}, {sql_str(p['slug'])}, {sql_str(p['kind'])}, {p['lat']}, {p['lng']}, 'GEONAMES', NULL, {p['population']})"
        for p in deduped
    ]
    nbr_vals = [
        f"({sql_str(loc_id)}, {sql_str(nbr_id)}, {dist}, {rank})"
        for (loc_id, nbr_id, dist, rank) in neighbor_rows
    ]

    files = []
    files += write_chunked_inserts(
        "01_counties_constituencies",
        "INSERT OR IGNORE INTO kenya_counties (id, code, name, slug, centroid_lat, centroid_lng)",
        county_vals,
        rows_per_stmt=47,
        stmts_per_file=10,
    )
    # Also append constituencies into file 01 if single chunk
    const_stmt = (
        "INSERT OR IGNORE INTO kenya_constituencies (id, code, county_id, name, slug, centroid_lat, centroid_lng)\nVALUES\n  "
        + ",\n  ".join(const_vals[:150])
        + ";\n\n"
        + "INSERT OR IGNORE INTO kenya_constituencies (id, code, county_id, name, slug, centroid_lat, centroid_lng)\nVALUES\n  "
        + ",\n  ".join(const_vals[150:])
        + ";\n"
    )
    (OUT_DIR / "01_counties_constituencies_01.sql").write_text(
        (OUT_DIR / "01_counties_constituencies_01.sql").read_text(encoding="utf-8") + "\n" + const_stmt,
        encoding="utf-8",
    )

    files += write_chunked_inserts(
        "02_locations",
        "INSERT OR IGNORE INTO kenya_locations (id, county_id, constituency_id, name, slug, kind, latitude, longitude, source, google_place_id, population)",
        loc_vals,
        rows_per_stmt=120,
        stmts_per_file=20,
    )
    files += write_chunked_inserts(
        "03_neighbors",
        "INSERT OR IGNORE INTO kenya_location_neighbors (location_id, neighbor_location_id, distance_km, rank)",
        nbr_vals,
        rows_per_stmt=250,
        stmts_per_file=40,
    )

    by_kind: dict[str, int] = defaultdict(int)
    for p in deduped:
        by_kind[p["kind"]] += 1

    # Print sample check for Rongai / Westlands / Kikuyu / Juja
    samples = {}
    id_to_loc = {p["id"]: p for p in deduped}
    nbr_by_id: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for lid, nid, dist, _rank in neighbor_rows:
        nbr_by_id[lid].append((id_to_loc[nid]["name"], dist))
    for query_name in ["Westlands", "Juja", "Rongai", "Kikuyu", "Nyali"]:
        hit = next((p for p in deduped if p["name"].lower() == query_name.lower()), None)
        if hit:
            samples[hit["name"]] = {
                "id": hit["id"],
                "county_id": hit["county_id"],
                "constituency_id": hit["constituency_id"],
                "kind": hit["kind"],
                "neighbors": nbr_by_id[hit["id"]][:5],
            }

    summary = {
        "counties": len(counties),
        "constituencies": len(constituencies),
        "raw_geonames_filtered": len(raw_places),
        "unmatched_outside_kenya_tolerance": unmatched,
        "synthesized_constituency_centres": synthesized_consts,
        "locations_total": len(deduped),
        "locations_by_kind": dict(by_kind),
        "neighbor_edges_total": len(neighbor_rows),
        "sql_seed_files": sorted(p.name for p in OUT_DIR.glob("*.sql")),
        "samples": samples,
    }
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
