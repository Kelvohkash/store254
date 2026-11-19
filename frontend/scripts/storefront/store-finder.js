// Store254 Store Pathfinder ("Find Store" Automatic Road/Walking Directions + Direct Ride Handoff)
(() => {
  "use strict";

  const finderState = {
    initialized: false,
    isOpen: false,
    store: null, // { name, subdomain, lat, lng, isExactPin, label, directionsNote, phone }
    origin: null, // { lat, lng, label, locationId }
    mode: "driving", // "driving" | "walking"
    route: null,
    following: false,
    watchId: null,
    lastRerouteCoords: null,
    originSuggestions: [],
    originSuggestTimer: null,
    map: null,
    routeLayer: null,
    storeMarker: null,
    originMarker: null,
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
    }
  }

  function refreshIcons(target) {
    if (typeof window.renderIcons === "function") {
      window.renderIcons(target);
    } else if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  function sanitizeTelHref(phone) {
    const cleaned = String(phone || "").replace(/[^\d+]/g, "");
    return cleaned.replace(/\D/g, "").length >= 6 ? `tel:${cleaned}` : "";
  }

  function normalizeStorePayload(raw) {
    if (!raw || typeof raw !== "object") return null;
    const settings = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
    const coords = raw.locationCoords && typeof raw.locationCoords === "object" ? raw.locationCoords : null;
    const exact = settings.exactLocation && typeof settings.exactLocation === "object" ? settings.exactLocation : null;

    const lat = Number(coords?.lat ?? exact?.lat ?? raw.lat);
    const lng = Number(coords?.lng ?? exact?.lng ?? raw.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const isExactPin = Boolean(coords?.isExactPin ?? (exact && Number.isFinite(Number(exact.lat))));
    const label =
      coords?.label ||
      exact?.label ||
      settings.physicalAddress ||
      raw.locationLabel ||
      raw.label ||
      raw.name ||
      "Store Location";
    const directionsNote =
      coords?.directionsNote ||
      exact?.directionsNote ||
      raw.directionsNote ||
      "";
    const phone =
      raw.phone ||
      settings.contactPhone ||
      settings.phone ||
      "";

    return {
      id: raw.id || "",
      name: raw.name || raw.subdomain || "Storefront",
      subdomain: raw.subdomain || "",
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      isExactPin,
      label: String(label || "").trim(),
      directionsNote: String(directionsNote || "").trim(),
      phone: String(phone || "").trim(),
    };
  }

  function updateModeButtons() {
    const driveBtn = document.getElementById("store-finder-mode-driving");
    const walkBtn = document.getElementById("store-finder-mode-walking");
    const isDrive = finderState.mode !== "walking";

    if (driveBtn) {
      driveBtn.setAttribute("aria-pressed", String(isDrive));
      driveBtn.classList.toggle("bg-emerald-700", isDrive);
      driveBtn.classList.toggle("text-white", isDrive);
      driveBtn.classList.toggle("font-extrabold", isDrive);
      driveBtn.classList.toggle("text-slate-700", !isDrive);
      driveBtn.classList.toggle("font-bold", !isDrive);
    }
    if (walkBtn) {
      const isWalk = !isDrive;
      walkBtn.setAttribute("aria-pressed", String(isWalk));
      walkBtn.classList.toggle("bg-emerald-700", isWalk);
      walkBtn.classList.toggle("text-white", isWalk);
      walkBtn.classList.toggle("font-extrabold", isWalk);
      walkBtn.classList.toggle("text-slate-700", !isWalk);
      walkBtn.classList.toggle("font-bold", !isWalk);
    }
  }

  function updateFollowButton() {
    const btn = document.getElementById("store-finder-follow-btn");
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(finderState.following));
    btn.classList.toggle("bg-sky-600", finderState.following);
    btn.classList.toggle("text-white", finderState.following);
    btn.classList.toggle("border-sky-600", finderState.following);
    btn.classList.toggle("bg-white", !finderState.following);
    btn.classList.toggle("text-slate-800", !finderState.following);
    btn.classList.toggle("border-slate-300", !finderState.following);
    const labelSpan = btn.querySelector("span");
    if (labelSpan) {
      labelSpan.textContent = finderState.following ? "Following Live" : "Live Follow";
    }
  }

  function updateGoogleMapsAndCallLinks() {
    const gmapsLink = document.getElementById("store-finder-gmaps-link");
    const callLink = document.getElementById("store-finder-call-link");
    const store = finderState.store;
    if (!store) return;

    if (gmapsLink && window.Store254Map) {
      gmapsLink.href = window.Store254Map.buildGoogleMapsDirectionsUrl({
        toLat: store.lat,
        toLng: store.lng,
        fromLat: finderState.origin?.lat,
        fromLng: finderState.origin?.lng,
        mode: finderState.mode,
      });
    }
    if (callLink) {
      const tel = sanitizeTelHref(store.phone);
      if (tel) {
        callLink.href = tel;
        callLink.classList.remove("hidden");
      } else {
        callLink.removeAttribute("href");
        callLink.classList.add("hidden");
      }
    }
  }

  function ensureFinderMap() {
    const mapEl = document.getElementById("store-finder-map");
    if (!mapEl || !window.Store254Map?.isAvailable?.()) return null;

    const store = finderState.store;
    if (!finderState.map) {
      finderState.map = window.Store254Map.createMap(mapEl, {
        lat: store?.lat ?? window.Store254Map.DEFAULT_CENTER.lat,
        lng: store?.lng ?? window.Store254Map.DEFAULT_CENTER.lng,
        zoom: 15,
        onClick: ({ lat, lng }) => {
          void setFinderOriginCoords(lat, lng);
        },
      });
      if (finderState.map && window.L) {
        finderState.routeLayer = window.L.layerGroup().addTo(finderState.map);
      }
    } else {
      window.Store254Map.refreshSize(finderState.map);
    }
    return finderState.map;
  }

  function syncFinderMarkers() {
    const map = ensureFinderMap();
    if (!map || !window.L || !window.Store254Map) return;
    const store = finderState.store;

    if (store) {
      const storeIcon = window.Store254Map.createPinIcon({
        kind: "store",
        letter: "S",
        label: store.name,
      });
      if (finderState.storeMarker) {
        finderState.storeMarker.setLatLng([store.lat, store.lng]);
        finderState.storeMarker.setIcon(storeIcon);
      } else {
        finderState.storeMarker = window.L.marker([store.lat, store.lng], {
          icon: storeIcon,
        }).addTo(map);
      }
    }

    if (finderState.origin && Number.isFinite(finderState.origin.lat) && Number.isFinite(finderState.origin.lng)) {
      const originIcon = window.Store254Map.createPinIcon({
        kind: "user",
        label: finderState.origin.label || "Start",
      });
      if (finderState.originMarker) {
        finderState.originMarker.setLatLng([finderState.origin.lat, finderState.origin.lng]);
        finderState.originMarker.setIcon(originIcon);
      } else {
        finderState.originMarker = window.L.marker([finderState.origin.lat, finderState.origin.lng], {
          icon: originIcon,
          draggable: true,
        }).addTo(map);
        finderState.originMarker.on("dragend", (ev) => {
          const pos = ev.target.getLatLng();
          void setFinderOriginCoords(pos.lat, pos.lng);
        });
      }
    } else if (finderState.originMarker) {
      map.removeLayer(finderState.originMarker);
      finderState.originMarker = null;
    }

    if (store && !finderState.origin) {
      map.setView([store.lat, store.lng], store.isExactPin ? 16 : 14);
    }
  }

  function renderFinderRouteSummaryAndSteps(route) {
    const summaryEl = document.getElementById("store-finder-summary");
    const stepsEl = document.getElementById("store-finder-steps");
    const store = finderState.store;
    if (!summaryEl || !stepsEl || !store) return;

    if (!route) {
      summaryEl.innerHTML = `<span>Tap anywhere on the map, search your town, or tap <strong>Use My GPS</strong> to generate an automatic route.</span>`;
      stepsEl.innerHTML = `<p class="text-xs text-slate-500 py-3 text-center">Waiting for starting location…</p>`;
      return;
    }

    const modeLabel = route.mode === "walking" ? "Walking Path" : "Driving / Boda Path";
    const sourceBadge =
      route.source === "osrm"
        ? `<span class="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-extrabold">Road Pathfinder</span>`
        : `<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">Direct Estimate</span>`;

    summaryEl.innerHTML = `
      <span class="flex items-center gap-2 flex-wrap">
        <span>${esc(modeLabel)} · <strong>${Number(route.distanceKm).toFixed(1)} km</strong> · <strong>~${Math.round(Number(route.durationMinutes || 1))} min</strong></span>
      </span>
      ${sourceBadge}`;

    const steps = Array.isArray(route.steps) ? route.steps : [];
    if (steps.length === 0) {
      stepsEl.innerHTML = `<p class="text-xs text-slate-500 py-3 text-center">Follow the highlighted route line to ${esc(store.name)}.</p>`;
      return;
    }

    stepsEl.innerHTML = steps
      .map((step, idx) => {
        const distText = window.Store254Map?.formatMeters?.(step.distanceMeters) || "";
        return `
          <div class="s254-step-item">
            <div class="flex items-center gap-2 min-w-0">
              <span class="s254-step-num">${idx + 1}</span>
              <span class="text-slate-800 font-semibold leading-snug">${esc(step.instruction || "Continue")}</span>
            </div>
            ${distText ? `<span class="s254-step-dist">${esc(distText)}</span>` : ""}
          </div>`;
      })
      .join("");
  }

  async function calculateAndRenderFinderPath() {
    const store = finderState.store;
    const origin = finderState.origin;
    updateGoogleMapsAndCallLinks();
    syncFinderMarkers();

    if (!store || !origin || !window.Store254Map) {
      finderState.routeLayer?.clearLayers();
      renderFinderRouteSummaryAndSteps(null);
      return;
    }

    const summaryEl = document.getElementById("store-finder-summary");
    if (summaryEl) {
      summaryEl.innerHTML = `<span>Building automatic ${finderState.mode === "walking" ? "walking" : "road"} pathfinder to ${esc(store.name)}…</span>`;
    }

    const { route } = await window.Store254Map.fetchRoute({
      fromLat: origin.lat,
      fromLng: origin.lng,
      toLat: store.lat,
      toLng: store.lng,
      mode: finderState.mode,
    });

    if (!finderState.isOpen || !route) return;
    finderState.route = route;
    finderState.lastRerouteCoords = { lat: origin.lat, lng: origin.lng };

    if (finderState.map && finderState.routeLayer) {
      window.Store254Map.drawRoute(finderState.map, finderState.routeLayer, route.geometry, {
        color: finderState.mode === "walking" ? "#0284c7" : "#059669",
        shadowColor: "#064e3b",
        weight: 5,
        dashed: route.source === "fallback",
        badgeText: `${Number(route.distanceKm).toFixed(1)} km · ~${route.durationMinutes} min`,
        fitBounds: true,
      });
    }

    renderFinderRouteSummaryAndSteps(route);
  }

  async function setFinderOriginCoords(lat, lng, explicitLabel) {
    const fixedLat = Number(Number(lat).toFixed(6));
    const fixedLng = Number(Number(lng).toFixed(6));
    if (!Number.isFinite(fixedLat) || !Number.isFinite(fixedLng)) return;

    let label = explicitLabel || "";
    let locationId = "";
    if (!label) {
      try {
        const res = await apiFetch(
          `/api/platform/locations/nearest?lat=${encodeURIComponent(fixedLat)}&lng=${encodeURIComponent(fixedLng)}`
        );
        const loc = res.ok ? res.data?.location : null;
        if (loc?.name) {
          locationId = loc.id || "";
          label = `${loc.name} (${fixedLat.toFixed(4)}, ${fixedLng.toFixed(4)})`;
        }
      } catch {}
    }
    if (!label) {
      label = `Start (${fixedLat.toFixed(4)}, ${fixedLng.toFixed(4)})`;
    }

    finderState.origin = { lat: fixedLat, lng: fixedLng, label, locationId };
    const input = document.getElementById("store-finder-origin-input");
    if (input) input.value = label;
    document.getElementById("store-finder-origin-suggestions")?.classList.add("hidden");

    await calculateAndRenderFinderPath();
  }

  async function detectFinderOriginAutomatically() {
    const gpsBtn = document.getElementById("store-finder-gps-btn");
    if (gpsBtn) gpsBtn.disabled = true;

    const fallbackToBuyerLocation = async () => {
      const buyerLoc =
        typeof window.getStore254BuyerLocation === "function"
          ? window.getStore254BuyerLocation()
          : null;
      if (buyerLoc && Number.isFinite(Number(buyerLoc.lat)) && Number.isFinite(Number(buyerLoc.lng))) {
        await setFinderOriginCoords(Number(buyerLoc.lat), Number(buyerLoc.lng), buyerLoc.locationName || "My Saved Area");
        return true;
      }
      if (buyerLoc?.locationId) {
        try {
          const res = await apiFetch(`/api/platform/locations/towns/${encodeURIComponent(buyerLoc.locationId)}/nearby?limit=1`);
          const loc = res.ok ? res.data?.location : null;
          if (loc && Number.isFinite(Number(loc.latitude)) && Number.isFinite(Number(loc.longitude))) {
            await setFinderOriginCoords(Number(loc.latitude), Number(loc.longitude), loc.name);
            return true;
          }
        } catch {}
      }
      try {
        const res = await apiFetch("/api/platform/locations/nearest");
        const loc = res.ok ? res.data?.location : null;
        if (loc && Number.isFinite(Number(loc.latitude)) && Number.isFinite(Number(loc.longitude))) {
          await setFinderOriginCoords(Number(loc.latitude), Number(loc.longitude), loc.name);
          return true;
        }
      } catch {}
      return false;
    };

    try {
      if (!navigator.geolocation) {
        await fallbackToBuyerLocation();
        return;
      }
      await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await setFinderOriginCoords(pos.coords.latitude, pos.coords.longitude, "My Current GPS");
            resolve();
          },
          async () => {
            await fallbackToBuyerLocation();
            resolve();
          },
          { enableHighAccuracy: true, timeout: 5500, maximumAge: 30000 }
        );
      });
    } finally {
      if (gpsBtn) gpsBtn.disabled = false;
    }
  }

  function stopLiveFollow() {
    finderState.following = false;
    if (finderState.watchId !== null && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(finderState.watchId);
      } catch {}
      finderState.watchId = null;
    }
    updateFollowButton();
  }

  function toggleLiveFollow() {
    if (finderState.following) {
      stopLiveFollow();
      return;
    }
    if (!navigator.geolocation) {
      toast("Live GPS follow is unavailable on this browser.", "error");
      return;
    }
    finderState.following = true;
    updateFollowButton();
    finderState.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const prev = finderState.lastRerouteCoords;
        const movedKm =
          prev && window.Store254Map
            ? window.Store254Map.haversineKm(prev.lat, prev.lng, lat, lng)
            : 999;

        finderState.origin = {
          lat,
          lng,
          label: "Live GPS Location",
          locationId: "",
        };
        if (finderState.originMarker && finderState.map) {
          finderState.originMarker.setLatLng([lat, lng]);
        }
        if (movedKm > 0.08) {
          void calculateAndRenderFinderPath();
        }
      },
      () => {
        toast("Could not keep live GPS lock.", "error");
        stopLiveFollow();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }

  async function queryFinderOrigins(rawQuery) {
    const box = document.getElementById("store-finder-origin-suggestions");
    if (!box) return;
    const q = String(rawQuery || "").trim();
    if (q.length < 2) {
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }
    const res = await apiFetch(`/api/platform/locations/towns?q=${encodeURIComponent(q)}&limit=7`);
    const locs = res.ok && Array.isArray(res.data?.locations) ? res.data.locations : [];
    finderState.originSuggestions = locs;
    if (locs.length === 0) {
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }
    box.innerHTML = locs
      .map(
        (loc, idx) =>
          `<button type="button" data-finder-origin-idx="${idx}" class="w-full text-left px-3 py-2 hover:bg-emerald-50 flex items-center justify-between gap-2 text-xs">
            <span class="min-w-0">
              <strong class="block text-slate-900 truncate">${esc(loc.name)}</strong>
              <span class="block text-[10px] text-emerald-700 truncate">${esc([loc.constituencyName, loc.countyName].filter(Boolean).join(" · "))}</span>
            </span>
          </button>`
      )
      .join("");
    box.classList.remove("hidden");
  }

  function initStoreFinderBindings() {
    if (finderState.initialized) return;
    const modal = document.getElementById("store-finder-modal");
    if (!modal) return;
    finderState.initialized = true;

    modal.addEventListener("click", (ev) => {
      if (ev.target === modal) {
        window.closeStoreFinder();
        return;
      }
      const suggestBtn = ev.target?.closest?.("[data-finder-origin-idx]");
      if (suggestBtn) {
        const loc = finderState.originSuggestions[Number(suggestBtn.dataset.finderOriginIdx)];
        if (loc && Number.isFinite(Number(loc.latitude)) && Number.isFinite(Number(loc.longitude))) {
          const label = loc.countyName ? `${loc.name}, ${loc.countyName}` : loc.name;
          void setFinderOriginCoords(Number(loc.latitude), Number(loc.longitude), label);
        }
      }
    });

    document.getElementById("store-finder-mode-driving")?.addEventListener("click", () => {
      finderState.mode = "driving";
      updateModeButtons();
      void calculateAndRenderFinderPath();
    });
    document.getElementById("store-finder-mode-walking")?.addEventListener("click", () => {
      finderState.mode = "walking";
      updateModeButtons();
      void calculateAndRenderFinderPath();
    });
    document.getElementById("store-finder-gps-btn")?.addEventListener("click", () => {
      void detectFinderOriginAutomatically();
    });
    document.getElementById("store-finder-follow-btn")?.addEventListener("click", () => {
      toggleLiveFollow();
    });
    document.getElementById("store-finder-ride-btn")?.addEventListener("click", () => {
      const store = finderState.store;
      const origin = finderState.origin;
      if (!store) return;
      window.closeStoreFinder();
      if (typeof window.openRidesModal === "function") {
        void window.openRidesModal("book", {
          pickup: origin
            ? { lat: origin.lat, lng: origin.lng, label: origin.label, locationId: origin.locationId || "" }
            : null,
          dropoff: {
            lat: store.lat,
            lng: store.lng,
            label: store.name ? `${store.name} (${store.label || "Store"})` : store.label,
          },
        });
      }
    });

    const originInput = document.getElementById("store-finder-origin-input");
    const originBox = document.getElementById("store-finder-origin-suggestions");
    if (originInput) {
      originInput.addEventListener("input", () => {
        clearTimeout(finderState.originSuggestTimer);
        finderState.originSuggestTimer = setTimeout(() => {
          void queryFinderOrigins(originInput.value);
        }, 180);
      });
    }
    document.addEventListener("click", (ev) => {
      if (originBox && originInput && !originBox.contains(ev.target) && ev.target !== originInput) {
        originBox.classList.add("hidden");
      }
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && finderState.isOpen) {
        window.closeStoreFinder();
      }
    });
  }

  window.openStoreFinder = async function openStoreFinder(rawStore) {
    initStoreFinderBindings();
    const store = normalizeStorePayload(rawStore);
    const modal = document.getElementById("store-finder-modal");
    if (!modal || !store) {
      toast("Location coordinates are not set for this store yet.", "error");
      return;
    }

    finderState.store = store;
    finderState.origin = null;
    finderState.route = null;
    finderState.isOpen = true;
    stopLiveFollow();

    const titleEl = document.getElementById("store-finder-title");
    const badgeEl = document.getElementById("store-finder-pin-badge");
    const addrEl = document.getElementById("store-finder-address");
    const noteEl = document.getElementById("store-finder-note");

    if (titleEl) titleEl.textContent = `Find ${store.name}`;
    if (badgeEl) {
      badgeEl.textContent = store.isExactPin ? "Exact Pinned Location" : "Store Area";
      badgeEl.className = store.isExactPin
        ? "inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200"
        : "inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200";
    }
    if (addrEl) {
      addrEl.textContent = store.label || `${store.lat.toFixed(5)}, ${store.lng.toFixed(5)}`;
    }
    if (noteEl) {
      if (store.directionsNote) {
        noteEl.textContent = `Landmark: ${store.directionsNote}`;
        noteEl.classList.remove("hidden");
      } else {
        noteEl.textContent = "";
        noteEl.classList.add("hidden");
      }
    }

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");

    updateModeButtons();
    updateGoogleMapsAndCallLinks();
    ensureFinderMap();
    syncFinderMarkers();
    renderFinderRouteSummaryAndSteps(null);
    refreshIcons(modal);

    await detectFinderOriginAutomatically();
  };

  window.openActiveStoreFinder = function openActiveStoreFinder() {
    const tenant = state?.activeTenant;
    if (!tenant) return;
    void window.openStoreFinder(tenant);
  };

  window.closeStoreFinder = function closeStoreFinder() {
    const modal = document.getElementById("store-finder-modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
    finderState.isOpen = false;
    stopLiveFollow();
  };
})();
