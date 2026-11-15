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
  - Human-brain road-network neighbor graph (K=8 road-connected towns & shopping
    centres per location using OSM Kenya trunk/primary/secondary/tertiary highways)

Outputs chunked SQL seed files in backend/drizzle/kenya_seed/ and summary JSON.
"""

from __future__ import annotations

import csv
import heapq
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
GEONAMES_S_CODES = {"MKT", "EST"}
GEONAMES_L_CODES = {"LCTY", "AREA"}
GEONAMES_A_CODES = {"ADMD"}

OSM_PLACE_CLASSES = {"city", "town", "suburb", "quarter", "neighbourhood", "village", "hamlet", "locality", "island"}
OSM_CENTRE_CLASSES = {"marketplace", "mall", "department_store"}
SHOPPING_RE = re.compile(r"\b(shopping\s*cent(?:re|er)|shopping\s*mall|mall|plaza|arcade|market|soko|trading\s*cent(?:re|er))\b", re.I)
STRICT_CENTRE_POI_RE = re.compile(r"\b(shopping\s*cent(?:re|er)|trading\s*cent(?:re|er)|shopping\s*mall|open\s*air\s*market)\b", re.I)
SHOPPING_KEYWORDS = ("shopping", "market", "mall", "plaza", "arcade", "soko", "centre", "center", "complex", "stage")
WARD_NAME_RE = re.compile(r"\bward$", re.I)
LOW_HUB_SIGNAL_RE = re.compile(r"\b(sub[- ]?location|location|plantation|ranch|farm|forest|division|post)\b", re.I)
VENUE_NOISE_RE = re.compile(
    r"\b(plaza|\w*mall|arcade|tower|building|flats|apartments|heights|stalls|auction|stage|chemist|pharmacy|"
    r"supermarket|butchery|hotel|lodge|resort|new market|ltd|limited|plc|inc|investments|logistics|vendors|"
    r"feeding|program|programme|doctors|health\s+care|youth\s+cent(?:re|er)|community\s+dev\w*|"
    r"business\s+cent(?:re|er)|non[- ]?governmental|organi[sz]ation|foundation|ngo|trust|ministries|ministry|"
    r"country\s+club|golf\s+club|farmhouse|dairy|cheese|bistro|cafe|coffee|bakery|house|street|avenue|road|lane|"
    r"school|academy|college|university|church|mosque|cathedral|hospital|clinic|dispensary|sacco|bank)\b",
    re.I,
)
COMM_NAME_RE = re.compile(r"\b(shopping|market|soko|town|cent(?:re|er))\b", re.I)

ROAD_SPEED_MULT = {
    "motorway": 1.0,
    "motorway_link": 1.0,
    "trunk": 1.0,
    "trunk_link": 1.0,
    "primary": 1.15,
    "primary_link": 1.15,
    "secondary": 1.45,
    "secondary_link": 1.45,
    "tertiary": 2.1,
    "tertiary_link": 2.1,
}
ROAD_CLASS_RANK = {
    "motorway": 0,
    "motorway_link": 0,
    "trunk": 0,
    "trunk_link": 0,
    "primary": 1,
    "primary_link": 1,
    "secondary": 2,
    "secondary_link": 2,
    "tertiary": 3,
    "tertiary_link": 3,
}

# High-traffic Kenyan shopping centres and corridor hubs missing or shadowed in upstream dumps.
CURATED_KENYA_CENTRES: list[dict] = [
    {"id": "loc-cur-makenji-sc", "name": "Makenji Shopping Centre", "lat": -1.0048, "lng": 37.0775, "kind": "SHOPPING_CENTRE", "priority": 112, "population": 3500},
    {"id": "loc-cur-kabati", "name": "Kabati", "lat": -0.95264, "lng": 37.10749, "kind": "TOWN", "priority": 116, "population": 18000},
    {"id": "loc-cur-karugia-sc", "name": "Karugia Shopping Centre", "lat": -0.89316, "lng": 37.12124, "kind": "SHOPPING_CENTRE", "priority": 112, "population": 4500},
    {"id": "loc-cur-sabasaba", "name": "Saba Saba", "lat": -0.87592, "lng": 37.14324, "kind": "TOWN", "priority": 114, "population": 12000},
    {"id": "loc-cur-makuyu", "name": "Makuyu", "lat": -0.910, "lng": 37.195, "kind": "TOWN", "priority": 114, "population": 15000},
    {"id": "loc-cur-bluepost-sc", "name": "Blue Post Shopping Centre", "lat": -1.0246, "lng": 37.06733, "kind": "SHOPPING_CENTRE", "priority": 105, "population": 2500},
    {"id": "loc-cur-witeithie", "name": "Witeithie", "lat": -1.03915, "lng": 37.0432, "kind": "TOWN", "priority": 112, "population": 15000},
    {"id": "loc-cur-makongeni-thika", "name": "Makongeni Shopping Centre", "lat": -1.0535, "lng": 37.0980, "kind": "SHOPPING_CENTRE", "priority": 108, "population": 12000},
    {"id": "loc-cur-westlands", "name": "Westlands", "lat": -1.26683, "lng": 36.80806, "kind": "TOWN", "priority": 118, "population": 45000},
    {"id": "loc-cur-kahawa-sukari", "name": "Kahawa Sukari", "lat": -1.1892, "lng": 36.9322, "kind": "SHOPPING_CENTRE", "priority": 110, "population": 8000},
    {"id": "loc-cur-kamakis", "name": "Kamakis", "lat": -1.17047, "lng": 36.97029, "kind": "SHOPPING_CENTRE", "priority": 110, "population": 8000},
    {"id": "loc-cur-mwihoko", "name": "Mwihoko", "lat": -1.20786, "lng": 36.9638, "kind": "SHOPPING_CENTRE", "priority": 108, "population": 6000},
]

NEIGHBOR_K = 8
MAX_FALLBACK_CENTROID_KM = 40.0


def neighbor_rank_penalty_km(kind: str, name: str, pop: int = 0, lat: float = 0.0, lng: float = 0.0, rrank: int = 4, snap_km: float = 0.0) -> float:
    penalty = 0.0
    if VENUE_NOISE_RE.search(name or ""):
        penalty += 18.0
    if name and name.isupper() and len(name) >= 4 and not COMM_NAME_RE.search(name):
        penalty += 18.0
    if LOW_HUB_SIGNAL_RE.search(name or ""):
        penalty += 14.0
    if pop == 0 and abs(lat * 60.0 - round(lat * 60.0)) < 1e-3 and abs(lng * 60.0 - round(lng * 60.0)) < 1e-3:
        penalty += 11.0
    if kind == "ESTATE":
        penalty += 9.5
    elif kind == "TRADING_CENTRE" and not COMM_NAME_RE.search(name or ""):
        penalty += 4.5 if rrank <= 1 else 7.5
    if kind == "TOWN":
        penalty -= 6.5 if pop >= 10000 else 4.5
    elif kind == "SHOPPING_CENTRE" and rrank <= 1 and not VENUE_NOISE_RE.search(name or ""):
        penalty -= 1.0
    if rrank == 0:
        penalty -= 2.5
    elif rrank == 1:
        penalty -= 1.3
    elif rrank >= 4:
        penalty += 3.0 * min(snap_km, 4.0)
    else:
        penalty += 1.5 * snap_km
    return penalty


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
                # GeoNames 195809 sits in the Ruchu hills (-0.88333, 36.98333), distinct from A2 highway Kabati.
                if geoname_id == "195809":
                    name = "Kabati (Ruchu)"
                    kind = "TRADING_CENTRE"
                    priority = 30
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
                if fclass in {"toilet", "drinking_water", "school", "kindergarten", "hospital", "clinic", "doctors", "pharmacy", "bank"}:
                    continue
                is_direct_centre = fclass in OSM_CENTRE_CLASSES
                is_named_shopping = (
                    fclass in {"commercial", "retail", "community_centre"}
                    and bool(SHOPPING_RE.search(lower))
                ) or (
                    fclass in {"kiosk", "convenience", "general", "public_building", "attraction", "supermarket"}
                    and bool(STRICT_CENTRE_POI_RE.search(lower))
                )
                if not (is_direct_centre or is_named_shopping):
                    continue
                pop = 0
                kind = "SHOPPING_CENTRE"
                priority = 105 if fclass in {"marketplace", "mall"} else 90
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

    # 3. Curated Kenyan shopping centres & highway hubs missing from upstream GeoNames/OSM dumps
    curated_kept = 0
    for item in CURATED_KENYA_CENTRES:
        cname = clean_display_name(item["name"])
        candidates.append({
            "id": item["id"],
            "origin": "curated",
            "name": cname,
            "dedup_key": dedup_key_name(cname),
            "norm_slug": slugify(cname),
            "lat": round(float(item["lat"]), 6),
            "lng": round(float(item["lng"]), 6),
            "kind": item["kind"],
            "priority": int(item["priority"]),
            "population": int(item.get("population") or 0),
        })
        curated_kept += 1

    # IEBC County Assembly Wards are intentionally excluded from commercial locations and
    # connected centres so towns/shopping centres never get overwritten by ward labels or connect to wards.
    wards_kept = 0

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

    # Deduplicate same normalized base name or slug ONLY when co-located (< 2.5 km / < 3.5 km),
    # independent of ward, constituency, or county borders so distinct towns with shared names stay intact.
    assigned.sort(
        key=lambda x: (
            -(x["priority"] + name_cleanliness_bonus(x["name"])),
            -x["population"],
            len(x["name"]),
            x["name"],
        )
    )
    deduped: list[dict] = []
    by_dedup_key: dict[str, list[dict]] = defaultdict(list)

    for pl in assigned:
        if not pl["norm_slug"] or not pl["dedup_key"]:
            continue
        if WARD_NAME_RE.search(pl["name"]):
            continue
        existing = by_dedup_key[pl["dedup_key"]]
        matched_dup = None
        for e in existing:
            dist = haversine_km(pl["lat"], pl["lng"], e["lat"], e["lng"])
            same_exact = pl["norm_slug"] == e["norm_slug"]
            if dist < (3.5 if same_exact else 2.5):
                matched_dup = e
                break
        if matched_dup is not None:
            if pl["population"] > matched_dup["population"]:
                matched_dup["population"] = pl["population"]
            if pl["kind"] in {"SHOPPING_CENTRE", "TOWN"} and matched_dup["kind"] not in {"SHOPPING_CENTRE", "TOWN"}:
                matched_dup["kind"] = pl["kind"]
            continue
        by_dedup_key[pl["dedup_key"]].append(pl)
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

    # Compute top K=8 human-brain road-connected hubs per location from OSM Kenya highways,
    # ignoring administrative ward, constituency, and county borders.
    roads_cache = CACHE_DIR / "kenya_connecting_roads.json"
    if not roads_cache.exists():
        raise FileNotFoundError(f"Missing cached road network at {roads_cache}")
    roads = json.loads(roads_cache.read_text(encoding="utf-8"))

    road_adj: dict[int, list[tuple[int, float, float]]] = defaultdict(list)
    node_coords: list[tuple[float, float]] = []
    node_best_road: list[int] = []
    coord_to_id: dict[tuple[float, float], int] = {}

    def get_road_node(lat: float, lng: float, rrank: int) -> int:
        key = (round(lat, 5), round(lng, 5))
        nid = coord_to_id.get(key)
        if nid is None:
            nid = len(node_coords)
            coord_to_id[key] = nid
            node_coords.append((lat, lng))
            node_best_road.append(rrank)
        elif rrank < node_best_road[nid]:
            node_best_road[nid] = rrank
        return nid

    for road in roads:
        fc, _rname, _rref, parts = road
        mult = ROAD_SPEED_MULT.get(fc, 2.1)
        rrank = ROAD_CLASS_RANK.get(fc, 3)
        part_list = [parts] if (parts and isinstance(parts[0][0], (int, float))) else parts
        for pts in part_list:
            for pt_idx in range(len(pts) - 1):
                lat1, lng1 = pts[pt_idx][0], pts[pt_idx][1]
                lat2, lng2 = pts[pt_idx + 1][0], pts[pt_idx + 1][1]
                seg = haversine_km(lat1, lng1, lat2, lng2)
                if seg <= 0.001:
                    continue
                steps = max(1, int(math.ceil(seg / 0.14)))
                prev = get_road_node(lat1, lng1, rrank)
                for s in range(1, steps + 1):
                    frac = s / steps
                    la = lat1 + (lat2 - lat1) * frac
                    lo = lng1 + (lng2 - lng1) * frac
                    nxt = get_road_node(la, lo, rrank)
                    if nxt != prev:
                        step_d = haversine_km(
                            node_coords[prev][0],
                            node_coords[prev][1],
                            node_coords[nxt][0],
                            node_coords[nxt][1],
                        )
                        if step_d > 0.0:
                            wc = step_d * mult
                            road_adj[prev].append((nxt, wc, step_d))
                            road_adj[nxt].append((prev, wc, step_d))
                    prev = nxt

    grid_150: dict[tuple[int, int], list[int]] = defaultdict(list)
    for nid, (la, lo) in enumerate(node_coords):
        grid_150[(int(math.floor(la * 700)), int(math.floor(lo * 700)))].append(nid)

    parent = list(range(len(node_coords)))

    def uf_find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for u, nbrs in road_adj.items():
        ru = uf_find(u)
        for v, _, _ in nbrs:
            rv = uf_find(v)
            if ru != rv:
                parent[rv] = ru

    for (cx, cy), nids in list(grid_150.items()):
        u = nids[0]
        u_lat, u_lng = node_coords[u]
        ru = uf_find(u)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for v in grid_150.get((cx + dx, cy + dy), ()):
                    if v <= u:
                        continue
                    rv = uf_find(v)
                    d = haversine_km(u_lat, u_lng, node_coords[v][0], node_coords[v][1])
                    if d <= 0.15 and (ru != rv or d <= 0.07):
                        road_adj[u].append((v, d * 1.05, d))
                        road_adj[v].append((u, d * 1.05, d))
                        if ru != rv:
                            parent[rv] = ru
                            ru = uf_find(u)

    comp = [-1] * len(node_coords)
    comp_sizes: list[int] = []
    cid = 0
    for s in range(len(node_coords)):
        if comp[s] != -1:
            continue
        q = [s]
        comp[s] = cid
        qi = 0
        while qi < len(q):
            u = q[qi]
            qi += 1
            for v, _, _ in road_adj[u]:
                if comp[v] == -1:
                    comp[v] = cid
                    q.append(v)
        comp_sizes.append(len(q))
        cid += 1

    valid_nodes_grid: dict[tuple[int, int], list[int]] = defaultdict(list)
    for nid, (la, lo) in enumerate(node_coords):
        if comp_sizes[comp[nid]] >= 20:
            valid_nodes_grid[(int(math.floor(la * 40)), int(math.floor(lo * 40)))].append(nid)

    # Spatial grid across locations for sparse off-road/island fallback padding
    grid: dict[tuple[int, int], list[int]] = defaultdict(list)
    for i, pl in enumerate(deduped):
        cell = (int(math.floor(pl["lat"] * 4)), int(math.floor(pl["lng"] * 4)))
        grid[cell].append(i)

        la, lo = pl["lat"], pl["lng"]
        cx, cy = int(math.floor(la * 40)), int(math.floor(lo * 40))
        best_snap = (9999.0, -1)
        best_rrank = 4
        for r in (1, 3, 8):
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    for nid in valid_nodes_grid.get((cx + dx, cy + dy), ()):
                        d = haversine_km(la, lo, node_coords[nid][0], node_coords[nid][1])
                        if d < best_snap[0]:
                            best_snap = (d, nid)
                        if d <= 1.25 and node_best_road[nid] < best_rrank:
                            best_rrank = node_best_road[nid]
            if best_snap[1] != -1 and best_snap[0] <= 2.5:
                break
        snap_km, nid = best_snap
        pl["snap_km"] = snap_km
        pl["nid"] = nid if snap_km <= 10.0 else -1
        pl["rrank"] = best_rrank
        pl["penalty"] = neighbor_rank_penalty_km(
            pl["kind"],
            pl["name"],
            pl["population"],
            pl["lat"],
            pl["lng"],
            best_rrank,
            snap_km,
        )

    node_to_locs: dict[int, list[int]] = defaultdict(list)
    for idx, pl in enumerate(deduped):
        if pl["nid"] != -1:
            node_to_locs[pl["nid"]].append(idx)

    simple_adj: dict[int, dict[int, tuple[float, float]]] = defaultdict(dict)
    for u, nbrs in road_adj.items():
        for v, wc, rk in nbrs:
            if u == v:
                continue
            cur = simple_adj[u].get(v)
            if cur is None or wc < cur[0]:
                simple_adj[u][v] = (wc, rk)

    pinned_nodes = set(node_to_locs.keys())
    for u in range(len(node_coords)):
        if u in pinned_nodes:
            continue
        nbrs = simple_adj[u]
        if len(nbrs) == 2:
            items = list(nbrs.items())
            (a, (wa, ra)), (b, (wb, rb)) = items[0], items[1]
            if a != b:
                nw, nr = wa + wb, ra + rb
                cur = simple_adj[a].get(b)
                if cur is None or nw < cur[0]:
                    simple_adj[a][b] = (nw, nr)
                    simple_adj[b][a] = (nw, nr)
            del simple_adj[a][u]
            del simple_adj[b][u]
            simple_adj[u].clear()

    min_possible_penalty = -9.0
    nid_candidates: dict[int, list[tuple[float, float, int]]] = {}
    for start in pinned_nodes:
        dist: dict[int, float] = {start: 0.0}
        pq: list[tuple[float, float, int]] = [(0.0, 0.0, start)]
        raw_cands: list[tuple[float, float, int]] = []
        max_cost = 80.0
        cutoff = max_cost
        while pq:
            cost, rkm, u = heapq.heappop(pq)
            if cost > cutoff:
                break
            if cost > dist.get(u, 1e9) + 1e-9:
                continue
            for j in node_to_locs.get(u, ()):
                other = deduped[j]
                if WARD_NAME_RE.search(other["name"]):
                    continue
                tot_rkm = rkm + other["snap_km"]
                score = cost + other["penalty"]
                raw_cands.append((score, tot_rkm, j))
            if len(raw_cands) >= 64 and cost > 10.0 and len(raw_cands) % 8 == 0:
                raw_cands.sort(key=lambda item: (item[0], item[1]))
                diverse_tmp: list[int] = []
                for sc, rk, j in raw_cands:
                    oj = deduped[j]
                    is_major = oj["kind"] == "TOWN" and oj["population"] >= 10000
                    if rk < 1.3 and not is_major:
                        continue
                    if not is_major and any(
                        haversine_km(oj["lat"], oj["lng"], deduped[cj]["lat"], deduped[cj]["lng"]) < 2.2
                        for cj in diverse_tmp
                    ):
                        continue
                    diverse_tmp.append(j)
                    if len(diverse_tmp) == NEIGHBOR_K + 4:
                        cutoff = min(max_cost, sc - min_possible_penalty + 1.0)
                        break
            for v, (wc, rk) in simple_adj[u].items():
                nc = cost + wc
                if nc <= cutoff and nc < dist.get(v, 1e9):
                    dist[v] = nc
                    heapq.heappush(pq, (nc, rkm + rk, v))
        raw_cands.sort(key=lambda item: (item[0], item[1]))
        nid_candidates[start] = raw_cands[:120]

    neighbor_rows: list[tuple[str, str, float, int]] = []
    for i, pl in enumerate(deduped):
        chosen: list[tuple[float, float, int]] = []
        deferred: list[tuple[float, float, int]] = []
        src_key = pl["dedup_key"]
        if pl["nid"] != -1:
            for base_score, base_rkm, j in nid_candidates[pl["nid"]]:
                if j == i:
                    continue
                other = deduped[j]
                road_dist = base_rkm + pl["snap_km"]
                is_major_town = other["kind"] == "TOWN" and other["population"] >= 10000
                if road_dist < 1.3 and not is_major_town:
                    deferred.append((base_score, road_dist, j))
                    continue
                if road_dist < 2.0 and other["dedup_key"] == src_key:
                    deferred.append((base_score, road_dist, j))
                    continue
                if not is_major_town and any(
                    haversine_km(other["lat"], other["lng"], deduped[cj]["lat"], deduped[cj]["lng"]) < 2.2
                    for _, _, cj in chosen
                ):
                    deferred.append((base_score, road_dist, j))
                    continue
                chosen.append((base_score, road_dist, j))
                if len(chosen) == NEIGHBOR_K:
                    break
            if len(chosen) < NEIGHBOR_K:
                chosen_ids = {x[2] for x in chosen}
                for item in deferred:
                    if item[2] not in chosen_ids:
                        chosen.append(item)
                        chosen_ids.add(item[2])
                        if len(chosen) == NEIGHBOR_K:
                            break

        # Graceful commercial Haversine fallback for islands or remote off-road pockets (< 8 hubs found)
        if len(chosen) < NEIGHBOR_K:
            chosen_ids = {x[2] for x in chosen}
            cx, cy = int(math.floor(pl["lat"] * 4)), int(math.floor(pl["lng"] * 4))
            fb_candidates: list[tuple[float, float, int]] = []
            radius = 1
            while len(fb_candidates) < NEIGHBOR_K * 4 and radius <= 16:
                seen_indices: list[int] = []
                for dx in range(-radius, radius + 1):
                    for dy in range(-radius, radius + 1):
                        seen_indices.extend(grid.get((cx + dx, cy + dy), []))
                if len(seen_indices) >= NEIGHBOR_K * 4 or radius == 16:
                    fb_candidates = []
                    for j in seen_indices:
                        if j == i or j in chosen_ids:
                            continue
                        other = deduped[j]
                        if WARD_NAME_RE.search(other["name"]):
                            continue
                        d = haversine_km(pl["lat"], pl["lng"], other["lat"], other["lng"])
                        fb_candidates.append((d + other["penalty"], d, j))
                    if len(fb_candidates) >= NEIGHBOR_K - len(chosen):
                        break
                radius *= 2
            fb_candidates.sort(key=lambda item: (item[0], item[1], deduped[item[2]]["id"]))
            for item in fb_candidates:
                if item[2] not in chosen_ids:
                    chosen.append(item)
                    chosen_ids.add(item[2])
                    if len(chosen) == NEIGHBOR_K:
                        break

        for rank, (_score, dist_km, j) in enumerate(chosen[:NEIGHBOR_K], start=1):
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
