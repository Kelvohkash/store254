let subdomainCheckTimer = null;
let locationSearchTimer = null;
let activeLocationSearchSeq = 0;

const onboardLocationState = {
  countiesLoaded: false,
  countiesLoadingPromise: null,
  counties: [],
  googleMapsConfigured: false,
  selectedCounty: null,
  selectedLocation: null, // { id?, googlePlaceId?, name, kindLabel, constituencyId?, constituencyName?, countyName, lat?, lng? }
  usingCustomMode: false,
  pinLat: null,
  pinLng: null,
  pinMap: null,
  pinMarker: null,
};

const LOCATION_KIND_LABELS = {
  TOWN: "Town",
  ESTATE: "Estate",
  SHOPPING_CENTRE: "Shopping Centre / Market",
  TRADING_CENTRE: "Trading Centre",
};

function hideNearbyPreview() {
  const preview = document.getElementById("onboard-nearby-preview");
  const chips = document.getElementById("onboard-nearby-chips");
  if (preview) preview.classList.add("hidden");
  if (chips) chips.innerHTML = "";
}

function renderNearbyPreview(neighbors) {
  const preview = document.getElementById("onboard-nearby-preview");
  const chips = document.getElementById("onboard-nearby-chips");
  if (!preview || !chips) return;

  chips.innerHTML = "";
  if (!Array.isArray(neighbors) || neighbors.length === 0) {
    preview.classList.add("hidden");
    return;
  }

  for (const nbr of neighbors.slice(0, 6)) {
    const badge = document.createElement("span");
    badge.className =
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-semibold";
    const dist =
      typeof nbr.distanceKm === "number" ? ` · ${nbr.distanceKm.toFixed(1)} km` : "";
    badge.textContent = `${nbr.name}${dist}`;
    chips.appendChild(badge);
  }

  preview.classList.remove("hidden");
}

async function ensureOnboardLocationsLoaded() {
  if (onboardLocationState.countiesLoaded) return;
  if (onboardLocationState.countiesLoadingPromise) {
    return onboardLocationState.countiesLoadingPromise;
  }

  onboardLocationState.countiesLoadingPromise = (async () => {
    const [countiesRes, googleStatusRes] = await Promise.all([
      apiFetch("/api/platform/locations/counties"),
      apiFetch("/api/platform/locations/google-status"),
    ]);

    if (countiesRes.ok && Array.isArray(countiesRes.data?.counties)) {
      onboardLocationState.counties = countiesRes.data.counties;
      onboardLocationState.countiesLoaded = true;
    }

    if (googleStatusRes.ok && googleStatusRes.data?.googleMapsConfigured) {
      onboardLocationState.googleMapsConfigured = true;
      const badge = document.getElementById("onboard-maps-badge");
      if (badge) {
        badge.textContent = "Google Maps Live Enabled";
        badge.className =
          "text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700";
      }
    }
  })().finally(() => {
    onboardLocationState.countiesLoadingPromise = null;
  });

  return onboardLocationState.countiesLoadingPromise;
}

function showCountySearchResults(rawQuery) {
  const resultsEl = document.getElementById("onboard-county-results");
  if (!resultsEl) return;

  const q = String(rawQuery || "").trim().toLowerCase();
  const matches = onboardLocationState.counties
    .filter((c) => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => {
      if (q) {
        const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        if (ap !== bp) return ap - bp;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, 12);

  resultsEl.innerHTML = "";
  if (matches.length === 0) {
    const empty = document.createElement("div");
    empty.className = "px-3 py-2 text-xs text-slate-500";
    empty.textContent = onboardLocationState.countiesLoaded
      ? "No matching county found."
      : "Loading Kenyan counties...";
    resultsEl.appendChild(empty);
    resultsEl.classList.remove("hidden");
    return;
  }

  for (const county of matches) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors flex items-center justify-between gap-2";

    const nameSpan = document.createElement("span");
    nameSpan.className = "font-semibold text-slate-800 text-xs";
    nameSpan.textContent = county.name;

    const tagSpan = document.createElement("span");
    tagSpan.className = "text-[10px] font-semibold text-slate-400";
    tagSpan.textContent = "County";

    btn.append(nameSpan, tagSpan);
    btn.addEventListener("click", () => selectCounty(county));
    resultsEl.appendChild(btn);
  }

  resultsEl.classList.remove("hidden");
}

async function selectCounty(county) {
  onboardLocationState.selectedCounty = county;

  const hiddenCounty = document.getElementById("onboard-county");
  const countyWrap = document.getElementById("onboard-county-input-wrap");
  const countyResults = document.getElementById("onboard-county-results");
  const countyBanner = document.getElementById("onboard-selected-county-banner");
  const countyText = document.getElementById("onboard-selected-county-text");
  const locSearch = document.getElementById("onboard-location-search");

  if (hiddenCounty) hiddenCounty.value = county.id;
  if (countyResults) countyResults.classList.add("hidden");
  if (countyWrap) countyWrap.classList.add("hidden");
  if (countyBanner && countyText) {
    countyText.textContent = `${county.name} County`;
    countyBanner.classList.remove("hidden");
  }

  clearSelectedLocation();

  if (locSearch) {
    locSearch.disabled = false;
    locSearch.value = "";
    locSearch.placeholder = `Type town or shopping centre in ${county.name}...`;
    locSearch.focus();
  }

  // Preload optional constituencies dropdown in case user enters an unlisted shopping centre
  const customConstSelect = document.getElementById("onboard-custom-constituency");
  if (customConstSelect) {
    customConstSelect.innerHTML = "";
    const defOpt = document.createElement("option");
    defOpt.value = "";
    defOpt.textContent = `Auto-assign within ${county.name} (optional)...`;
    customConstSelect.appendChild(defOpt);

    apiFetch(
      `/api/platform/locations/constituencies?countyId=${encodeURIComponent(county.id)}`
    ).then((res) => {
      if (!res.ok || !Array.isArray(res.data?.constituencies)) return;
      if (onboardLocationState.selectedCounty?.id !== county.id) return;
      for (const cst of res.data.constituencies) {
        const opt = document.createElement("option");
        opt.value = cst.id;
        opt.textContent = cst.name;
        customConstSelect.appendChild(opt);
      }
    });
  }
}

function clearSelectedCounty() {
  onboardLocationState.selectedCounty = null;

  const hiddenCounty = document.getElementById("onboard-county");
  const countyWrap = document.getElementById("onboard-county-input-wrap");
  const countySearch = document.getElementById("onboard-county-search");
  const countyResults = document.getElementById("onboard-county-results");
  const countyBanner = document.getElementById("onboard-selected-county-banner");
  const locSearch = document.getElementById("onboard-location-search");
  const locResults = document.getElementById("onboard-location-results");

  if (hiddenCounty) hiddenCounty.value = "";
  if (countyBanner) countyBanner.classList.add("hidden");
  if (countyWrap) countyWrap.classList.remove("hidden");
  if (countyResults) countyResults.classList.add("hidden");

  clearSelectedLocation();

  if (locResults) {
    locResults.classList.add("hidden");
    locResults.innerHTML = "";
  }
  if (locSearch) {
    locSearch.value = "";
    locSearch.disabled = true;
    locSearch.placeholder = "Select county first, then type town or shopping centre...";
  }
  if (countySearch) {
    countySearch.value = "";
    countySearch.focus();
  }
}

function clearOnboardExactPin() {
  onboardLocationState.pinLat = null;
  onboardLocationState.pinLng = null;
  if (onboardLocationState.pinMap && onboardLocationState.pinMarker) {
    onboardLocationState.pinMap.removeLayer(onboardLocationState.pinMarker);
    onboardLocationState.pinMarker = null;
  }
  const statusEl = document.getElementById("onboard-pin-status");
  if (statusEl) statusEl.textContent = "Tap the map or use GPS to drop your shop pin.";
  const noteEl = document.getElementById("onboard-pin-note");
  if (noteEl) noteEl.value = "";
}

function getOnboardMapCenter() {
  if (Number.isFinite(onboardLocationState.pinLat) && Number.isFinite(onboardLocationState.pinLng)) {
    return { lat: onboardLocationState.pinLat, lng: onboardLocationState.pinLng, zoom: 16 };
  }
  const sel = onboardLocationState.selectedLocation;
  if (sel && Number.isFinite(Number(sel.lat)) && Number.isFinite(Number(sel.lng))) {
    return { lat: Number(sel.lat), lng: Number(sel.lng), zoom: 15 };
  }
  const county = onboardLocationState.selectedCounty;
  if (county && Number.isFinite(Number(county.centroidLat)) && Number.isFinite(Number(county.centroidLng))) {
    return { lat: Number(county.centroidLat), lng: Number(county.centroidLng), zoom: 12 };
  }
  return { lat: -1.286389, lng: 36.817223, zoom: 12 };
}

function setOnboardExactPin(lat, lng) {
  const fixedLat = Number(Number(lat).toFixed(6));
  const fixedLng = Number(Number(lng).toFixed(6));
  if (!Number.isFinite(fixedLat) || !Number.isFinite(fixedLng)) return;
  onboardLocationState.pinLat = fixedLat;
  onboardLocationState.pinLng = fixedLng;

  const statusEl = document.getElementById("onboard-pin-status");
  if (statusEl) {
    statusEl.textContent = `Pinned: ${fixedLat.toFixed(5)}, ${fixedLng.toFixed(5)} (drag to adjust)`;
  }
  if (onboardLocationState.pinMap && window.Store254Map && window.L) {
    const icon = window.Store254Map.createPinIcon({
      kind: "store",
      letter: "S",
      label: "Your Shop",
    });
    if (onboardLocationState.pinMarker) {
      onboardLocationState.pinMarker.setLatLng([fixedLat, fixedLng]);
      onboardLocationState.pinMarker.setIcon(icon);
    } else {
      onboardLocationState.pinMarker = window.L.marker([fixedLat, fixedLng], {
        icon,
        draggable: true,
      }).addTo(onboardLocationState.pinMap);
      onboardLocationState.pinMarker.on("dragend", (ev) => {
        const pos = ev.target.getLatLng();
        setOnboardExactPin(pos.lat, pos.lng);
      });
    }
    onboardLocationState.pinMap.setView([fixedLat, fixedLng], 16);
  }
}

function ensureOnboardPinMap(recenter = false) {
  const mapEl = document.getElementById("onboard-pin-map");
  if (!mapEl || !window.Store254Map?.isAvailable?.()) return null;
  const center = getOnboardMapCenter();
  if (!onboardLocationState.pinMap) {
    onboardLocationState.pinMap = window.Store254Map.createMap(mapEl, {
      lat: center.lat,
      lng: center.lng,
      zoom: center.zoom,
      onClick: ({ lat, lng }) => setOnboardExactPin(lat, lng),
    });
    if (Number.isFinite(onboardLocationState.pinLat) && Number.isFinite(onboardLocationState.pinLng)) {
      setOnboardExactPin(onboardLocationState.pinLat, onboardLocationState.pinLng);
    }
  } else {
    window.Store254Map.refreshSize(onboardLocationState.pinMap);
    if (recenter) {
      onboardLocationState.pinMap.setView([center.lat, center.lng], center.zoom);
    }
  }
  return onboardLocationState.pinMap;
}

function clearSelectedLocation() {
  onboardLocationState.selectedLocation = null;
  onboardLocationState.usingCustomMode = false;

  const card = document.getElementById("onboard-selected-location-card");
  const locWrap = document.getElementById("onboard-location-input-wrap");
  const customWrap = document.getElementById("onboard-custom-location-wrap");
  const customInput = document.getElementById("onboard-custom-location");
  const locSearch = document.getElementById("onboard-location-search");

  if (card) card.classList.add("hidden");
  if (customWrap) customWrap.classList.add("hidden");
  if (customInput) customInput.value = "";
  if (locWrap) locWrap.classList.remove("hidden");
  hideNearbyPreview();
  clearOnboardExactPin();

  if (locSearch && !locSearch.disabled) {
    locSearch.focus();
  }
}

function cancelCustomLocation() {
  onboardLocationState.usingCustomMode = false;
  const customWrap = document.getElementById("onboard-custom-location-wrap");
  const locWrap = document.getElementById("onboard-location-input-wrap");
  const locSearch = document.getElementById("onboard-location-search");

  if (customWrap) customWrap.classList.add("hidden");
  if (locWrap) locWrap.classList.remove("hidden");
  if (locSearch) {
    locSearch.focus();
    handleOnboardLocationSearch(locSearch.value);
  }
}

function openCustomLocationEntry(prefillQuery) {
  onboardLocationState.selectedLocation = null;
  onboardLocationState.usingCustomMode = true;

  const resultsEl = document.getElementById("onboard-location-results");
  const locWrap = document.getElementById("onboard-location-input-wrap");
  const customWrap = document.getElementById("onboard-custom-location-wrap");
  const customInput = document.getElementById("onboard-custom-location");

  if (resultsEl) resultsEl.classList.add("hidden");
  if (locWrap) locWrap.classList.add("hidden");
  if (customWrap) customWrap.classList.remove("hidden");
  hideNearbyPreview();

  if (customInput) {
    customInput.value = String(prefillQuery || "").trim();
    customInput.focus();
  }
}

function handleOnboardLocationSearch(rawQuery) {
  const county = onboardLocationState.selectedCounty;
  if (!county) return;

  const q = String(rawQuery || "").trim();
  if (locationSearchTimer) clearTimeout(locationSearchTimer);

  locationSearchTimer = setTimeout(async () => {
    const seq = ++activeLocationSearchSeq;
    const resultsEl = document.getElementById("onboard-location-results");
    if (!resultsEl) return;

    const townUrl = `/api/platform/locations/towns?countyId=${encodeURIComponent(
      county.id
    )}&q=${encodeURIComponent(q)}&limit=30`;

    const requests = [apiFetch(townUrl)];
    if (onboardLocationState.googleMapsConfigured && q.length >= 2) {
      requests.push(
        apiFetch("/api/platform/locations/google-autocomplete", {
          method: "POST",
          body: JSON.stringify({ query: q, countyId: county.id }),
        })
      );
    }

    const [townRes, googleRes] = await Promise.all(requests);
    if (seq !== activeLocationSearchSeq) return;

    const locations =
      townRes?.ok && Array.isArray(townRes.data?.locations)
        ? townRes.data.locations
        : [];
    const googleSuggestions =
      googleRes?.ok && Array.isArray(googleRes.data?.suggestions)
        ? googleRes.data.suggestions
        : [];

    resultsEl.innerHTML = "";

    if (locations.length > 0) {
      const hdr = document.createElement("div");
      hdr.className =
        "px-3 py-1.5 bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wide";
      hdr.textContent = q
        ? `Matching towns & centres in ${county.name}`
        : `Popular towns & centres in ${county.name}`;
      resultsEl.appendChild(hdr);

      for (const loc of locations) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors flex items-center justify-between gap-2";

        const left = document.createElement("div");
        left.className = "min-w-0";

        const title = document.createElement("div");
        title.className = "font-semibold text-slate-800 text-xs truncate";
        title.textContent = loc.name;

        const sub = document.createElement("div");
        sub.className = "text-[11px] text-emerald-700 font-medium truncate";
        sub.textContent = `${loc.constituencyName || ""} Constituency · ${loc.countyName || county.name}`;

        left.append(title, sub);

        const kindBadge = document.createElement("span");
        kindBadge.className =
          "shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600";
        kindBadge.textContent = LOCATION_KIND_LABELS[loc.kind] || "Centre";

        btn.append(left, kindBadge);
        btn.addEventListener("click", () => selectDirectoryLocation(loc));
        resultsEl.appendChild(btn);
      }
    }

    if (googleSuggestions.length > 0) {
      const ghdr = document.createElement("div");
      ghdr.className =
        "px-3 py-1.5 bg-emerald-50 text-[10px] font-bold text-emerald-700 uppercase tracking-wide";
      ghdr.textContent = "Google Maps Results";
      resultsEl.appendChild(ghdr);

      for (const item of googleSuggestions) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors flex flex-col";

        const title = document.createElement("span");
        title.className = "font-semibold text-slate-800 text-xs";
        title.textContent = item.mainText || item.fullText;

        const sub = document.createElement("span");
        sub.className = "text-[10px] text-slate-500";
        sub.textContent = item.secondaryText || item.fullText;

        btn.append(title);
        if (item.secondaryText) btn.append(sub);
        btn.addEventListener("click", () => selectGooglePlaceSuggestion(item));
        resultsEl.appendChild(btn);
      }
    }

    if (locations.length === 0 && googleSuggestions.length === 0) {
      const empty = document.createElement("div");
      empty.className = "px-3 py-2 text-xs text-slate-500";
      empty.textContent = q
        ? `No exact match for "${q}" in ${county.name}.`
        : `Start typing your town or shopping centre in ${county.name}.`;
      resultsEl.appendChild(empty);
    }

    const customBtn = document.createElement("button");
    customBtn.type = "button";
    customBtn.className =
      "w-full text-left px-3 py-2.5 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] transition-colors";
    customBtn.textContent = q
      ? `+ Add "${q}" as my shopping centre in ${county.name}`
      : `+ My shopping centre is not listed (enter name)`;
    customBtn.addEventListener("click", () => openCustomLocationEntry(q));
    resultsEl.appendChild(customBtn);

    resultsEl.classList.remove("hidden");
  }, q.length === 0 ? 10 : 180);
}

async function selectDirectoryLocation(loc) {
  const countyName =
    loc.countyName || onboardLocationState.selectedCounty?.name || "";

  onboardLocationState.selectedLocation = {
    id: loc.id,
    name: loc.name,
    kindLabel: LOCATION_KIND_LABELS[loc.kind] || "Centre",
    constituencyId: loc.constituencyId,
    constituencyName: loc.constituencyName || "",
    countyName,
    lat: Number.isFinite(Number(loc.latitude)) ? Number(loc.latitude) : null,
    lng: Number.isFinite(Number(loc.longitude)) ? Number(loc.longitude) : null,
  };
  if (onboardLocationState.pinMap && Number.isFinite(Number(loc.latitude)) && Number.isFinite(Number(loc.longitude))) {
    onboardLocationState.pinMap.setView([Number(loc.latitude), Number(loc.longitude)], 15);
  }
  onboardLocationState.usingCustomMode = false;

  const locWrap = document.getElementById("onboard-location-input-wrap");
  const resultsEl = document.getElementById("onboard-location-results");
  const card = document.getElementById("onboard-selected-location-card");
  const cardName = document.getElementById("onboard-selected-location-name");
  const cardMeta = document.getElementById("onboard-selected-location-meta");

  if (resultsEl) resultsEl.classList.add("hidden");
  if (locWrap) locWrap.classList.add("hidden");
  if (card && cardName && cardMeta) {
    cardName.textContent = `${loc.name} (${LOCATION_KIND_LABELS[loc.kind] || "Centre"})`;
    cardMeta.textContent = loc.constituencyName
      ? `Constituency: ${loc.constituencyName} · ${countyName} County`
      : `${countyName} County`;
    card.classList.remove("hidden");
  }

  const res = await apiFetch(
    `/api/platform/locations/towns/${encodeURIComponent(loc.id)}/nearby?limit=6`
  );
  if (res.ok && Array.isArray(res.data?.neighbors)) {
    renderNearbyPreview(res.data.neighbors);
  }
}

async function selectGooglePlaceSuggestion(item) {
  const county = onboardLocationState.selectedCounty;
  if (!county) return;

  const locWrap = document.getElementById("onboard-location-input-wrap");
  const resultsEl = document.getElementById("onboard-location-results");
  const card = document.getElementById("onboard-selected-location-card");
  const cardName = document.getElementById("onboard-selected-location-name");
  const cardMeta = document.getElementById("onboard-selected-location-meta");

  if (resultsEl) resultsEl.classList.add("hidden");
  if (locWrap) locWrap.classList.add("hidden");

  onboardLocationState.selectedLocation = {
    googlePlaceId: item.placeId,
    name: item.mainText || item.fullText,
    kindLabel: "Google Maps Place",
    countyName: county.name,
  };
  onboardLocationState.usingCustomMode = false;

  if (card && cardName && cardMeta) {
    cardName.textContent = `${item.mainText || item.fullText} (Google Maps)`;
    cardMeta.textContent = `Resolving linked constituency in ${county.name}...`;
    card.classList.remove("hidden");
  }

  const res = await apiFetch("/api/platform/locations/resolve-location", {
    method: "POST",
    body: JSON.stringify({
      countyId: county.id,
      googlePlaceId: item.placeId,
    }),
  });

  if (res.ok && res.data?.constituency?.name) {
    onboardLocationState.selectedLocation.constituencyId = res.data.constituency.id;
    onboardLocationState.selectedLocation.constituencyName = res.data.constituency.name;
    if (res.data.location && Number.isFinite(Number(res.data.location.latitude)) && Number.isFinite(Number(res.data.location.longitude))) {
      onboardLocationState.selectedLocation.lat = Number(res.data.location.latitude);
      onboardLocationState.selectedLocation.lng = Number(res.data.location.longitude);
      if (onboardLocationState.pinMap) {
        onboardLocationState.pinMap.setView([Number(res.data.location.latitude), Number(res.data.location.longitude)], 15);
      }
    }
    if (cardMeta) {
      cardMeta.textContent = `Constituency: ${res.data.constituency.name} · ${county.name} County`;
    }
    if (Array.isArray(res.data.neighbors)) {
      renderNearbyPreview(res.data.neighbors);
    }
  } else if (cardMeta) {
    cardMeta.textContent = `${county.name} County`;
  }
}

function checkSubdomainAvailability(rawVal) {
  const statusEl = document.getElementById("onboard-subdomain-status");
  if (!statusEl) return;

  const subdomain = String(rawVal || "").toLowerCase().trim().replace(/[^a-z0-9-]/g, "");
  const inputEl = document.getElementById("onboard-subdomain");
  if (inputEl && inputEl.value !== subdomain) {
    inputEl.value = subdomain;
  }

  if (subdomainCheckTimer) clearTimeout(subdomainCheckTimer);

  if (subdomain.length < 3) {
    statusEl.textContent = subdomain.length > 0 ? "Subdomain must be at least 3 characters." : "";
    statusEl.className = "mt-1 text-[11px] font-semibold text-slate-400";
    statusEl.classList.toggle("hidden", subdomain.length === 0);
    return;
  }

  statusEl.textContent = "Checking availability…";
  statusEl.className = "mt-1 text-[11px] font-semibold text-slate-500";
  statusEl.classList.remove("hidden");

  subdomainCheckTimer = setTimeout(async () => {
    const res = await apiFetch(`/api/platform/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`);
    if (res.ok && res.data?.data) {
      if (res.data.data.available) {
        statusEl.textContent = `✓ ${subdomain}.store254.co.ke is available!`;
        statusEl.className = "mt-1 text-[11px] font-semibold text-emerald-600";
      } else {
        statusEl.textContent = `✕ ${res.data.data.reason || `${subdomain}.store254.co.ke is already taken.`}`;
        statusEl.className = "mt-1 text-[11px] font-semibold text-rose-600";
      }
    }
  }, 300);
}

function setOnboardFeedback(message, type = "error") {
  const el = document.getElementById("onboard-feedback");
  if (!el) return;
  if (!message) {
    el.textContent = "";
    el.className = "hidden rounded-xl border px-3.5 py-2.5 text-xs font-semibold";
    return;
  }
  const palette =
    type === "success"
      ? "bg-emerald-50 border-emerald-300 text-emerald-900"
      : type === "info"
        ? "bg-slate-50 border-slate-300 text-slate-800"
        : "bg-rose-50 border-rose-300 text-rose-800";
  el.textContent = message;
  el.className = `rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${palette}`;
  el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function clearOnboardFeedback() {
  setOnboardFeedback("", "info");
}

function extractApiErrorMessage(res, fallback) {
  const err = res?.data?.error;
  if (Array.isArray(err?.issues) && err.issues.length > 0 && err.issues[0]?.message) {
    return err.issues[0].message;
  }
  if (typeof err?.message === "string" && err.message.trim()) {
    return err.message.trim();
  }
  if (typeof res?.data?.message === "string" && res.data.message.trim()) {
    return res.data.message.trim();
  }
  return fallback;
}

function getSignedInPlatformUserForOnboard() {
  const user = typeof window.getStore254PlatformUser === "function" ? window.getStore254PlatformUser() : null;
  return user && user.email ? user : null;
}

function syncOnboardModalAuthState() {
  const gateEl = document.getElementById("onboard-auth-gate");
  const formEl = document.getElementById("onboard-form");
  const emailEl = document.getElementById("onboard-email");
  const ownerNameEl = document.getElementById("onboard-owner-name");
  const ownerPhoneEl = document.getElementById("onboard-owner-phone");
  const user = getSignedInPlatformUserForOnboard();

  if (user) {
    if (gateEl) gateEl.classList.add("hidden");
    if (formEl) formEl.classList.remove("hidden");
    if (emailEl) {
      emailEl.value = user.email.trim().toLowerCase();
      emailEl.readOnly = true;
      emailEl.setAttribute("readonly", "readonly");
      emailEl.setAttribute("aria-readonly", "true");
    }
    if (ownerNameEl && !ownerNameEl.value.trim() && user.fullName) {
      ownerNameEl.value = user.fullName;
    }
    if (ownerPhoneEl && !ownerPhoneEl.value.trim() && user.phone) {
      ownerPhoneEl.value = String(user.phone).trim();
    }
  } else {
    if (gateEl) gateEl.classList.remove("hidden");
    if (formEl) formEl.classList.add("hidden");
    if (emailEl) {
      emailEl.value = "";
      emailEl.readOnly = true;
      emailEl.setAttribute("readonly", "readonly");
    }
  }

  if (typeof lucide !== "undefined") lucide.createIcons();
}

async function prepareOnboardModal() {
  void ensureOnboardLocationsLoaded();
  if (!getSignedInPlatformUserForOnboard() && typeof window.refreshStore254PlatformSession === "function") {
    await window.refreshStore254PlatformSession();
  }
  syncOnboardModalAuthState();
}

function startOnboardGoogleSignIn() {
  try {
    sessionStorage.setItem("store254_reopen_onboard", "1");
  } catch {}
  if (typeof window.startPlatformGoogleSignIn === "function") {
    window.startPlatformGoogleSignIn();
    return;
  }
  window.location.href = `/auth/google/login?return_to=${encodeURIComponent(window.location.href)}`;
}

window.syncOnboardModalAuthState = syncOnboardModalAuthState;
window.prepareOnboardModal = prepareOnboardModal;
window.startOnboardGoogleSignIn = startOnboardGoogleSignIn;

async function handleOnboardSubmit(e) {
  if (e && typeof e.preventDefault === "function") e.preventDefault();
  clearOnboardFeedback();

  const failValidation = (msg, focusEl) => {
    setOnboardFeedback(msg, "error");
    if (typeof showToast === "function") showToast(msg, "error");
    if (focusEl && typeof focusEl.focus === "function") {
      try {
        focusEl.focus();
      } catch {
        // ignore focus failures on hidden controls
      }
    }
  };

  const platformUser = getSignedInPlatformUserForOnboard();
  if (!platformUser) {
    syncOnboardModalAuthState();
    return failValidation("Please sign in with Google first before opening a store.");
  }

  const storeNameEl = document.getElementById("onboard-name");
  const subdomainEl = document.getElementById("onboard-subdomain");
  const ownerNameEl = document.getElementById("onboard-owner-name");
  const ownerPhoneEl = document.getElementById("onboard-owner-phone");
  const emailEl = document.getElementById("onboard-email");
  const passwordEl = document.getElementById("onboard-password");

  const storeName = (storeNameEl?.value || "").trim();
  const subdomain = (subdomainEl?.value || "").trim().toLowerCase();
  const ownerFullName = (ownerNameEl?.value || "").trim();
  const ownerPhone = (ownerPhoneEl?.value || "").trim();
  const ownerEmail = platformUser.email.trim().toLowerCase();
  if (emailEl) emailEl.value = ownerEmail;
  const ownerPassword = passwordEl?.value || "";
  const countyId = document.getElementById("onboard-county")?.value || "";
  const selected = onboardLocationState.selectedLocation;
  const customLocationName = (
    document.getElementById("onboard-custom-location")?.value || ""
  ).trim();
  const customConstituencyId =
    document.getElementById("onboard-custom-constituency")?.value || "";

  if (storeName.length < 2) {
    return failValidation("Please enter your business / store name (at least 2 characters).", storeNameEl);
  }
  if (!/^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$/.test(subdomain)) {
    return failValidation("Please enter a valid subdomain (lowercase letters, numbers, hyphens, at least 2 characters).", subdomainEl);
  }
  if (!countyId) {
    return failValidation("Please search and select your County from the dropdown list.", document.getElementById("onboard-county-search"));
  }

  const hasSelectedLocation = Boolean(
    selected?.id ||
      selected?.googlePlaceId ||
      (onboardLocationState.usingCustomMode && customLocationName.length >= 2)
  );

  if (!hasSelectedLocation) {
    return failValidation(
      onboardLocationState.usingCustomMode
        ? "Please enter your shopping centre name (at least 2 characters)."
        : "Please search and select your Town / Shopping Centre from the dropdown list.",
      onboardLocationState.usingCustomMode
        ? document.getElementById("onboard-custom-location")
        : document.getElementById("onboard-location-search")
    );
  }

  if (ownerFullName.length < 2) {
    return failValidation("Please enter the owner's full name.", ownerNameEl);
  }
  const ownerPhoneDigits = ownerPhone.replace(/\D/g, "");
  if (
    !ownerPhone ||
    !/^\+?[0-9\s()-]{9,24}$/.test(ownerPhone) ||
    ownerPhoneDigits.length < 9 ||
    ownerPhoneDigits.length > 15
  ) {
    return failValidation(
      "Please enter a valid phone number (e.g. 0712 345 678 or +254712345678).",
      ownerPhoneEl
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    return failValidation("Please enter a valid owner email address.", emailEl);
  }
  if (ownerPassword.length < 8) {
    return failValidation("Password must be at least 8 characters long.", passwordEl);
  }
  const acceptTermsEl = document.getElementById("onboard-accept-terms");
  if (acceptTermsEl && !acceptTermsEl.checked) {
    return failValidation(
      "Please agree to the Store254 Terms & Conditions, Privacy Policy, and Copyright Policy.",
      acceptTermsEl
    );
  }

  const btn = document.getElementById("btn-onboard");
  const originalBtnHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Submitting...";
  }

  const businessType = document.getElementById("onboard-type")?.value || "GENERAL";
  const portfolioMode = Boolean(
    document.getElementById("onboard-portfolio-mode")?.checked || businessType === "PORTFOLIO"
  );

  const payload = {
    storeName,
    subdomain,
    businessType,
    portfolioMode,
    primaryColor: "#2563eb",
    ownerFullName,
    ownerPhone,
    ownerEmail,
    ownerPassword,
    countyId,
    acceptedTerms: true,
  };

  if (selected?.id) {
    payload.locationId = selected.id;
    if (selected.constituencyId) payload.constituencyId = selected.constituencyId;
  } else if (selected?.googlePlaceId) {
    payload.googlePlaceId = selected.googlePlaceId;
    if (selected.constituencyId) payload.constituencyId = selected.constituencyId;
  } else {
    payload.customLocationName = customLocationName;
    if (customConstituencyId) payload.constituencyId = customConstituencyId;
  }

  if (Number.isFinite(onboardLocationState.pinLat) && Number.isFinite(onboardLocationState.pinLng)) {
    payload.exactLat = onboardLocationState.pinLat;
    payload.exactLng = onboardLocationState.pinLng;
    const note = (document.getElementById("onboard-pin-note")?.value || "").trim();
    if (note) payload.directionsNote = note;
  }

  try {
    const res = await apiFetch("/api/platform/register-store", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (res.ok && res.data?.success) {
      const okMsg =
        res.data.message ||
        "Business registered successfully! Your application is under review.";
      setOnboardFeedback(okMsg, "success");
      if (typeof showToast === "function") showToast(okMsg, "success");
      const formEl = e?.target && typeof e.target.reset === "function" ? e.target : document.getElementById("onboard-form");
      formEl?.reset?.();
      clearSelectedCounty();
      clearOnboardFeedback();
      if (typeof window.refreshStore254PlatformSession === "function") {
        await window.refreshStore254PlatformSession();
      }
      syncOnboardModalAuthState();
      toggleDrawer("onboard-modal", false);
    } else {
      const errMsg = extractApiErrorMessage(
        res,
        res.status === 0
          ? "Network error while submitting your store. Please check your connection and try again."
          : "Store registration failed. Please review your details and try again."
      );
      setOnboardFeedback(errMsg, "error");
      if (typeof showToast === "function") showToast(errMsg, "error");
      if (res.status === 401) {
        syncOnboardModalAuthState();
      }
    }
  } catch (err) {
    console.error("[Onboarding] Submit failed unexpectedly:", err);
    const errMsg = "Something went wrong while submitting your store. Please try again.";
    setOnboardFeedback(errMsg, "error");
    if (typeof showToast === "function") showToast(errMsg, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnHtml;
    }
    if (typeof lucide !== "undefined") lucide.createIcons();
  }
}

document.addEventListener("click", (ev) => {
  const countyWrap = document.getElementById("onboard-county-input-wrap");
  const countyResults = document.getElementById("onboard-county-results");
  if (countyWrap && countyResults && !countyWrap.contains(ev.target)) {
    countyResults.classList.add("hidden");
  }

  const locWrap = document.getElementById("onboard-location-input-wrap");
  const locResults = document.getElementById("onboard-location-results");
  if (locWrap && locResults && !locWrap.contains(ev.target)) {
    locResults.classList.add("hidden");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  syncOnboardModalAuthState();
  const onboardEmailEl = document.getElementById("onboard-email");
  if (onboardEmailEl) {
    onboardEmailEl.addEventListener("input", () => {
      const user = getSignedInPlatformUserForOnboard();
      onboardEmailEl.value = user ? user.email.trim().toLowerCase() : "";
    });
  }
  const onboardTypeEl = document.getElementById("onboard-type");
  const onboardPortfolioEl = document.getElementById("onboard-portfolio-mode");
  if (onboardTypeEl && onboardPortfolioEl) {
    onboardTypeEl.addEventListener("change", () => {
      if (onboardTypeEl.value === "PORTFOLIO") {
        onboardPortfolioEl.checked = true;
      }
    });
  }

  const pinToggleBtn = document.getElementById("onboard-pin-toggle-btn");
  const pinPanel = document.getElementById("onboard-pin-panel");
  const pinGpsBtn = document.getElementById("onboard-pin-gps-btn");
  if (pinToggleBtn && pinPanel) {
    pinToggleBtn.addEventListener("click", () => {
      const opening = pinPanel.classList.contains("hidden");
      pinPanel.classList.toggle("hidden", !opening);
      pinToggleBtn.textContent = opening ? "Hide Map" : "Pin on Map";
      if (opening) {
        ensureOnboardPinMap(true);
      }
    });
  }
  if (pinGpsBtn) {
    pinGpsBtn.addEventListener("click", () => {
      if (!navigator.geolocation) {
        if (typeof showToast === "function") showToast("GPS unavailable. Tap the map to drop your shop pin.", "error");
        return;
      }
      pinGpsBtn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          pinGpsBtn.disabled = false;
          if (pinPanel && pinPanel.classList.contains("hidden")) {
            pinPanel.classList.remove("hidden");
            if (pinToggleBtn) pinToggleBtn.textContent = "Hide Map";
          }
          ensureOnboardPinMap(false);
          setOnboardExactPin(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          pinGpsBtn.disabled = false;
          if (typeof showToast === "function") showToast("Location permission denied. Tap the map to place your pin.", "error");
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
      );
    });
  }
});
