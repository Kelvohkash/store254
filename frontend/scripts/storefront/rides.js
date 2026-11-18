// Store254 Boda & Taxi Live Rides (0% Commission — Pay Driver Directly)
(() => {
  "use strict";

  const ACTIVE_RIDE_KEY = "store254_active_ride_v1";
  const PHONE_STORAGE_KEY = "store254_buyer_phone_v1";
  const REOPEN_DRIVER_FLAG = "store254_reopen_rides_driver";
  const DEFAULT_CENTER = { lat: -1.286389, lng: 36.817223, label: "Nairobi CBD" };

  const RIDE_STATUS_META = {
    REQUESTED: {
      label: "Finding nearby rider… (0% Commission)",
      cls: "bg-amber-100 text-amber-800 border-amber-200",
    },
    ACCEPTED: {
      label: "Driver Accepted — Preparing to move",
      cls: "bg-sky-100 text-sky-800 border-sky-200",
    },
    ARRIVING: {
      label: "Driver Arriving at Pickup",
      cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
    IN_PROGRESS: {
      label: "Trip in Progress",
      cls: "bg-indigo-100 text-indigo-800 border-indigo-200",
    },
    COMPLETED: {
      label: "Trip Completed — Pay Driver Directly (0% Fee)",
      cls: "bg-emerald-600 text-white border-emerald-700",
    },
    CANCELLED: {
      label: "Ride Cancelled",
      cls: "bg-rose-100 text-rose-800 border-rose-200",
    },
  };

  const ridesState = {
    initialized: false,
    isOpen: false,
    activeTab: "book",
    selectedVehicle: "BODABODA",
    pickup: null, // { label, lat, lng, locationId }
    dropoff: null, // { label, lat, lng, locationId }
    pickupSuggestions: [],
    dropoffSuggestions: [],
    estimate: null,
    nearbyDrivers: [],
    activeRideRecord: null, // { rideId, trackingToken }
    activeRideData: null, // { ride, driver, driverDistanceKm, driverEtaMinutes }
    ridePollTimer: null,
    nearbyPollTimer: null,
    pickupSuggestTimer: null,
    dropoffSuggestTimer: null,
    rafId: null,
    animMarkers: new Map(), // key -> { lat, lng, targetLat, targetLng }
    driver: {
      profile: null,
      activeRide: null,
      openRequests: [],
      isOnline: false,
      lat: null,
      lng: null,
      heading: null,
      locationId: "",
      locationLabel: "",
      watchId: null,
      heartbeatTimer: null,
      dashboardPollTimer: null,
      formPopulated: false,
    },
  };

  function esc(val) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(val);
    return String(val ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);
  }

  function toast(msg, type = "info") {
    if (typeof window.showToast === "function") {
      window.showToast(msg, type);
      return;
    }
    if (type === "error") console.error("[Rides]", msg);
    else console.log("[Rides]", msg);
  }

  function refreshIcons(target) {
    if (typeof window.renderIcons === "function") {
      window.renderIcons(target);
    } else if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  function extractErrorMsg(res, fallback) {
    const err = res?.data?.error;
    if (Array.isArray(err?.issues) && err.issues.length > 0 && err.issues[0]?.message) {
      return err.issues[0].message;
    }
    if (typeof err?.message === "string" && err.message.trim()) return err.message.trim();
    if (typeof res?.data?.message === "string" && res.data.message.trim()) return res.data.message.trim();
    return fallback;
  }

  function formatKes(amount) {
    return `KES ${Math.round(Number(amount || 0)).toLocaleString("en-KE")}`;
  }

  function sanitizeTelHref(phone) {
    const cleaned = String(phone || "").replace(/[^\d+]/g, "");
    return cleaned ? `tel:${cleaned}` : "";
  }

  function buildWhatsappHref(phone, text) {
    let digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("0") && digits.length === 10) {
      digits = `254${digits.slice(1)}`;
    } else if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) {
      digits = `254${digits}`;
    }
    return `https://wa.me/${digits}?text=${encodeURIComponent(text || "Hello, I booked a ride on Store254.")}`;
  }

  async function resolvePlatformUser(forceRefresh = false) {
    const cached =
      (typeof window.getStore254PlatformUser === "function" ? window.getStore254PlatformUser() : null) ||
      window.platformUser ||
      null;
    if (cached && cached.email && !forceRefresh) return cached;

    if (typeof window.refreshStore254PlatformSession === "function") {
      try {
        await window.refreshStore254PlatformSession();
      } catch {}
      const refreshed =
        (typeof window.getStore254PlatformUser === "function" ? window.getStore254PlatformUser() : null) ||
        window.platformUser ||
        null;
      if (refreshed && refreshed.email) return refreshed;
    }

    try {
      const base = typeof API_BASE_URL === "string" ? API_BASE_URL : "";
      const res = await fetch(`${base}/api/platform/me`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (json?.data?.authenticated && json?.data?.user?.email) {
        return json.data.user;
      }
    } catch {}
    return null;
  }

  function readSavedActiveRide() {
    try {
      const raw = localStorage.getItem(ACTIVE_RIDE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.rideId && parsed.trackingToken) return parsed;
    } catch {}
    return null;
  }

  function saveActiveRideRecord(record) {
    ridesState.activeRideRecord = record;
    try {
      if (record) localStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify(record));
      else localStorage.removeItem(ACTIVE_RIDE_KEY);
    } catch {}
  }

  function getMapReferenceCoords() {
    if (ridesState.pickup && Number.isFinite(ridesState.pickup.lat) && Number.isFinite(ridesState.pickup.lng)) {
      return { lat: ridesState.pickup.lat, lng: ridesState.pickup.lng, locationId: ridesState.pickup.locationId };
    }
    const buyerLoc = typeof window.getStore254BuyerLocation === "function" ? window.getStore254BuyerLocation() : null;
    if (buyerLoc && Number.isFinite(Number(buyerLoc.lat)) && Number.isFinite(Number(buyerLoc.lng))) {
      return { lat: Number(buyerLoc.lat), lng: Number(buyerLoc.lng), locationId: buyerLoc.locationId || "" };
    }
    if (buyerLoc?.locationId) {
      return { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng, locationId: buyerLoc.locationId };
    }
    return { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng, locationId: "" };
  }

  // --- Interactive Live Map / Radar Canvas ---
  function syncAnimatedMarkerTargets() {
    const activeKeys = new Set();

    const activeData = ridesState.activeRideData;
    const assignedDriver = activeData?.driver;
    const activeRide = activeData?.ride;

    if (assignedDriver || activeRide?.driverLat != null) {
      const dLat = Number(assignedDriver?.currentLat ?? activeRide?.driverLat);
      const dLng = Number(assignedDriver?.currentLng ?? activeRide?.driverLng);
      if (Number.isFinite(dLat) && Number.isFinite(dLng)) {
        const key = `assigned:${assignedDriver?.id || "driver"}`;
        activeKeys.add(key);
        const cur = ridesState.animMarkers.get(key);
        if (cur) {
          cur.targetLat = dLat;
          cur.targetLng = dLng;
        } else {
          ridesState.animMarkers.set(key, { lat: dLat, lng: dLng, targetLat: dLat, targetLng: dLng });
        }
      }
    }

    for (const drv of ridesState.nearbyDrivers || []) {
      const dLat = Number(drv.currentLat);
      const dLng = Number(drv.currentLng);
      if (!Number.isFinite(dLat) || !Number.isFinite(dLng)) continue;
      const key = `nearby:${drv.id}`;
      activeKeys.add(key);
      const cur = ridesState.animMarkers.get(key);
      if (cur) {
        cur.targetLat = dLat;
        cur.targetLng = dLng;
      } else {
        ridesState.animMarkers.set(key, { lat: dLat, lng: dLng, targetLat: dLat, targetLng: dLng });
      }
    }

    for (const key of ridesState.animMarkers.keys()) {
      if (!activeKeys.has(key)) {
        ridesState.animMarkers.delete(key);
      }
    }
  }

  function stepAnimatedMarkers() {
    for (const entry of ridesState.animMarkers.values()) {
      entry.lat += (entry.targetLat - entry.lat) * 0.14;
      entry.lng += (entry.targetLng - entry.lng) * 0.14;
    }
  }

  function drawPin(ctx, x, y, color, ringColor, letter, label) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fillStyle = ringColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 9px Manrope, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, x, y + 0.5);

    if (label) {
      const trimmed = String(label).slice(0, 22);
      ctx.font = "700 10px DM Sans, system-ui, sans-serif";
      const tw = ctx.measureText(trimmed).width;
      const pillW = tw + 12;
      const pillX = x - pillW / 2;
      const pillY = y - 28;
      ctx.fillStyle = "rgba(9, 25, 20, 0.88)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect?.(pillX, pillY, pillW, 16, 6);
      if (!ctx.roundRect) ctx.rect(pillX, pillY, pillW, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f8fafc";
      ctx.textBaseline = "middle";
      ctx.fillText(trimmed, x, pillY + 8.5);
    }
    ctx.restore();
  }

  function drawDriverMarker(ctx, x, y, drv, isAssigned, isSelectedType) {
    ctx.save();
    const isTaxi = String(drv.vehicleType || "").toUpperCase() === "TAXI";
    const fill = isTaxi ? "#0284c7" : "#f59e0b";
    const glow = isAssigned
      ? "rgba(16, 185, 129, 0.42)"
      : isSelectedType
        ? isTaxi
          ? "rgba(56, 189, 248, 0.3)"
          : "rgba(251, 191, 36, 0.3)"
        : "rgba(148, 163, 184, 0.18)";

    ctx.beginPath();
    ctx.arc(x, y, isAssigned ? 17 : 13, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, isAssigned ? 10.5 : 8.5, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = isAssigned ? 2.5 : 1.75;
    ctx.strokeStyle = isAssigned ? "#34d399" : "#ffffff";
    ctx.stroke();

    ctx.fillStyle = isTaxi ? "#ffffff" : "#111827";
    ctx.font = "900 9px Manrope, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isTaxi ? "T" : "B", x, y + 0.5);

    const plate = drv.plateNumber ? String(drv.plateNumber).toUpperCase() : isTaxi ? "TAXI" : "BODA";
    const etaPart = Number.isFinite(Number(drv.etaMinutes)) ? ` · ${Math.round(Number(drv.etaMinutes))}m` : "";
    const text = `${plate}${etaPart}`;
    ctx.font = "700 9.5px ui-monospace, SFMono-Regular, monospace";
    const tw = ctx.measureText(text).width;
    const pw = tw + 10;
    const px = x - pw / 2;
    const py = y + 13;

    ctx.fillStyle = isAssigned ? "rgba(6, 78, 59, 0.94)" : "rgba(15, 23, 42, 0.88)";
    ctx.strokeStyle = isAssigned ? "rgba(52, 211, 153, 0.8)" : "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect?.(px, py, pw, 15, 5);
    if (!ctx.roundRect) ctx.rect(px, py, pw, 15);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.fillText(text, x, py + 8);
    ctx.restore();
  }

  function renderRidesCanvas(nowTs = performance.now()) {
    const canvas = document.getElementById("rides-map-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(rect.width || canvas.clientWidth || 0, 300);
    const h = Math.max(rect.height || canvas.clientHeight || 0, 220);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    stepAnimatedMarkers();

    const activeRide = ridesState.activeRideData?.ride || null;
    const assignedDriver = ridesState.activeRideData?.driver || null;

    const pickupPt = activeRide && Number.isFinite(Number(activeRide.pickupLat))
      ? { lat: Number(activeRide.pickupLat), lng: Number(activeRide.pickupLng), label: activeRide.pickupLabel || "Pickup" }
      : ridesState.pickup;

    const dropoffPt = activeRide && Number.isFinite(Number(activeRide.dropoffLat))
      ? { lat: Number(activeRide.dropoffLat), lng: Number(activeRide.dropoffLng), label: activeRide.dropoffLabel || "Dropoff" }
      : ridesState.dropoff;

    const assignedKey = assignedDriver || activeRide?.driverLat != null
      ? `assigned:${assignedDriver?.id || "driver"}`
      : null;
    const assignedAnim = assignedKey ? ridesState.animMarkers.get(assignedKey) : null;

    const allCoords = [];
    if (pickupPt && Number.isFinite(pickupPt.lat)) allCoords.push({ lat: pickupPt.lat, lng: pickupPt.lng });
    if (dropoffPt && Number.isFinite(dropoffPt.lat)) allCoords.push({ lat: dropoffPt.lat, lng: dropoffPt.lng });
    if (assignedAnim) allCoords.push({ lat: assignedAnim.lat, lng: assignedAnim.lng });

    const showNearby = !activeRide || activeRide.status === "REQUESTED";
    if (showNearby) {
      for (const drv of (ridesState.nearbyDrivers || []).slice(0, 12)) {
        const anim = ridesState.animMarkers.get(`nearby:${drv.id}`);
        if (anim) allCoords.push({ lat: anim.lat, lng: anim.lng });
      }
    }

    if (allCoords.length === 0) {
      const ref = getMapReferenceCoords();
      allCoords.push({ lat: ref.lat, lng: ref.lng });
    }

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const pt of allCoords) {
      if (pt.lat < minLat) minLat = pt.lat;
      if (pt.lat > maxLat) maxLat = pt.lat;
      if (pt.lng < minLng) minLng = pt.lng;
      if (pt.lng > maxLng) maxLng = pt.lng;
    }

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const cosLat = Math.max(0.25, Math.cos((centerLat * Math.PI) / 180));
    const latSpan = Math.max(maxLat - minLat, 0.025);
    const lngSpan = Math.max((maxLng - minLng) * cosLat, 0.025) / cosLat;

    const pad = 38;
    const drawW = Math.max(w - pad * 2, 100);
    const drawH = Math.max(h - pad * 2, 100);
    const scale = Math.min(drawW / (lngSpan * cosLat * 1.35), drawH / (latSpan * 1.35));

    const project = (lat, lng) => ({
      x: w / 2 + (lng - centerLng) * cosLat * scale,
      y: h / 2 - (lat - centerLat) * scale,
    });

    // Background cartographic radar gradient
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, "#071611");
    bgGrad.addColorStop(1, "#0d281e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle coordinate grid
    ctx.strokeStyle = "rgba(16, 185, 129, 0.09)";
    ctx.lineWidth = 1;
    const gridStep = 36;
    for (let gx = (w / 2) % gridStep; gx < w; gx += gridStep) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = (h / 2) % gridStep; gy < h; gy += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // Concentric radar rings around pickup or center
    const anchor = pickupPt
      ? project(pickupPt.lat, pickupPt.lng)
      : project(centerLat, centerLng);

    for (const r of [42, 84, 128]) {
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(52, 211, 153, 0.14)";
      ctx.setLineDash([4, 5]);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Radar pulse ring
    const pulseProgress = (nowTs % 2600) / 2600;
    const pulseRadius = 10 + pulseProgress * 92;
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, pulseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(52, 211, 153, ${(1 - pulseProgress) * 0.45})`;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Pickup -> Dropoff route vector
    if (pickupPt && dropoffPt) {
      const pPos = project(pickupPt.lat, pickupPt.lng);
      const dPos = project(dropoffPt.lat, dropoffPt.lng);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pPos.x, pPos.y);
      ctx.lineTo(dPos.x, dPos.y);
      ctx.strokeStyle = "rgba(16, 185, 129, 0.25)";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pPos.x, pPos.y);
      ctx.lineTo(dPos.x, dPos.y);
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 6]);
      ctx.lineDashOffset = -(nowTs / 60);
      ctx.stroke();
      ctx.setLineDash([]);

      const distKm = activeRide?.distanceKm ?? ridesState.estimate?.distanceKm;
      if (distKm) {
        const mx = (pPos.x + dPos.x) / 2;
        const my = (pPos.y + dPos.y) / 2;
        const label = `${Number(distKm).toFixed(1)} km`;
        ctx.font = "800 10px Manrope, system-ui, sans-serif";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "#064e3b";
        ctx.strokeStyle = "#34d399";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect?.(mx - tw / 2 - 7, my - 9, tw + 14, 18, 9);
        if (!ctx.roundRect) ctx.rect(mx - tw / 2 - 7, my - 9, tw + 14, 18);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#ecfdf5";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, mx, my + 0.5);
      }
      ctx.restore();
    }

    // Active driver -> pickup or dropoff vector
    if (assignedAnim && activeRide && ["ACCEPTED", "ARRIVING", "IN_PROGRESS"].includes(activeRide.status)) {
      const targetPt = activeRide.status === "IN_PROGRESS" ? dropoffPt : pickupPt;
      if (targetPt) {
        const aPos = project(assignedAnim.lat, assignedAnim.lng);
        const tPos = project(targetPt.lat, targetPt.lng);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(aPos.x, aPos.y);
        ctx.lineTo(tPos.x, tPos.y);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2.2;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -(nowTs / 45);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Nearby drivers
    if (showNearby) {
      for (const drv of ridesState.nearbyDrivers || []) {
        const anim = ridesState.animMarkers.get(`nearby:${drv.id}`);
        if (!anim) continue;
        const pos = project(anim.lat, anim.lng);
        const isSelectedType = String(drv.vehicleType || "").toUpperCase() === ridesState.selectedVehicle;
        drawDriverMarker(ctx, pos.x, pos.y, drv, false, isSelectedType);
      }
    }

    // Assigned driver
    if (assignedAnim && activeRide && !["COMPLETED", "CANCELLED"].includes(activeRide.status)) {
      const pos = project(assignedAnim.lat, assignedAnim.lng);
      const drvInfo = assignedDriver || {
        vehicleType: activeRide.vehicleType,
        plateNumber: "ASSIGNED",
        etaMinutes: ridesState.activeRideData?.driverEtaMinutes,
      };
      drawDriverMarker(
        ctx,
        pos.x,
        pos.y,
        { ...drvInfo, etaMinutes: ridesState.activeRideData?.driverEtaMinutes ?? drvInfo.etaMinutes },
        true,
        true
      );
    }

    // Pickup & Dropoff Pins
    if (pickupPt) {
      const pPos = project(pickupPt.lat, pickupPt.lng);
      drawPin(ctx, pPos.x, pPos.y, "#10b981", "rgba(16, 185, 129, 0.28)", "P", pickupPt.label || "Pickup");
    }
    if (dropoffPt) {
      const dPos = project(dropoffPt.lat, dropoffPt.lng);
      drawPin(ctx, dPos.x, dPos.y, "#f43f5e", "rgba(244, 63, 94, 0.28)", "D", dropoffPt.label || "Dropoff");
    }

    // Top-left HUD badge
    ctx.save();
    const hudText = activeRide
      ? `LIVE TRIP · 0% COMMISSION`
      : `LIVE RADAR · ${(ridesState.nearbyDrivers || []).length} ONLINE NEARBY`;
    ctx.font = "800 9.5px Manrope, system-ui, sans-serif";
    const hw = ctx.measureText(hudText).width + 16;
    ctx.fillStyle = "rgba(6, 20, 15, 0.85)";
    ctx.strokeStyle = "rgba(52, 211, 153, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect?.(10, 10, hw, 22, 11);
    if (!ctx.roundRect) ctx.rect(10, 10, hw, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#6ee7b7";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(hudText, 18, 21.5);
    ctx.restore();

    // Bottom-right scale bar
    ctx.save();
    const degPer50Px = 50 / Math.max(scale, 1);
    const approxKm = Math.max(0.2, degPer50Px * 111.32);
    const scaleText = approxKm >= 1 ? `~${approxKm.toFixed(1)} km` : `~${Math.round(approxKm * 1000)} m`;
    ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
    ctx.fillRect(w - 64, h - 14, 50, 2);
    ctx.fillRect(w - 64, h - 18, 1.5, 6);
    ctx.fillRect(w - 15.5, h - 18, 1.5, 6);
    ctx.font = "700 9px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText(scaleText, w - 14, h - 22);
    ctx.restore();
  }

  function startCanvasLoop() {
    if (ridesState.rafId) return;
    const frame = (ts) => {
      if (!ridesState.isOpen || ridesState.activeTab !== "book") {
        ridesState.rafId = null;
        return;
      }
      renderRidesCanvas(ts);
      ridesState.rafId = requestAnimationFrame(frame);
    };
    ridesState.rafId = requestAnimationFrame(frame);
  }

  function stopCanvasLoop() {
    if (ridesState.rafId) {
      cancelAnimationFrame(ridesState.rafId);
      ridesState.rafId = null;
    }
  }

  // --- Nearby Drivers & Fare Estimation ---
  function renderNearbySummary() {
    const el = document.getElementById("rides-nearby-summary");
    if (!el) return;
    const drivers = ridesState.nearbyDrivers || [];
    const bodaCount = drivers.filter((d) => String(d.vehicleType || "").toUpperCase() === "BODABODA").length;
    const taxiCount = drivers.filter((d) => String(d.vehicleType || "").toUpperCase() === "TAXI").length;

    if (drivers.length === 0) {
      el.innerHTML = `
        <span class="inline-flex items-center gap-1.5 text-slate-600 font-semibold">
          <span class="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>No riders online in this area yet · <strong>0% Commission</strong> — Pay Driver Directly</span>
        </span>`;
      return;
    }

    el.innerHTML = `
      <span class="inline-flex flex-wrap items-center gap-2 font-bold text-emerald-900">
        <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> ${bodaCount} Bodaboda${bodaCount === 1 ? "" : "s"}</span>
        <span class="text-slate-300">·</span>
        <span>${taxiCount} Taxi${taxiCount === 1 ? "" : "s"} nearby</span>
        <span class="text-slate-300">·</span>
        <span class="text-emerald-700">0% Commission — Pay Driver Directly</span>
      </span>`;
  }

  async function refreshNearbyRides() {
    const ref = getMapReferenceCoords();
    const params = new URLSearchParams();
    if (Number.isFinite(ref.lat) && Number.isFinite(ref.lng)) {
      params.set("lat", String(ref.lat));
      params.set("lng", String(ref.lng));
    }
    if (ref.locationId) params.set("locationId", ref.locationId);
    params.set("radiusKm", "25");

    const res = await apiFetch(`/api/platform/rides/nearby?${params.toString()}`);
    if (res.ok && res.data?.success) {
      ridesState.nearbyDrivers = Array.isArray(res.data?.data?.drivers) ? res.data.data.drivers : [];
    }
    syncAnimatedMarkerTargets();
    renderNearbySummary();
  }

  async function requestRideEstimateIfReady() {
    const box = document.getElementById("ride-estimate-box");
    const bodaEl = document.getElementById("ride-estimate-boda-fare");
    const taxiEl = document.getElementById("ride-estimate-taxi-fare");
    const distEl = document.getElementById("ride-estimate-distance");

    if (!ridesState.pickup || !ridesState.dropoff) {
      if (box) box.classList.add("hidden");
      return;
    }

    const payload = {
      pickupLat: ridesState.pickup.lat,
      pickupLng: ridesState.pickup.lng,
      pickupLocationId: ridesState.pickup.locationId || undefined,
      dropoffLat: ridesState.dropoff.lat,
      dropoffLng: ridesState.dropoff.lng,
      dropoffLocationId: ridesState.dropoff.locationId || undefined,
    };

    const res = await apiFetch("/api/platform/rides/estimate", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.data?.success || !res.data?.data) {
      return;
    }

    const estData = res.data.data;
    ridesState.estimate = estData;
    const boda = estData.estimates?.BODABODA || {};
    const taxi = estData.estimates?.TAXI || {};

    if (bodaEl) bodaEl.textContent = formatKes(boda.fareKes);
    if (taxiEl) taxiEl.textContent = formatKes(taxi.fareKes);
    if (distEl) {
      const distText = Number(estData.distanceKm || 0).toFixed(1);
      const etaMin = boda.etaMinutes ?? taxi.etaMinutes ?? 5;
      distEl.textContent = `${distText} km · ~${etaMin} min · 0% Commission — Pay Driver Directly`;
    }
    if (box) box.classList.remove("hidden");
  }

  // --- Town Suggestions for Pickup & Dropoff ---
  function renderLocationSuggestions(kind, suggestions) {
    const boxId = kind === "pickup" ? "ride-pickup-suggestions" : "ride-dropoff-suggestions";
    const box = document.getElementById(boxId);
    if (!box) return;

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }

    box.innerHTML = suggestions
      .map((loc, idx) => {
        const sub = [loc.constituencyName, loc.countyName].filter(Boolean).join(" · ");
        return `
          <button type="button" data-ride-suggest-kind="${kind}" data-ride-suggest-idx="${idx}" class="w-full text-left px-3 py-2 hover:bg-emerald-50 flex items-center justify-between gap-2 border-b border-slate-100 last:border-0 text-xs">
            <span class="min-w-0">
              <strong class="block text-slate-900 truncate">${esc(loc.name)}</strong>
              ${sub ? `<span class="block text-[10px] text-emerald-700 truncate">${esc(sub)}</span>` : ""}
            </span>
            <span class="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">${esc(loc.kind === "TOWN" ? "Town" : loc.kind === "ESTATE" ? "Estate" : "Centre")}</span>
          </button>`;
      })
      .join("");
    box.classList.remove("hidden");
  }

  function applySelectedPlace(kind, loc) {
    if (!loc) return;
    const lat = Number(loc.latitude ?? loc.lat);
    const lng = Number(loc.longitude ?? loc.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const label = loc.countyName && !String(loc.name || "").includes(loc.countyName)
      ? `${loc.name}, ${loc.countyName}`
      : String(loc.name || loc.label || "Selected Location");

    const place = {
      locationId: loc.id || loc.locationId || "",
      label,
      lat,
      lng,
    };

    if (kind === "pickup") {
      ridesState.pickup = place;
      const input = document.getElementById("ride-pickup-input");
      if (input) input.value = label;
      document.getElementById("ride-pickup-suggestions")?.classList.add("hidden");
      void refreshNearbyRides();
    } else {
      ridesState.dropoff = place;
      const input = document.getElementById("ride-dropoff-input");
      if (input) input.value = label;
      document.getElementById("ride-dropoff-suggestions")?.classList.add("hidden");
    }

    void requestRideEstimateIfReady();
  }

  async function queryRideLocations(kind, rawQuery) {
    const q = String(rawQuery || "").trim();
    const res = await apiFetch(`/api/platform/locations/towns?q=${encodeURIComponent(q)}&limit=8`);
    const locs = res.ok && Array.isArray(res.data?.locations) ? res.data.locations : [];
    if (kind === "pickup") ridesState.pickupSuggestions = locs;
    else ridesState.dropoffSuggestions = locs;
    renderLocationSuggestions(kind, locs);
  }

  window.useRidePickupGps = async function useRidePickupGps() {
    const btn = document.getElementById("ride-pickup-gps-btn");
    const input = document.getElementById("ride-pickup-input");
    if (btn) btn.disabled = true;

    const resolveNearest = async (lat, lng, fromGps) => {
      const qs = Number.isFinite(lat) && Number.isFinite(lng) ? `?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}` : "";
      const res = await apiFetch(`/api/platform/locations/nearest${qs}`);
      const loc = res.ok ? res.data?.location : null;
      const finalLat = Number.isFinite(lat) ? lat : Number(loc?.latitude);
      const finalLng = Number.isFinite(lng) ? lng : Number(loc?.longitude);

      if (Number.isFinite(finalLat) && Number.isFinite(finalLng)) {
        const label = loc?.name
          ? `${loc.name}${fromGps ? " (GPS)" : ""}`
          : "My GPS Location";
        ridesState.pickup = {
          locationId: loc?.id || "",
          label,
          lat: finalLat,
          lng: finalLng,
        };
        if (input) input.value = label;
        document.getElementById("ride-pickup-suggestions")?.classList.add("hidden");
        await refreshNearbyRides();
        await requestRideEstimateIfReady();
        toast(`Pickup set to ${label}`, "success");
        return true;
      }
      return false;
    };

    try {
      if (!navigator.geolocation) {
        const ok = await resolveNearest(NaN, NaN, false);
        if (!ok) toast("GPS unavailable. Please type your pickup town or estate.", "error");
        return;
      }

      await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = Number(pos.coords.latitude.toFixed(6));
            const lng = Number(pos.coords.longitude.toFixed(6));
            const ok = await resolveNearest(lat, lng, true);
            if (!ok) toast("Could not resolve pickup location.", "error");
            resolve();
          },
          async () => {
            const ok = await resolveNearest(NaN, NaN, false);
            if (!ok) toast("Location permission denied. Type your pickup town instead.", "error");
            resolve();
          },
          { enableHighAccuracy: true, timeout: 5500, maximumAge: 60000 }
        );
      });
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.selectRideVehicle = function selectRideVehicle(vehicleType) {
    const normalized = String(vehicleType || "").toUpperCase() === "TAXI" ? "TAXI" : "BODABODA";
    ridesState.selectedVehicle = normalized;
    document.querySelectorAll("[data-ride-vehicle]").forEach((btn) => {
      const isActive = btn.getAttribute("data-ride-vehicle") === normalized;
      btn.setAttribute("aria-pressed", String(isActive));
      btn.classList.toggle("is-selected", isActive);
      btn.classList.toggle("ring-2", isActive);
      btn.classList.toggle("ring-emerald-500", isActive);
      btn.classList.toggle("border-emerald-500", isActive);
      btn.classList.toggle("bg-emerald-50", isActive);
    });
  };

  // --- Rider Request & Live Tracker ---
  function renderActiveRideTracker() {
    const trackerEl = document.getElementById("ride-live-tracker");
    const badgeEl = document.getElementById("ride-status-badge");
    const driverCardEl = document.getElementById("ride-driver-card");
    const cancelBtn = document.getElementById("ride-cancel-btn");
    const ratingForm = document.getElementById("ride-rating-form");

    if (!trackerEl) return;
    const data = ridesState.activeRideData;
    const ride = data?.ride;

    if (!ride) {
      trackerEl.classList.add("hidden");
      return;
    }

    trackerEl.classList.remove("hidden");

    const status = String(ride.status || "REQUESTED").toUpperCase();
    const meta = RIDE_STATUS_META[status] || {
      label: status,
      cls: "bg-slate-100 text-slate-800 border-slate-200",
    };

    if (badgeEl) {
      badgeEl.textContent = meta.label;
      badgeEl.className = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${meta.cls}`;
    }

    const driver = data?.driver;
    if (driver && driverCardEl) {
      driverCardEl.classList.remove("hidden");
      const nameEl = document.getElementById("ride-driver-name");
      const vehicleEl = document.getElementById("ride-driver-vehicle");
      const plateEl = document.getElementById("ride-driver-plate");
      const etaEl = document.getElementById("ride-driver-eta");
      const mpesaEl = document.getElementById("ride-driver-mpesa");
      const callEl = document.getElementById("ride-driver-call");
      const waEl = document.getElementById("ride-driver-whatsapp");

      if (nameEl) {
        const rating = Number(driver.ratingAvg || 5).toFixed(1);
        nameEl.textContent = `${driver.fullName || "Driver"} · ★ ${rating}`;
      }
      if (vehicleEl) {
        const typeText = String(driver.vehicleType || "").toUpperCase() === "TAXI" ? "Taxi" : "Bodaboda";
        vehicleEl.textContent = driver.vehicleMakeModel ? `${typeText} · ${driver.vehicleMakeModel}` : typeText;
      }
      if (plateEl) {
        plateEl.textContent = driver.plateNumber || "—";
      }
      if (etaEl) {
        if (status === "COMPLETED") {
          etaEl.textContent = `Fare: ${formatKes(ride.estimatedFareKes)} (0% Commission)`;
        } else if (status === "IN_PROGRESS") {
          etaEl.textContent = `On trip · ${formatKes(ride.estimatedFareKes)} direct to driver`;
        } else if (data.driverEtaMinutes != null) {
          const distStr = data.driverDistanceKm != null ? ` (${Number(data.driverDistanceKm).toFixed(1)} km)` : "";
          etaEl.textContent = `${data.driverEtaMinutes} min away${distStr}`;
        } else {
          etaEl.textContent = "Live GPS connected";
        }
      }
      if (mpesaEl) {
        mpesaEl.textContent = driver.mpesaPaymentInfo || driver.phone || "Pay driver directly (0% commission)";
      }

      const telHref = sanitizeTelHref(driver.phone);
      if (callEl) {
        if (telHref) {
          callEl.href = telHref;
          callEl.classList.remove("hidden");
        } else {
          callEl.removeAttribute("href");
          callEl.classList.add("hidden");
        }
      }

      const waHref = buildWhatsappHref(
        driver.phone,
        `Hello ${driver.fullName || ""}, I'm your Store254 rider at ${ride.pickupLabel || "pickup"}.`
      );
      if (waEl) {
        if (waHref) {
          waEl.href = waHref;
          waEl.classList.remove("hidden");
        } else {
          waEl.removeAttribute("href");
          waEl.classList.add("hidden");
        }
      }
    } else if (driverCardEl) {
      driverCardEl.classList.add("hidden");
    }

    if (cancelBtn) {
      const canCancel = ["REQUESTED", "ACCEPTED", "ARRIVING"].includes(status);
      cancelBtn.classList.toggle("hidden", !canCancel);
    }

    if (ratingForm) {
      const showRating = status === "COMPLETED" && !ride.riderRating;
      ratingForm.classList.toggle("hidden", !showRating);
    }

    syncAnimatedMarkerTargets();
  }

  async function pollActiveRideOnce() {
    const rec = ridesState.activeRideRecord;
    if (!rec || !rec.rideId || !rec.trackingToken) return;

    const res = await apiFetch(
      `/api/platform/rides/${encodeURIComponent(rec.rideId)}?trackingToken=${encodeURIComponent(rec.trackingToken)}`
    );

    if (res.status === 404 || res.status === 403 || res.status === 401) {
      saveActiveRideRecord(null);
      ridesState.activeRideData = null;
      stopRidePolling();
      renderActiveRideTracker();
      return;
    }

    if (!res.ok || !res.data?.success || !res.data?.data?.ride) return;

    ridesState.activeRideData = res.data.data;
    const status = String(res.data.data.ride.status || "").toUpperCase();
    renderActiveRideTracker();

    if (status === "CANCELLED") {
      stopRidePolling();
      saveActiveRideRecord(null);
    } else if (status === "COMPLETED" && res.data.data.ride.riderRating) {
      stopRidePolling();
    }
  }

  function startRidePolling() {
    if (ridesState.ridePollTimer) return;
    ridesState.ridePollTimer = setInterval(() => {
      if (ridesState.isOpen && ridesState.activeRideRecord) {
        void pollActiveRideOnce();
      }
    }, 3000);
  }

  function stopRidePolling() {
    if (ridesState.ridePollTimer) {
      clearInterval(ridesState.ridePollTimer);
      ridesState.ridePollTimer = null;
    }
  }

  window.resetCompletedRideView = function resetCompletedRideView() {
    stopRidePolling();
    saveActiveRideRecord(null);
    ridesState.activeRideData = null;
    renderActiveRideTracker();
    void refreshNearbyRides();
  };

  async function ensureEndpointPlaceResolved(kind) {
    const existing = kind === "pickup" ? ridesState.pickup : ridesState.dropoff;
    if (existing && Number.isFinite(existing.lat) && Number.isFinite(existing.lng)) {
      return existing;
    }
    const input = document.getElementById(kind === "pickup" ? "ride-pickup-input" : "ride-dropoff-input");
    const q = (input?.value || "").trim();
    if (q.length < 2) return null;

    const res = await apiFetch(`/api/platform/locations/towns?q=${encodeURIComponent(q)}&limit=1`);
    const match = res.ok && Array.isArray(res.data?.locations) ? res.data.locations[0] : null;
    if (match) {
      applySelectedPlace(kind, match);
      return kind === "pickup" ? ridesState.pickup : ridesState.dropoff;
    }
    return null;
  }

  window.requestRide = async function requestRide() {
    const btn = document.getElementById("ride-request-btn");
    const nameEl = document.getElementById("ride-rider-name");
    const phoneEl = document.getElementById("ride-rider-phone");

    const pickup = await ensureEndpointPlaceResolved("pickup");
    const dropoff = await ensureEndpointPlaceResolved("dropoff");

    if (!pickup) {
      toast("Please pick a pickup location from the suggestions or tap GPS.", "error");
      document.getElementById("ride-pickup-input")?.focus();
      return;
    }
    if (!dropoff) {
      toast("Please pick a destination from the suggestions.", "error");
      document.getElementById("ride-dropoff-input")?.focus();
      return;
    }

    const riderName = (nameEl?.value || "").trim();
    const riderPhone = (phoneEl?.value || "").trim();
    if (riderName.length < 2) {
      toast("Please enter your name for the rider.", "error");
      nameEl?.focus();
      return;
    }
    if (riderPhone.replace(/\D/g, "").length < 9) {
      toast("Please enter a valid Kenyan phone number (e.g. 0712345678).", "error");
      phoneEl?.focus();
      return;
    }

    try {
      localStorage.setItem(PHONE_STORAGE_KEY, riderPhone);
    } catch {}

    const prevHtml = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Requesting ride…";
    }

    try {
      const res = await apiFetch("/api/platform/rides/request", {
        method: "POST",
        body: JSON.stringify({
          riderName,
          riderPhone,
          vehicleType: ridesState.selectedVehicle,
          pickupLabel: pickup.label,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          pickupLocationId: pickup.locationId || undefined,
          dropoffLabel: dropoff.label,
          dropoffLat: dropoff.lat,
          dropoffLng: dropoff.lng,
          dropoffLocationId: dropoff.locationId || undefined,
        }),
      });

      if (!res.ok || !res.data?.success || !res.data?.data?.ride) {
        toast(extractErrorMsg(res, "Could not request ride. Please try again."), "error");
        return;
      }

      const { ride, trackingToken } = res.data.data;
      saveActiveRideRecord({ rideId: ride.id, trackingToken });
      ridesState.activeRideData = { ride, driver: null, commissionKes: 0 };
      renderActiveRideTracker();
      startRidePolling();
      void pollActiveRideOnce();
      toast("Ride requested! Nearby drivers can accept now (0% commission).", "success");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = prevHtml;
      }
      refreshIcons();
    }
  };

  window.cancelActiveRide = async function cancelActiveRide() {
    const rec = ridesState.activeRideRecord;
    if (!rec?.rideId || !rec?.trackingToken) return;
    const btn = document.getElementById("ride-cancel-btn");
    if (btn) btn.disabled = true;

    try {
      const res = await apiFetch(`/api/platform/rides/${encodeURIComponent(rec.rideId)}/status`, {
        method: "POST",
        body: JSON.stringify({ action: "CANCEL", trackingToken: rec.trackingToken }),
      });

      if (!res.ok || !res.data?.success) {
        toast(extractErrorMsg(res, "Could not cancel ride."), "error");
        return;
      }

      stopRidePolling();
      await pollActiveRideOnce();
      saveActiveRideRecord(null);
      toast("Ride cancelled.", "info");
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.submitRideRating = async function submitRideRating(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    const rec = ridesState.activeRideRecord;
    if (!rec?.rideId || !rec?.trackingToken) return;

    const score = Number(document.getElementById("ride-rating-score")?.value || 5);
    const review = (document.getElementById("ride-rating-review")?.value || "").trim();

    const res = await apiFetch(`/api/platform/rides/${encodeURIComponent(rec.rideId)}/rate`, {
      method: "POST",
      body: JSON.stringify({
        rating: Math.min(5, Math.max(1, Math.round(score))),
        review: review || undefined,
        trackingToken: rec.trackingToken,
      }),
    });

    if (!res.ok || !res.data?.success) {
      toast(extractErrorMsg(res, "Failed to submit rating."), "error");
      return;
    }

    toast("Thank you for rating your driver!", "success");
    document.getElementById("ride-rating-form")?.classList.add("hidden");
    stopRidePolling();
    saveActiveRideRecord(null);
    if (ridesState.activeRideData?.ride) {
      ridesState.activeRideData.ride.riderRating = score;
    }
  };

  // --- Driver Mode ---
  window.startRidesGoogleSignIn = function startRidesGoogleSignIn() {
    try {
      sessionStorage.setItem(REOPEN_DRIVER_FLAG, "1");
    } catch {}
    if (typeof window.startPlatformGoogleSignIn === "function") {
      window.startPlatformGoogleSignIn();
      return;
    }
    window.location.href = `/auth/google/login?return_to=${encodeURIComponent(window.location.href)}`;
  };

  function syncDriverOnlineUI(isOnline) {
    ridesState.driver.isOnline = Boolean(isOnline);
    const toggle = document.getElementById("rides-driver-online-toggle");
    const label = document.getElementById("rides-driver-online-label");

    if (toggle) {
      if (toggle.tagName === "INPUT" && toggle.type === "checkbox") {
        toggle.checked = Boolean(isOnline);
      } else {
        toggle.setAttribute("aria-pressed", String(Boolean(isOnline)));
        toggle.classList.toggle("bg-emerald-600", Boolean(isOnline));
        toggle.classList.toggle("text-white", Boolean(isOnline));
      }
    }

    if (label) {
      label.textContent = isOnline
        ? "Online — Receiving Ride Requests (0% Commission)"
        : "Offline — Toggle to Go Online";
      label.classList.toggle("text-emerald-700", Boolean(isOnline));
    }
  }

  async function sendDriverHeartbeat() {
    if (!ridesState.driver.isOnline || !ridesState.driver.profile) return;
    if (!Number.isFinite(ridesState.driver.lat) || !Number.isFinite(ridesState.driver.lng)) return;

    await apiFetch("/api/platform/rides/driver/location", {
      method: "POST",
      body: JSON.stringify({
        currentLat: ridesState.driver.lat,
        currentLng: ridesState.driver.lng,
        heading: ridesState.driver.heading ?? undefined,
      }),
    });
  }

  function startDriverGpsHeartbeat() {
    if (navigator.geolocation && ridesState.driver.watchId === null) {
      try {
        ridesState.driver.watchId = navigator.geolocation.watchPosition(
          (pos) => {
            ridesState.driver.lat = Number(pos.coords.latitude.toFixed(6));
            ridesState.driver.lng = Number(pos.coords.longitude.toFixed(6));
            if (Number.isFinite(pos.coords.heading)) {
              ridesState.driver.heading = Math.round(pos.coords.heading);
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
      } catch {}
    }

    if (!ridesState.driver.heartbeatTimer) {
      ridesState.driver.heartbeatTimer = setInterval(() => {
        void sendDriverHeartbeat();
      }, 5000);
    }
  }

  function stopDriverGpsHeartbeat() {
    if (ridesState.driver.watchId !== null && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(ridesState.driver.watchId);
      } catch {}
      ridesState.driver.watchId = null;
    }
    if (ridesState.driver.heartbeatTimer) {
      clearInterval(ridesState.driver.heartbeatTimer);
      ridesState.driver.heartbeatTimer = null;
    }
  }

  function startDriverDashboardPoll() {
    if (ridesState.driver.dashboardPollTimer) return;
    ridesState.driver.dashboardPollTimer = setInterval(() => {
      if (ridesState.isOpen && ridesState.activeTab === "driver") {
        void loadDriverProfile(false);
      }
    }, 5000);
  }

  function stopDriverDashboardPoll() {
    if (ridesState.driver.dashboardPollTimer) {
      clearInterval(ridesState.driver.dashboardPollTimer);
      ridesState.driver.dashboardPollTimer = null;
    }
  }

  function renderDriverActiveRideAndRequests() {
    const activeBox = document.getElementById("rides-driver-active-ride");
    const reqBox = document.getElementById("rides-driver-requests-list");
    const active = ridesState.driver.activeRide;
    const openReqs = ridesState.driver.openRequests || [];

    if (activeBox) {
      if (!active) {
        activeBox.innerHTML = `<p class="text-xs text-slate-500">No active ride right now.</p>`;
      } else {
        const st = String(active.status || "").toUpperCase();
        const tel = sanitizeTelHref(active.riderPhone);
        const actions = [];
        if (st === "ACCEPTED") {
          actions.push(`<button type="button" data-driver-ride-id="${esc(active.id)}" data-driver-action="ARRIVING" class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs">Arriving</button>`);
          actions.push(`<button type="button" data-driver-ride-id="${esc(active.id)}" data-driver-action="START" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">Start Trip</button>`);
          actions.push(`<button type="button" data-driver-ride-id="${esc(active.id)}" data-driver-action="CANCEL" class="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs">Cancel</button>`);
        } else if (st === "ARRIVING") {
          actions.push(`<button type="button" data-driver-ride-id="${esc(active.id)}" data-driver-action="START" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">Start Trip</button>`);
          actions.push(`<button type="button" data-driver-ride-id="${esc(active.id)}" data-driver-action="CANCEL" class="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs">Cancel</button>`);
        } else if (st === "IN_PROGRESS") {
          actions.push(`<button type="button" data-driver-ride-id="${esc(active.id)}" data-driver-action="COMPLETE" class="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs">Complete Trip</button>`);
        }

        activeBox.innerHTML = `
          <div class="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] font-extrabold uppercase tracking-wide text-emerald-800">Active Ride · ${esc(st)}</span>
              <span class="text-xs font-black text-emerald-900">${formatKes(active.estimatedFareKes)} (0% fee)</span>
            </div>
            <div class="text-xs text-slate-800 space-y-1">
              <p><strong>Rider:</strong> ${esc(active.riderName || "Passenger")} ${tel ? `· <a href="${esc(tel)}" class="text-emerald-700 font-bold underline">${esc(active.riderPhone)}</a>` : ""}</p>
              <p><strong>Pickup:</strong> ${esc(active.pickupLabel || "Pickup")}</p>
              <p><strong>Dropoff:</strong> ${esc(active.dropoffLabel || "Dropoff")} ${active.distanceKm ? `(${Number(active.distanceKm).toFixed(1)} km)` : ""}</p>
            </div>
            <div class="flex flex-wrap gap-2 pt-1">${actions.join("")}</div>
          </div>`;
      }
    }

    if (reqBox) {
      if (!ridesState.driver.profile) {
        reqBox.innerHTML = `<p class="text-xs text-slate-500">Save your driver details below to receive nearby ride requests.</p>`;
      } else if (openReqs.length === 0) {
        reqBox.innerHTML = `<p class="text-xs text-slate-500">${ridesState.driver.isOnline ? "Listening for nearby ride requests…" : "Go online above to see and accept nearby ride requests."}</p>`;
      } else {
        reqBox.innerHTML = openReqs
          .map((req) => `
            <div class="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between gap-3">
              <div class="min-w-0 text-xs space-y-0.5">
                <div class="flex items-center gap-2">
                  <strong class="text-slate-900 truncate">${esc(req.pickupLabel || "Pickup")} → ${esc(req.dropoffLabel || "Dropoff")}</strong>
                </div>
                <p class="text-[11px] text-slate-600">
                  ${esc(req.riderName || "Rider")} · ${Number(req.distanceKm || 0).toFixed(1)} km trip${Number.isFinite(Number(req.distanceToPickupKm)) ? ` (${Number(req.distanceToPickupKm).toFixed(1)} km to pickup · ~${Math.round(Number(req.etaToPickupMinutes || 2))}m)` : ""} · <strong class="text-emerald-700">${formatKes(req.estimatedFareKes)}</strong>
                </p>
              </div>
              <button type="button" data-driver-ride-id="${esc(req.id)}" data-driver-action="ACCEPT" class="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                Accept
              </button>
            </div>`)
          .join("");
      }
    }
  }

  function populateDriverForm(profile, user) {
    const setIfBlankOrInitial = (id, val) => {
      const el = document.getElementById(id);
      if (!el || val == null || val === "") return;
      if (!ridesState.driver.formPopulated || !String(el.value || "").trim()) {
        el.value = String(val);
      }
    };

    if (!profile) {
      setIfBlankOrInitial("driver-full-name", user?.fullName || "");
      ridesState.driver.formPopulated = true;
      return;
    }

    setIfBlankOrInitial("driver-full-name", profile.fullName || user?.fullName || "");
    setIfBlankOrInitial("driver-phone", profile.phone || "");
    setIfBlankOrInitial("driver-mpesa", profile.mpesaPaymentInfo || "");
    setIfBlankOrInitial("driver-vehicle-type", profile.vehicleType || "BODABODA");
    setIfBlankOrInitial("driver-vehicle-model", profile.vehicleMakeModel || "");
    setIfBlankOrInitial("driver-plate", profile.plateNumber || "");
    setIfBlankOrInitial("driver-base-fare", profile.baseFareKes ?? 50);
    setIfBlankOrInitial("driver-per-km", profile.perKmRateKes ?? 35);
    setIfBlankOrInitial("driver-location-label", profile.locationLabel || "");

    if (Number.isFinite(Number(profile.currentLat)) && Number.isFinite(Number(profile.currentLng))) {
      ridesState.driver.lat = Number(profile.currentLat);
      ridesState.driver.lng = Number(profile.currentLng);
    }
    if (profile.locationId) ridesState.driver.locationId = profile.locationId;
    if (profile.locationLabel) ridesState.driver.locationLabel = profile.locationLabel;

    ridesState.driver.formPopulated = true;
  }

  async function loadDriverProfile(forceAuthRefresh = true) {
    const gate = document.getElementById("rides-driver-auth-gate");
    const content = document.getElementById("rides-driver-content");

    const user = await resolvePlatformUser(forceAuthRefresh);
    if (!user) {
      if (gate) gate.classList.remove("hidden");
      if (content) content.classList.add("hidden");
      stopDriverDashboardPoll();
      stopDriverGpsHeartbeat();
      return;
    }

    if (gate) gate.classList.add("hidden");
    if (content) content.classList.remove("hidden");

    const res = await apiFetch("/api/platform/rides/driver/me");
    if (res.status === 401) {
      if (gate) gate.classList.remove("hidden");
      if (content) content.classList.add("hidden");
      return;
    }

    const payload = res.ok && res.data?.success ? res.data.data || {} : {};
    ridesState.driver.profile = payload.driver || null;
    ridesState.driver.activeRide = payload.activeRide || null;
    ridesState.driver.openRequests = Array.isArray(payload.openRequests) ? payload.openRequests : [];

    populateDriverForm(ridesState.driver.profile, user);
    syncDriverOnlineUI(Boolean(ridesState.driver.profile?.isOnline));
    renderDriverActiveRideAndRequests();

    if (ridesState.driver.isOnline) {
      startDriverGpsHeartbeat();
    } else {
      stopDriverGpsHeartbeat();
    }
    startDriverDashboardPoll();
  }

  window.useDriverGps = async function useDriverGps() {
    const btn = document.getElementById("driver-gps-btn");
    const locInput = document.getElementById("driver-location-label");
    if (btn) btn.disabled = true;

    const applyCoords = async (lat, lng) => {
      const qs = Number.isFinite(lat) && Number.isFinite(lng) ? `?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}` : "";
      const res = await apiFetch(`/api/platform/locations/nearest${qs}`);
      const loc = res.ok ? res.data?.location : null;
      const finalLat = Number.isFinite(lat) ? lat : Number(loc?.latitude);
      const finalLng = Number.isFinite(lng) ? lng : Number(loc?.longitude);

      if (Number.isFinite(finalLat) && Number.isFinite(finalLng)) {
        ridesState.driver.lat = finalLat;
        ridesState.driver.lng = finalLng;
        ridesState.driver.locationId = loc?.id || "";
        const label = loc?.name ? `${loc.name}${loc.countyName ? `, ${loc.countyName}` : ""}` : "Current GPS Area";
        ridesState.driver.locationLabel = label;
        if (locInput) locInput.value = label;
        if (ridesState.driver.isOnline && ridesState.driver.profile) {
          void sendDriverHeartbeat();
        }
        toast(`Driver location updated: ${label}`, "success");
        return true;
      }
      return false;
    };

    try {
      if (!navigator.geolocation) {
        const ok = await applyCoords(NaN, NaN);
        if (!ok) toast("GPS unavailable. Enter your town/stage name manually.", "error");
        return;
      }

      await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const ok = await applyCoords(
              Number(pos.coords.latitude.toFixed(6)),
              Number(pos.coords.longitude.toFixed(6))
            );
            if (!ok) toast("Could not detect driver location.", "error");
            resolve();
          },
          async () => {
            const ok = await applyCoords(NaN, NaN);
            if (!ok) toast("GPS permission denied. Enter your stage/town name manually.", "error");
            resolve();
          },
          { enableHighAccuracy: true, timeout: 5500, maximumAge: 60000 }
        );
      });
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.toggleDriverOnline = async function toggleDriverOnline(forcedState) {
    const toggle = document.getElementById("rides-driver-online-toggle");
    const nextOnline = typeof forcedState === "boolean"
      ? forcedState
      : toggle?.type === "checkbox"
        ? Boolean(toggle.checked)
        : !ridesState.driver.isOnline;

    if (!ridesState.driver.profile) {
      syncDriverOnlineUI(false);
      toast("Save your driver vehicle profile below first before going online.", "error");
      return;
    }

    if (nextOnline && (!Number.isFinite(ridesState.driver.lat) || !Number.isFinite(ridesState.driver.lng))) {
      await window.useDriverGps();
      if (!Number.isFinite(ridesState.driver.lat) || !Number.isFinite(ridesState.driver.lng)) {
        const ref = getMapReferenceCoords();
        ridesState.driver.lat = ref.lat;
        ridesState.driver.lng = ref.lng;
      }
    }

    const res = await apiFetch("/api/platform/rides/driver/status", {
      method: "POST",
      body: JSON.stringify({
        isOnline: nextOnline,
        currentLat: ridesState.driver.lat ?? undefined,
        currentLng: ridesState.driver.lng ?? undefined,
        heading: ridesState.driver.heading ?? undefined,
      }),
    });

    if (!res.ok || !res.data?.success) {
      syncDriverOnlineUI(!nextOnline);
      toast(extractErrorMsg(res, "Could not update driver online status."), "error");
      return;
    }

    syncDriverOnlineUI(nextOnline);
    if (nextOnline) {
      startDriverGpsHeartbeat();
      toast("You are now ONLINE and visible to nearby riders (0% commission)!", "success");
    } else {
      stopDriverGpsHeartbeat();
      toast("You are now offline.", "info");
    }
    await loadDriverProfile(false);
  };

  window.saveDriverProfile = async function saveDriverProfile(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();

    const fullName = (document.getElementById("driver-full-name")?.value || "").trim();
    const phone = (document.getElementById("driver-phone")?.value || "").trim();
    const mpesaPaymentInfo = (document.getElementById("driver-mpesa")?.value || "").trim();
    const vehicleType = document.getElementById("driver-vehicle-type")?.value || "BODABODA";
    const vehicleMakeModel = (document.getElementById("driver-vehicle-model")?.value || "").trim();
    const plateNumber = (document.getElementById("driver-plate")?.value || "").trim().toUpperCase();
    const baseFareRaw = String(document.getElementById("driver-base-fare")?.value ?? "").trim();
    const perKmRaw = String(document.getElementById("driver-per-km")?.value ?? "").trim();
    const baseFareKes = baseFareRaw !== "" ? Number(baseFareRaw) : undefined;
    const perKmRateKes = perKmRaw !== "" ? Number(perKmRaw) : undefined;
    const locationLabel = (document.getElementById("driver-location-label")?.value || "").trim();

    if (fullName.length < 2) {
      toast("Please enter your full name.", "error");
      return;
    }
    if (phone.replace(/\D/g, "").length < 9) {
      toast("Please enter a valid driver phone number.", "error");
      return;
    }
    if (plateNumber.length < 2) {
      toast("Please enter your vehicle or motorbike plate number.", "error");
      return;
    }

    // If driver typed a town/stage without clicking GPS, resolve coords cleanly so nearby requests appear
    if (locationLabel.length >= 2 && (!Number.isFinite(ridesState.driver.lat) || !Number.isFinite(ridesState.driver.lng))) {
      try {
        const locRes = await apiFetch(`/api/platform/locations/towns?q=${encodeURIComponent(locationLabel)}&limit=1`);
        const match = locRes.ok && Array.isArray(locRes.data?.locations) ? locRes.data.locations[0] : null;
        if (match && Number.isFinite(Number(match.latitude)) && Number.isFinite(Number(match.longitude))) {
          ridesState.driver.lat = Number(match.latitude);
          ridesState.driver.lng = Number(match.longitude);
          if (!ridesState.driver.locationId && match.id) {
            ridesState.driver.locationId = match.id;
          }
        }
      } catch {}
    }

    const res = await apiFetch("/api/platform/rides/driver/register", {
      method: "POST",
      body: JSON.stringify({
        fullName,
        phone,
        mpesaPaymentInfo: mpesaPaymentInfo || phone,
        vehicleType,
        vehicleMakeModel: vehicleMakeModel || undefined,
        plateNumber,
        baseFareKes: baseFareKes !== undefined && Number.isFinite(baseFareKes) ? Math.max(0, Math.round(baseFareKes)) : undefined,
        perKmRateKes: perKmRateKes !== undefined && Number.isFinite(perKmRateKes) ? Math.max(0, Math.round(perKmRateKes)) : undefined,
        locationLabel: locationLabel || "Kenya",
        locationId: ridesState.driver.locationId || undefined,
        currentLat: ridesState.driver.lat ?? undefined,
        currentLng: ridesState.driver.lng ?? undefined,
      }),
    });

    if (!res.ok || !res.data?.success) {
      toast(extractErrorMsg(res, "Could not save driver profile."), "error");
      return;
    }

    toast("Driver profile saved! Toggle Online above to accept rides (0% commission).", "success");
    await loadDriverProfile(false);
  };

  window.handleDriverRideAction = async function handleDriverRideAction(rideId, action) {
    if (!rideId || !action) return;
    const res = await apiFetch(`/api/platform/rides/${encodeURIComponent(rideId)}/status`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });

    if (!res.ok || !res.data?.success) {
      toast(extractErrorMsg(res, `Could not ${action.toLowerCase()} ride.`), "error");
      return;
    }

    const labels = {
      ACCEPT: "Ride accepted! Head to pickup.",
      ARRIVING: "Rider notified you are arriving.",
      START: "Trip started!",
      COMPLETE: "Trip completed! Collect fare directly (0% commission).",
      CANCEL: "Ride cancelled.",
    };
    toast(labels[action] || "Ride status updated.", "success");
    await loadDriverProfile(false);
  };

  // --- Modal Lifecycle & Tab Switching ---
  window.switchRidesTab = function switchRidesTab(tab) {
    const nextTab = tab === "driver" ? "driver" : "book";
    ridesState.activeTab = nextTab;

    const bookTab = document.getElementById("rides-tab-book");
    const driverTab = document.getElementById("rides-tab-driver");
    const bookPanel = document.getElementById("rides-book-panel");
    const driverPanel = document.getElementById("rides-driver-panel");

    if (bookTab) {
      const active = nextTab === "book";
      bookTab.setAttribute("aria-selected", String(active));
      bookTab.classList.toggle("bg-emerald-700", active);
      bookTab.classList.toggle("text-white", active);
      bookTab.classList.toggle("bg-slate-100", !active);
      bookTab.classList.toggle("text-slate-700", !active);
    }
    if (driverTab) {
      const active = nextTab === "driver";
      driverTab.setAttribute("aria-selected", String(active));
      driverTab.classList.toggle("bg-emerald-700", active);
      driverTab.classList.toggle("text-white", active);
      driverTab.classList.toggle("bg-slate-100", !active);
      driverTab.classList.toggle("text-slate-700", !active);
    }
    if (bookPanel) bookPanel.classList.toggle("hidden", nextTab !== "book");
    if (driverPanel) driverPanel.classList.toggle("hidden", nextTab !== "driver");

    if (nextTab === "driver") {
      stopCanvasLoop();
      void loadDriverProfile(true);
    } else {
      stopDriverDashboardPoll();
      startCanvasLoop();
      void refreshNearbyRides();
      if (ridesState.activeRideRecord) {
        void pollActiveRideOnce();
      }
    }
    refreshIcons();
  };

  window.openRidesModal = async function openRidesModal(tab = "book") {
    initRidesBindings();
    const modal = document.getElementById("rides-modal");
    if (!modal) return;

    ridesState.isOpen = true;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");

    // Prefill rider details cleanly if empty
    const user = await resolvePlatformUser(false);
    const nameEl = document.getElementById("ride-rider-name");
    const phoneEl = document.getElementById("ride-rider-phone");
    if (nameEl && !nameEl.value.trim() && user?.fullName) {
      nameEl.value = user.fullName;
    }
    if (phoneEl && !phoneEl.value.trim()) {
      try {
        const savedPhone = localStorage.getItem(PHONE_STORAGE_KEY);
        if (savedPhone) phoneEl.value = savedPhone;
      } catch {}
    }

    // Restore active ride from localStorage
    if (!ridesState.activeRideRecord) {
      ridesState.activeRideRecord = readSavedActiveRide();
    }
    if (ridesState.activeRideRecord) {
      await pollActiveRideOnce();
      if (ridesState.activeRideRecord) {
        startRidePolling();
      }
    } else {
      renderActiveRideTracker();
    }

    window.selectRideVehicle(ridesState.selectedVehicle);
    window.switchRidesTab(tab);

    if (!ridesState.nearbyPollTimer) {
      ridesState.nearbyPollTimer = setInterval(() => {
        if (ridesState.isOpen && ridesState.activeTab === "book") {
          void refreshNearbyRides();
        }
      }, 10000);
    }

    requestAnimationFrame(() => renderRidesCanvas());
    refreshIcons(modal);
  };

  window.closeRidesModal = function closeRidesModal() {
    const modal = document.getElementById("rides-modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
    ridesState.isOpen = false;
    stopCanvasLoop();
    stopRidePolling();
    stopDriverDashboardPoll();
    if (ridesState.nearbyPollTimer) {
      clearInterval(ridesState.nearbyPollTimer);
      ridesState.nearbyPollTimer = null;
    }
  };

  function initRidesBindings() {
    if (ridesState.initialized) return;
    const modal = document.getElementById("rides-modal");
    if (!modal) return;
    ridesState.initialized = true;

    modal.addEventListener("click", (ev) => {
      if (ev.target === modal) {
        window.closeRidesModal();
        return;
      }

      const vehicleBtn = ev.target?.closest?.("[data-ride-vehicle]");
      if (vehicleBtn && !vehicleBtn.getAttribute("onclick")) {
        window.selectRideVehicle(vehicleBtn.getAttribute("data-ride-vehicle"));
        return;
      }

      const suggestBtn = ev.target?.closest?.("[data-ride-suggest-kind]");
      if (suggestBtn) {
        const kind = suggestBtn.getAttribute("data-ride-suggest-kind");
        const idx = Number(suggestBtn.getAttribute("data-ride-suggest-idx") || 0);
        const list = kind === "pickup" ? ridesState.pickupSuggestions : ridesState.dropoffSuggestions;
        applySelectedPlace(kind, list[idx]);
        return;
      }

      const driverActionBtn = ev.target?.closest?.("[data-driver-ride-id]");
      if (driverActionBtn) {
        const rideId = driverActionBtn.getAttribute("data-driver-ride-id");
        const action = driverActionBtn.getAttribute("data-driver-action");
        void window.handleDriverRideAction(rideId, action);
        return;
      }
    });

    const bookTab = document.getElementById("rides-tab-book");
    if (bookTab && !bookTab.getAttribute("onclick")) {
      bookTab.addEventListener("click", () => window.switchRidesTab("book"));
    }
    const driverTab = document.getElementById("rides-tab-driver");
    if (driverTab && !driverTab.getAttribute("onclick")) {
      driverTab.addEventListener("click", () => window.switchRidesTab("driver"));
    }

    const bindLocationInput = (inputId, kind) => {
      const input = document.getElementById(inputId);
      if (!input) return;
      input.addEventListener("input", () => {
        if (kind === "pickup") ridesState.pickup = null;
        else ridesState.dropoff = null;
        clearTimeout(kind === "pickup" ? ridesState.pickupSuggestTimer : ridesState.dropoffSuggestTimer);
        const timer = setTimeout(() => {
          void queryRideLocations(kind, input.value);
        }, 180);
        if (kind === "pickup") ridesState.pickupSuggestTimer = timer;
        else ridesState.dropoffSuggestTimer = timer;
      });
      input.addEventListener("focus", () => {
        void queryRideLocations(kind, input.value);
      });
    };

    bindLocationInput("ride-pickup-input", "pickup");
    bindLocationInput("ride-dropoff-input", "dropoff");

    const pickupGpsBtn = document.getElementById("ride-pickup-gps-btn");
    if (pickupGpsBtn && !pickupGpsBtn.getAttribute("onclick")) {
      pickupGpsBtn.addEventListener("click", () => void window.useRidePickupGps());
    }

    const requestBtn = document.getElementById("ride-request-btn");
    const requestForm = requestBtn?.closest?.("form");
    if (requestForm && !requestForm.getAttribute("onsubmit")) {
      requestForm.addEventListener("submit", (e) => {
        e.preventDefault();
        void window.requestRide();
      });
    }
    if (requestBtn && !requestBtn.getAttribute("onclick") && !(requestForm && requestBtn.type === "submit")) {
      requestBtn.addEventListener("click", () => void window.requestRide());
    }

    const cancelBtn = document.getElementById("ride-cancel-btn");
    if (cancelBtn && !cancelBtn.getAttribute("onclick")) {
      cancelBtn.addEventListener("click", () => void window.cancelActiveRide());
    }

    const ratingForm = document.getElementById("ride-rating-form");
    if (ratingForm && !ratingForm.getAttribute("onsubmit")) {
      ratingForm.addEventListener("submit", (e) => void window.submitRideRating(e));
    }

    const authGateBtn = document.querySelector("#rides-driver-auth-gate button");
    if (authGateBtn && !authGateBtn.getAttribute("onclick")) {
      authGateBtn.addEventListener("click", () => window.startRidesGoogleSignIn());
    }

    const onlineToggle = document.getElementById("rides-driver-online-toggle");
    if (onlineToggle && !onlineToggle.getAttribute("onchange") && !onlineToggle.getAttribute("onclick")) {
      if (onlineToggle.tagName === "INPUT") {
        onlineToggle.addEventListener("change", () => void window.toggleDriverOnline(onlineToggle.checked));
      } else {
        onlineToggle.addEventListener("click", () => void window.toggleDriverOnline());
      }
    }

    const driverGpsBtn = document.getElementById("driver-gps-btn");
    if (driverGpsBtn && !driverGpsBtn.getAttribute("onclick")) {
      driverGpsBtn.addEventListener("click", () => void window.useDriverGps());
    }

    const driverForm = document.getElementById("rides-driver-form");
    if (driverForm && !driverForm.getAttribute("onsubmit")) {
      driverForm.addEventListener("submit", (e) => void window.saveDriverProfile(e));
    }

    document.addEventListener("click", (ev) => {
      const pInput = document.getElementById("ride-pickup-input");
      const pBox = document.getElementById("ride-pickup-suggestions");
      if (pBox && pInput && !pBox.contains(ev.target) && ev.target !== pInput) {
        pBox.classList.add("hidden");
      }
      const dInput = document.getElementById("ride-dropoff-input");
      const dBox = document.getElementById("ride-dropoff-suggestions");
      if (dBox && dInput && !dBox.contains(ev.target) && ev.target !== dInput) {
        dBox.classList.add("hidden");
      }
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && ridesState.isOpen) {
        window.closeRidesModal();
      }
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    initRidesBindings();
    let shouldReopenDriver = false;
    try {
      shouldReopenDriver = sessionStorage.getItem(REOPEN_DRIVER_FLAG) === "1";
      if (shouldReopenDriver) sessionStorage.removeItem(REOPEN_DRIVER_FLAG);
    } catch {}
    if (shouldReopenDriver) {
      setTimeout(() => void window.openRidesModal("driver"), 250);
    }
  });
})();
