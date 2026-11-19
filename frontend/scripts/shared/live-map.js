// Store254 Shared Live Map & Road Pathfinder Helper
(() => {
  "use strict";

  const DEFAULT_CENTER = { lat: -1.286389, lng: 36.817223 };
  const PRIMARY_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  const FALLBACK_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

  function esc(val) {
    return String(val ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);
  }

  function resolveApiOrigin() {
    if (typeof API_BASE_URL === "string") return API_BASE_URL;
    const host = window.location.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) {
      return "http://localhost:8787";
    }
    return "";
  }

  function isAvailable() {
    return Boolean(typeof window !== "undefined" && window.L && typeof window.L.map === "function");
  }

  function haversineKm(lat1, lng1, lat2, lng2) {
    const r = 6371.0088;
    const p1 = (Number(lat1) * Math.PI) / 180;
    const p2 = (Number(lat2) * Math.PI) / 180;
    const dp = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
    const dl = ((Number(lng2) - Number(lng1)) * Math.PI) / 180;
    const a =
      Math.sin(dp / 2) * Math.sin(dp / 2) +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function formatMeters(meters) {
    const m = Math.round(Number(meters || 0));
    if (!Number.isFinite(m) || m <= 0) return "";
    if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
    return `${m} m`;
  }

  function formatCoords(lat, lng) {
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return "";
    return `${nLat.toFixed(5)}, ${nLng.toFixed(5)}`;
  }

  function buildGoogleMapsDirectionsUrl({ toLat, toLng, fromLat, fromLng, mode = "driving" }) {
    const params = new URLSearchParams({
      api: "1",
      destination: `${Number(toLat).toFixed(6)},${Number(toLng).toFixed(6)}`,
      travelmode: mode === "walking" ? "walking" : "driving",
    });
    if (Number.isFinite(Number(fromLat)) && Number.isFinite(Number(fromLng))) {
      params.set("origin", `${Number(fromLat).toFixed(6)},${Number(fromLng).toFixed(6)}`);
    }
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  function refreshSize(map) {
    if (!map || typeof map.invalidateSize !== "function") return;
    requestAnimationFrame(() => {
      try {
        map.invalidateSize({ pan: false });
      } catch {}
    });
    setTimeout(() => {
      try {
        map.invalidateSize({ pan: false });
      } catch {}
    }, 180);
  }

  function createMap(containerEl, options = {}) {
    if (!isAvailable() || !containerEl) return null;
    const lat = Number.isFinite(Number(options.lat)) ? Number(options.lat) : DEFAULT_CENTER.lat;
    const lng = Number.isFinite(Number(options.lng)) ? Number(options.lng) : DEFAULT_CENTER.lng;
    const zoom = Number.isFinite(Number(options.zoom)) ? Number(options.zoom) : 14;

    const map = window.L.map(containerEl, {
      center: [lat, lng],
      zoom,
      zoomControl: options.zoomControl !== false,
      attributionControl: options.attributionControl !== false,
    });

    const primaryLayer = window.L.tileLayer(PRIMARY_TILE_URL, {
      maxZoom: 19,
      subdomains: "abcd",
      attribution: "&copy; OpenStreetMap &copy; CARTO",
    });

    let switchedToFallback = false;
    let errorCount = 0;
    primaryLayer.on("tileerror", () => {
      errorCount += 1;
      if (!switchedToFallback && errorCount >= 3) {
        switchedToFallback = true;
        try {
          map.removeLayer(primaryLayer);
          window.L.tileLayer(FALLBACK_TILE_URL, {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
          }).addTo(map);
        } catch {}
      }
    });

    primaryLayer.addTo(map);

    if (typeof options.onClick === "function") {
      map.on("click", (ev) => {
        if (ev?.latlng) {
          options.onClick({
            lat: Number(ev.latlng.lat.toFixed(6)),
            lng: Number(ev.latlng.lng.toFixed(6)),
          });
        }
      });
    }

    refreshSize(map);
    return map;
  }

  function createPinIcon({ kind = "pickup", letter, label, plate, etaMinutes, isAssigned = false } = {}) {
    if (!isAvailable()) return null;

    if (kind === "user") {
      return window.L.divIcon({
        className: "s254-leaflet-icon",
        html: `<div class="s254-user-dot-wrap" title="${esc(label || "Your Location")}"><span class="s254-user-halo"></span><span class="s254-user-dot"></span></div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
    }

    if (kind === "boda" || kind === "taxi") {
      const isTaxi = kind === "taxi";
      const badgeCls = `s254-driver-badge ${isTaxi ? "is-taxi" : "is-boda"}${isAssigned ? " is-assigned" : ""}`;
      const tagCls = `s254-driver-tag${isAssigned ? " is-assigned" : ""}`;
      const displayLetter = letter || (isTaxi ? "T" : "B");
      const plateText = plate ? String(plate).toUpperCase() : isTaxi ? "TAXI" : "BODA";
      const etaText = Number.isFinite(Number(etaMinutes)) ? ` · ${Math.round(Number(etaMinutes))}m` : "";
      const tagHtml = label || plate || etaText
        ? `<span class="${tagCls}">${esc(label || `${plateText}${etaText}`)}</span>`
        : "";
      return window.L.divIcon({
        className: "s254-leaflet-icon",
        html: `<div class="s254-driver-marker"><span class="${badgeCls}">${esc(displayLetter)}</span>${tagHtml}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
    }

    const kindCls =
      kind === "dropoff"
        ? "is-dropoff"
        : kind === "store"
          ? "is-store"
          : kind === "stage"
            ? "is-stage"
            : "is-pickup";
    const defaultLetter =
      kind === "dropoff" ? "D" : kind === "store" ? "S" : kind === "stage" ? "★" : "P";
    const safeLabel = label ? `<span class="s254-pin-label">${esc(String(label).slice(0, 26))}</span>` : "";

    return window.L.divIcon({
      className: "s254-leaflet-icon",
      html: `<div class="s254-pin-marker"><span class="s254-pin-dot ${kindCls}">${esc(letter || defaultLetter)}</span>${safeLabel}</div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }

  function drawRoute(map, layerGroup, geometry, options = {}) {
    if (!isAvailable() || !layerGroup) return null;
    layerGroup.clearLayers();
    if (!Array.isArray(geometry) || geometry.length < 2) return null;

    const latLngs = geometry
      .map((pt) => [Number(pt[0]), Number(pt[1])])
      .filter((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1]));
    if (latLngs.length < 2) return null;

    const weight = Number(options.weight || 5);
    const outer = window.L.polyline(latLngs, {
      color: options.shadowColor || "#064e3b",
      weight: weight + 4,
      opacity: 0.25,
      lineCap: "round",
      lineJoin: "round",
    });

    const inner = window.L.polyline(latLngs, {
      color: options.color || "#059669",
      weight,
      opacity: 0.94,
      lineCap: "round",
      lineJoin: "round",
      ...(options.dashed ? { dashArray: "8, 8" } : {}),
    });

    layerGroup.addLayer(outer);
    layerGroup.addLayer(inner);

    if (options.badgeText) {
      const midPt = latLngs[Math.floor(latLngs.length / 2)];
      const badgeMarker = window.L.marker(midPt, {
        interactive: false,
        icon: window.L.divIcon({
          className: "s254-leaflet-icon",
          html: `<div class="s254-route-tooltip" style="transform:translate(-50%,-50%)">${esc(options.badgeText)}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
      });
      layerGroup.addLayer(badgeMarker);
    }

    if (options.fitBounds !== false && map) {
      try {
        map.fitBounds(inner.getBounds(), {
          padding: options.padding || [44, 44],
          maxZoom: options.maxZoom || 16,
        });
      } catch {}
    }

    return inner;
  }

  function buildClientFallbackRoute(fromLat, fromLng, toLat, toLng, mode) {
    const normalizedMode = mode === "walking" ? "walking" : "driving";
    const straightKm = haversineKm(fromLat, fromLng, toLat, toLng);
    const roadFactor = normalizedMode === "walking" ? 1.18 : 1.25;
    const distanceKm = Math.max(0.05, Number((straightKm * roadFactor).toFixed(2)));
    const speedKmh = normalizedMode === "walking" ? 4.8 : 28;
    const durationMinutes = Math.max(1, Math.round((distanceKm / speedKmh) * 60));
    const fLat = Number(Number(fromLat).toFixed(6));
    const fLng = Number(Number(fromLng).toFixed(6));
    const tLat = Number(Number(toLat).toFixed(6));
    const tLng = Number(Number(toLng).toFixed(6));

    return {
      mode: normalizedMode,
      source: "fallback",
      distanceKm,
      durationMinutes,
      geometry: [
        [fLat, fLng],
        [tLat, tLng],
      ],
      steps: [
        {
          instruction: normalizedMode === "walking" ? "Walk toward destination" : "Head toward destination",
          roadName: "",
          distanceMeters: Math.round(distanceKm * 1000),
          durationSeconds: durationMinutes * 60,
          maneuverType: "depart",
          lat: fLat,
          lng: fLng,
        },
        {
          instruction: "Arrive at destination",
          roadName: "",
          distanceMeters: 0,
          durationSeconds: 0,
          maneuverType: "arrive",
          lat: tLat,
          lng: tLng,
        },
      ],
      bbox: [
        Math.min(fLat, tLat),
        Math.min(fLng, tLng),
        Math.max(fLat, tLat),
        Math.max(fLng, tLng),
      ],
    };
  }

  async function fetchRoute({ fromLat, fromLng, toLat, toLng, mode = "driving" }) {
    const fLat = Number(fromLat);
    const fLng = Number(fromLng);
    const tLat = Number(toLat);
    const tLng = Number(toLng);
    const normalizedMode = mode === "walking" ? "walking" : "driving";

    if (!Number.isFinite(fLat) || !Number.isFinite(fLng) || !Number.isFinite(tLat) || !Number.isFinite(tLng)) {
      return { ok: false, route: null };
    }

    const qs = new URLSearchParams({
      fromLat: String(fLat),
      fromLng: String(fLng),
      toLat: String(tLat),
      toLng: String(tLng),
      mode: normalizedMode,
    });

    try {
      const origin = resolveApiOrigin();
      const res = await fetch(`${origin}/api/platform/locations/route?${qs.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json?.data && Array.isArray(json.data.geometry)) {
        return { ok: true, route: json.data };
      }
    } catch {}

    return {
      ok: false,
      route: buildClientFallbackRoute(fLat, fLng, tLat, tLng, normalizedMode),
    };
  }

  window.Store254Map = {
    DEFAULT_CENTER,
    isAvailable,
    createMap,
    refreshSize,
    createPinIcon,
    drawRoute,
    fetchRoute,
    haversineKm,
    formatMeters,
    formatCoords,
    buildGoogleMapsDirectionsUrl,
  };
})();
