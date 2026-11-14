#!/usr/bin/env python3
"""
Builds a comprehensive, open-licensed geospatial dataset for Kenya:
  - All 47 Counties
  - All 290 Constituencies (from IEBC GeoJSON polygons)
  - 18,000+ Towns, Wards, Estates, Villages, Sub-Locations, Markets & Shopping Centres
    combining:
      1. GeoNames KE.zip (PPL*, MKT/CTRM/CTRCM/EST, LCTY/AREA, ADMD)
      2. OpenStreetMap Kenya via Geofabrik HTTP Range extraction
         (places, place polygons, marketplaces, malls & shopping centres)
      3. IEBC County Assembly Wards GeoJSON (~1,437 wards)
  - Smart Haversine nearest-neighbor graph (K=8 closest neighbors per location)

Outputs chunked SQL seed files in backend/drizzle/kenya_seed/ and summary JSON.
"""

from __future__ import annotations

import csv
import io
import json
import math
import re
import struct
import urllib.request
import zipfile
import zlib
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
WARDS_URL = (
    "https://raw.githubusercontent.com/mikelmaron/kenya-election-data/master/data/wards.geojson"
)
GEOFABRIK_SHP_ZIP_URL = "https://download.geofabrik.de/africa/kenya-latest-free.shp.zip"

GEONAMES_P_CODES = {"PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLX", "PPLL", "PPL"}
GEONAMES_S_CODES = {"MKT", "CTRM", "CTRCM", "EST"}
GEONAMES_L_CODES = {"LCTY", "AREA"}
GEONAMES_A_CODES = {"ADMD"}

OSM_PLACE_CLASSES = {"city", "town", "suburb", "quarter", "neighbourhood", "village", "hamlet", "locality", "island"}
OSM_CENTRE_CLASSES = {"marketplace", "mall", "department_store"}
SHOPPING_RE = re.compile(r"\b(shopping\s*cent(?:re|er)|shopping\s*mall|mall|plaza|arcade|market|soko|trading\s*cent(?:re|er))\b", re.I)
SHOPPING_KEYWORDS = ("shopping", "market", "mall", "plaza", "arcade", "soko", "centre", "center", "complex", "stage")

NEIGHBOR_K = 8
MAX_FALLBACK_CENTROID_KM = 40.0


def download_cached(url: str, filename: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target = CACHE_DIR / filename
    if target.exists() and target.stat().st_size > 0:
        return target
    req = urllib.request.Request(url, headers={"User-Agent": "Store254-Geospatial-Builder/1.0"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        target.write_bytes(resp.read())
    return target


def fetch_range(url: str, start: int, end: int) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Store254-Geospatial-Builder/1.0", "Range": f"bytes={start}-{end}"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def ensure_geofabrik_osm_members(member_names: list[str]) -> dict[str, bytes]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    result: dict[str, bytes] = {}
    missing = []
    for name in member_names:
        cached = CACHE_DIR / name
        if cached.exists() and cached.stat().st_size > 0:
            result[name] = cached.read_bytes()
        else:
            missing.append(name)

    if not missing:
        return result

    req = urllib.request.Request(
        GEOFABRIK_SHP_ZIP_URL,
        method="HEAD",
        headers={"User-Agent": "Store254-Geospatial-Builder/1.0"},
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        total_size = int(r.headers["Content-Length"])

    tail = fetch_range(GEOFABRIK_SHP_ZIP_URL, max(0, total_size - 65536), total_size - 1)
    eocd = tail.rfind(b"PK\x05\x06")
    if eocd == -1:
        raise RuntimeError("ZIP EOCD signature not found in Geofabrik archive")
    cd_size, cd_off = struct.unpack("<II", tail[eocd + 12 : eocd + 20])
    cd = fetch_range(GEOFABRIK_SHP_ZIP_URL, cd_off, cd_off + cd_size - 1)

    entries: dict[str, tuple[int, int, int, int]] = {}
    pos = 0
    while pos < len(cd):
        if cd[pos : pos + 4] != b"PK\x01\x02":
            break
        method = struct.unpack("<H", cd[pos + 10 : pos + 12])[0]
        comp_sz, uncomp_sz, nlen, xlen, clen = struct.unpack("<IIHHH", cd[pos + 20 : pos + 34])
        lhoff = struct.unpack("<I", cd[pos + 42 : pos + 46])[0]
        ename = cd[pos + 46 : pos + 46 + nlen].decode("utf-8", errors="replace")
        entries[ename] = (method, comp_sz, uncomp_sz, lhoff)
        pos += 46 + nlen + xlen + clen

    for name in missing:
        method, comp_sz, _uncomp_sz, lhoff = entries[name]
        hdr = fetch_range(GEOFABRIK_SHP_ZIP_URL, lhoff, lhoff + 30 + len(name) + 64)
        fnlen, exlen = struct.unpack("<HH", hdr[26:30])
        data_start = lhoff + 30 + fnlen + exlen
        raw = fetch_range(GEOFABRIK_SHP_ZIP_URL, data_start, data_start + comp_sz - 1)
        data = raw if method == 0 else zlib.decompress(raw, -zlib.MAX_WBITS)
        (CACHE_DIR / name).write_bytes(data)
        result[name] = data

    return result


def parse_dbf_records(dbf_bytes: bytes) -> list[dict[str, str]]:
    num_rec, hdr_len, rec_len = struct.unpack("<IHH", dbf_bytes[4:12])
    fields: list[tuple[str, int]] = []
    p = 32
    while p < len(dbf_bytes) and dbf_bytes[p] != 0x0D:
        fname = dbf_bytes[p : p + 11].split(b"\x00", 1)[0].decode("ascii", errors="ignore")
        flen = dbf_bytes[p + 16]
        fields.append((fname, flen))
        p += 32

    records: list[dict[str, str]] = []
    for i in range(num_rec):
        rec = dbf_bytes[hdr_len + i * rec_len : hdr_len + (i + 1) * rec_len]
        if not rec or rec[0] == 0x2A:
            records.append({})
            continue
        off = 1
        row: dict[str, str] = {}
        for fn, fl in fields:
            row[fn] = rec[off : off + fl].decode("utf-8", errors="replace").strip()
            off += fl
        records.append(row)
    return records


def parse_shp_centroids(shp_bytes: bytes) -> list[tuple[float, float] | None]:
    centroids: list[tuple[float, float] | None] = []
    pos = 100
    total = len(shp_bytes)
    while pos + 8 <= total:
        _rec_num, content_words = struct.unpack(">II", shp_bytes[pos : pos + 8])
        content_len = content_words * 2
        pos += 8
        rec = shp_bytes[pos : pos + content_len]
        pos += content_len
        if len(rec) < 4:
            centroids.append(None)
            continue
        stype = struct.unpack("<i", rec[:4])[0]
        if stype == 0:
            centroids.append(None)
        elif stype in (1, 11, 21) and len(rec) >= 20:
            x, y = struct.unpack("<dd", rec[4:20])
            centroids.append((round(y, 6), round(x, 6)))
        elif stype in (3, 5, 8, 13, 15, 18, 23, 25, 28) and len(rec) >= 36:
            xmin, ymin, xmax, ymax = struct.unpack("<dddd", rec[4:36])
            centroids.append((round((ymin + ymax) / 2.0, 6), round((xmin + xmax) / 2.0, 6)))
        else:
            centroids.append(None)
    return centroids


def slugify(text: str) -> str:
    s = text.lower().strip()
    s = s.replace("'", "").replace("’", "")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def dedup_key_name(name: str) -> str:
    cleaned = re.sub(
        r"\b(sub[- ]?location|location|ward|town|estate|trading\s*cent(?:re|er)|trade\s*cent(?:re|er)|shopping\s*cent(?:re|er)|shopping\s*mall|cent(?:re|er)|market|soko|stage|junction|village)\b",
        "",
        name,
        flags=re.I,
    )
    s = slugify(cleaned)
    return s or slugify(name)


def name_cleanliness_bonus(name: str) -> int:
    lower = name.lower()
    if re.search(r"\b(sub[- ]?location|location)\b", lower):
        return -30
    if re.search(r"\bward\b", lower):
        return -20
    if re.search(r"\b(shopping\s*cent(?:re|er)|trading\s*cent(?:re|er)|trade\s*cent(?:re|er)|cent(?:re|er))\b", lower):
        return -10
    return 0


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


def title_case_label(raw: str) -> str:
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
        if point_in_ring(lng, lat, poly[0]):
            if not any(point_in_ring(lng, lat, hole) for hole in poly[1:]):
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
        return "TOWN", 120
    if fcode == "PPLX":
        return "ESTATE", 95
    if fcode in {"MKT", "CTRM", "CTRCM"} or any(kw in lower for kw in ("shopping", "market", "mall", "plaza", "soko")):
        return "SHOPPING_CENTRE", 100
    if fcode == "EST" or "estate" in lower:
        return "ESTATE", 85
    if pop >= 5000 or "town" in lower:
        return "TOWN", 90
    if fclass == "P":
        return "TRADING_CENTRE", 75
    if fclass == "A":
        return "TRADING_CENTRE", 60
    return "TRADING_CENTRE", 55


def classify_osm_place(fclass: str, name: str, pop: int) -> tuple[str, int]:
    lower = name.lower()
    if fclass in {"city", "national_capital", "town"} or pop >= 5000:
        return "TOWN", 115
    if fclass in {"suburb", "quarter", "neighbourhood"} or "estate" in lower:
        return "ESTATE", 90
    if any(kw in lower for kw in SHOPPING_KEYWORDS):
        return "SHOPPING_CENTRE", 85
    if fclass == "village":
        return "TRADING_CENTRE", 70
    return "TRADING_CENTRE", 60


def clean_display_name(name: str) -> str:
    name = " ".join(name.split())
    return name


def main() -> None:
    ke_zip = download_cached(GEONAMES_URL, "KE.zip")
    geojson_path = download_cached(GEOJSON_URL, "constituencies.geojson")
    wards_path = download_cached(WARDS_URL, "wards.geojson")

    osm_files = [
        "gis_osm_places_free_1.dbf",
        "gis_osm_places_free_1.shp",
        "gis_osm_places_a_free_1.dbf",
        "gis_osm_places_a_free_1.shp",
        "gis_osm_pois_free_1.dbf",
        "gis_osm_pois_free_1.shp",
        "gis_osm_pois_a_free_1.dbf",
        "gis_osm_pois_a_free_1.shp",
    ]
    osm_bytes = ensure_geofabrik_osm_members(osm_files)

    geo_data = json.loads(geojson_path.read_text(encoding="utf-8"))
    counties_map: dict[int, dict] = {}
    constituencies: list[dict] = []
    const_by_code: dict[int, dict] = {}

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

        const_name = title_case_label(const_raw)
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
        const_by_code[const_code] = constituency_rec

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

    candidates: list[dict] = []

    # 1. GeoNames KE.txt (Populated places, Shopping/Market structures, Localities/Areas, Sub-Locations)
    geonames_kept = 0
    with zipfile.ZipFile(ke_zip) as zf:
        with zf.open("KE.txt") as fp:
            reader = csv.reader(io.TextIOWrapper(fp, encoding="utf-8"), delimiter="\t")
            for row in reader:
                if len(row) < 15:
                    continue
                geoname_id = row[0]
                name = clean_display_name(row[1])
                if not name or len(name) < 2:
                    continue
                lat = round(float(row[4]), 6)
                lng = round(float(row[5]), 6)
                fclass = row[6]
                fcode = row[7]
                pop = int(row[14] or 0)
                if not (
                    (fclass == "P" and fcode in GEONAMES_P_CODES)
                    or (fclass == "S" and fcode in GEONAMES_S_CODES)
                    or (fclass == "L" and fcode in GEONAMES_L_CODES)
                    or (fclass == "A" and fcode in GEONAMES_A_CODES)
                ):
                    continue
                if fclass == "A" and any(skip in name.lower() for skip in ("district", "province", "republic", "division")):
                    continue
                kind, priority = classify_geoname(fclass, fcode, name, pop)
                candidates.append({
                    "id": f"loc-gn-{geoname_id}",
                    "origin": "geonames",
                    "name": name,
                    "dedup_key": dedup_key_name(name),
                    "norm_slug": slugify(name),
                    "lat": lat,
                    "lng": lng,
                    "kind": kind,
                    "priority": priority,
                    "population": pop,
                })
                geonames_kept += 1

    # 2. OpenStreetMap Places + Commercial Centres via Geofabrik HTTP Range extraction
    osm_places_kept = 0
    osm_centres_kept = 0
    seen_osm_ids: set[str] = set()

    def ingest_osm_layer(prefix: str, mode: str) -> None:
        nonlocal osm_places_kept, osm_centres_kept
        records = parse_dbf_records(osm_bytes[f"{prefix}.dbf"])
        coords = parse_shp_centroids(osm_bytes[f"{prefix}.shp"])
        for row, pt in zip(records, coords):
            if not row or pt is None:
                continue
            osm_id = (row.get("osm_id") or "").strip()
            name = clean_display_name(row.get("name") or "")
            fclass = (row.get("fclass") or "").strip()
            if not osm_id or not name or len(name) < 2:
                continue
            if osm_id in seen_osm_ids:
                continue
            lat, lng = pt
            if not (-5.2 <= lat <= 5.6 and 33.5 <= lng <= 42.2):
                continue

            if mode == "place":
                if fclass not in OSM_PLACE_CLASSES:
                    continue
                pop = int(row.get("population") or 0) if str(row.get("population") or "").isdigit() else 0
                kind, priority = classify_osm_place(fclass, name, pop)
                osm_places_kept += 1
            else:
                lower = name.lower()
                is_direct_centre = fclass in OSM_CENTRE_CLASSES
                is_named_shopping = (
                    fclass in {"commercial", "retail", "community_centre"}
                    and bool(SHOPPING_RE.search(lower))
                )
                if not (is_direct_centre or is_named_shopping):
                    continue
                pop = 0
                kind = "SHOPPING_CENTRE"
                priority = 105 if fclass in {"marketplace", "mall"} else 88
                osm_centres_kept += 1

            seen_osm_ids.add(osm_id)
            candidates.append({
                "id": f"loc-osm-{osm_id}",
                "origin": "osm",
                "name": name,
                "dedup_key": dedup_key_name(name),
                "norm_slug": slugify(name),
                "lat": lat,
                "lng": lng,
                "kind": kind,
                "priority": priority,
                "population": pop,
            })

    ingest_osm_layer("gis_osm_places_free_1", "place")
    ingest_osm_layer("gis_osm_places_a_free_1", "place")
    ingest_osm_layer("gis_osm_pois_free_1", "poi")
    ingest_osm_layer("gis_osm_pois_a_free_1", "poi")

    # 3. IEBC County Assembly Wards (every official ward in Kenya)
    wards_data = json.loads(wards_path.read_text(encoding="utf-8"))
    wards_kept = 0
    seen_ward_keys: set[tuple[str, str]] = set()
    for feat in wards_data["features"]:
        props = feat.get("properties") or {}
        const_code = int(float(props.get("CONST_CODE") or 0))
        ward_code = int(float(props.get("COUNTY_ASS") or 0))
        ward_raw = (props.get("COUNTY_A_1") or "").strip()
        if const_code <= 0 or not ward_raw or const_code not in const_by_code:
            continue
        const_rec = const_by_code[const_code]
        ward_clean = title_case_label(ward_raw)
        if not ward_clean:
            continue
        wkey = (const_rec["id"], slugify(ward_clean))
        if wkey in seen_ward_keys:
            continue
        seen_ward_keys.add(wkey)
        _wbbox, wlat, wlng = geom_bbox_and_centroid(feat["geometry"])
        display_ward = ward_clean if ward_clean.lower().endswith("ward") else f"{ward_clean} Ward"
        candidates.append({
            "id": f"loc-ward-{const_code:03d}-{ward_code or wards_kept:04d}",
            "origin": "iebc_ward",
            "name": display_ward,
            "dedup_key": dedup_key_name(ward_clean),
            "norm_slug": slugify(display_ward),
            "lat": round(wlat, 6),
            "lng": round(wlng, 6),
            "kind": "TOWN",
            "priority": 108,
            "population": 1000,
            "county_id": const_rec["county_id"],
            "constituency_id": const_rec["id"],
        })
        wards_kept += 1

    # Assign Constituency & County via polygon containment (with centroid fallback)
    assigned: list[dict] = []
    unmatched = 0
    for pl in candidates:
        if pl.get("county_id") and pl.get("constituency_id"):
            assigned.append(pl)
            continue
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

    # Deduplicate same normalized base name within 8 km across the entire County
    # (prevents Sub-Location / Centre / Market / border-straddling constituency duplicates)
    assigned.sort(
        key=lambda x: (
            -(x["priority"] + name_cleanliness_bonus(x["name"])),
            -x["population"],
            len(x["name"]),
            x["name"],
        )
    )
    deduped: list[dict] = []
    by_county_key: dict[tuple[str, str], list[dict]] = defaultdict(list)

    for pl in assigned:
        if not pl["norm_slug"] or not pl["dedup_key"]:
            continue
        key = (pl["county_id"], pl["dedup_key"])
        existing = by_county_key[key]
        if any(e["constituency_id"] == pl["constituency_id"] for e in existing):
            continue
        if any(haversine_km(pl["lat"], pl["lng"], e["lat"], e["lng"]) < 12.0 for e in existing):
            continue
        if any(pl["norm_slug"] == e["norm_slug"] and haversine_km(pl["lat"], pl["lng"], e["lat"], e["lng"]) < 15.0 for e in existing):
            continue
        by_county_key[key].append(pl)
        deduped.append(pl)

    # Assign unique IDs & unique slugs cleanly
    used_ids: set[str] = set()
    used_slugs: dict[str, int] = defaultdict(int)
    for idx, pl in enumerate(sorted(deduped, key=lambda x: (x["county_id"], x["constituency_id"], x["name"], x["id"])), start=1):
        if pl["id"] in used_ids:
            pl["id"] = f"{pl['id']}-{idx}"
        used_ids.add(pl["id"])

        base_slug = f"{pl['norm_slug']}--{pl['constituency_id'].replace('const-', '')}"
        used_slugs[base_slug] += 1
        pl["slug"] = base_slug if used_slugs[base_slug] == 1 else f"{base_slug}-{used_slugs[base_slug]}"

    deduped.sort(key=lambda x: (x["county_id"], x["constituency_id"], x["id"]))

    # Compute top K=8 nearest neighbors via grid spatial hash + exact Haversine
    grid: dict[tuple[int, int], list[int]] = defaultdict(list)
    for i, pl in enumerate(deduped):
        cell = (int(math.floor(pl["lat"] * 4)), int(math.floor(pl["lng"] * 4)))
        grid[cell].append(i)

    neighbor_rows: list[tuple[str, str, float, int]] = []
    for i, pl in enumerate(deduped):
        cx, cy = int(math.floor(pl["lat"] * 4)), int(math.floor(pl["lng"] * 4))
        nbr_candidates: list[tuple[float, int]] = []
        radius = 1
        while len(nbr_candidates) < NEIGHBOR_K + 1 and radius <= 12:
            seen_indices: list[int] = []
            for dx in range(-radius, radius + 1):
                for dy in range(-radius, radius + 1):
                    seen_indices.extend(grid.get((cx + dx, cy + dy), []))
            if len(seen_indices) >= NEIGHBOR_K + 1 or radius == 12:
                nbr_candidates = []
                for j in seen_indices:
                    if j == i:
                        continue
                    other = deduped[j]
                    d = haversine_km(pl["lat"], pl["lng"], other["lat"], other["lng"])
                    nbr_candidates.append((d, j))
                if len(nbr_candidates) >= NEIGHBOR_K:
                    break
            radius *= 2

        if len(nbr_candidates) < NEIGHBOR_K:
            nbr_candidates = [
                (haversine_km(pl["lat"], pl["lng"], o["lat"], o["lng"]), j)
                for j, o in enumerate(deduped)
                if j != i
            ]
        nbr_candidates.sort(key=lambda item: (item[0], deduped[item[1]]["id"]))
        for rank, (dist_km, j) in enumerate(nbr_candidates[:NEIGHBOR_K], start=1):
            neighbor_rows.append((pl["id"], deduped[j]["id"], round(dist_km, 2), rank))

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

    # Reset stale location rows before reloading unified multi-source dataset
    (OUT_DIR / "00_reset_locations.sql").write_text(
        "DELETE FROM kenya_location_neighbors WHERE location_id IN (SELECT id FROM kenya_locations WHERE source = 'GEONAMES');\n"
        "DELETE FROM kenya_locations WHERE source = 'GEONAMES';\n",
        encoding="utf-8",
    )

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

    write_chunked_inserts(
        "01_counties_constituencies",
        "INSERT OR IGNORE INTO kenya_counties (id, code, name, slug, centroid_lat, centroid_lng)",
        county_vals,
        rows_per_stmt=47,
        stmts_per_file=10,
    )
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

    write_chunked_inserts(
        "02_locations",
        "INSERT OR IGNORE INTO kenya_locations (id, county_id, constituency_id, name, slug, kind, latitude, longitude, source, google_place_id, population)",
        loc_vals,
        rows_per_stmt=120,
        stmts_per_file=20,
    )
    write_chunked_inserts(
        "03_neighbors",
        "INSERT OR IGNORE INTO kenya_location_neighbors (location_id, neighbor_location_id, distance_km, rank)",
        nbr_vals,
        rows_per_stmt=250,
        stmts_per_file=40,
    )

    by_kind: dict[str, int] = defaultdict(int)
    by_origin: dict[str, int] = defaultdict(int)
    for p in deduped:
        by_kind[p["kind"]] += 1
        by_origin[p["origin"]] += 1

    id_to_loc = {p["id"]: p for p in deduped}
    nbr_by_id: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for lid, nid, dist, _rank in neighbor_rows:
        nbr_by_id[lid].append((id_to_loc[nid]["name"], dist))

    samples = {}
    for query_name in ["Westlands", "Sarit Centre", "Gikomba Market", "Juja", "Rongai"]:
        hit = next((p for p in deduped if p["name"].lower() == query_name.lower()), None)
        if hit:
            samples[hit["name"]] = {
                "id": hit["id"],
                "county_id": hit["county_id"],
                "constituency_id": hit["constituency_id"],
                "kind": hit["kind"],
                "origin": hit["origin"],
                "neighbors": nbr_by_id[hit["id"]][:5],
            }

    summary = {
        "counties": len(counties),
        "constituencies": len(constituencies),
        "raw_sources": {
            "geonames_filtered": geonames_kept,
            "osm_places": osm_places_kept,
            "osm_commercial_centres": osm_centres_kept,
            "iebc_wards": wards_kept,
        },
        "unmatched_outside_kenya_tolerance": unmatched,
        "locations_total": len(deduped),
        "locations_by_kind": dict(by_kind),
        "locations_by_origin": dict(by_origin),
        "neighbor_edges_total": len(neighbor_rows),
        "sql_seed_files_count": len(list(OUT_DIR.glob("*.sql"))),
        "samples": samples,
    }
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
