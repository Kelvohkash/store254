let subdomainCheckTimer = null;
let locationSearchTimer = null;
let activeLocationSearchSeq = 0;

const onboardLocationState = {
  countiesLoaded: false,
  countiesLoadingPromise: null,
  counties: [],
  googleMapsConfigured: false,
  selectedCounty: null,
  selectedLocation: null, // { id?, googlePlaceId?, name, kindLabel, constituencyId?, constituencyName?, countyName }
  usingCustomMode: false,
};

const LOCATION_KIND_LABELS = {
  TOWN: "Town / Ward",
  ESTATE: "Estate",
  SHOPPING_CENTRE: "Shopping Centre / Market",
  TRADING_CENTRE: "Centre / Village",
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
  };
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

async function handleOnboardSubmit(e) {
  e.preventDefault();

  const countyId = document.getElementById("onboard-county")?.value || "";
  const selected = onboardLocationState.selectedLocation;
  const customLocationName = (
    document.getElementById("onboard-custom-location")?.value || ""
  ).trim();
  const customConstituencyId =
    document.getElementById("onboard-custom-constituency")?.value || "";

  if (!countyId) {
    showToast("Please search and select your County.", true);
    document.getElementById("onboard-county-search")?.focus();
    return;
  }

  const hasSelectedLocation = Boolean(
    selected?.id ||
      selected?.googlePlaceId ||
      (onboardLocationState.usingCustomMode && customLocationName.length >= 2)
  );

  if (!hasSelectedLocation) {
    showToast("Please search and select your Town / Shopping Centre.", true);
    document.getElementById("onboard-location-search")?.focus();
    return;
  }

  const btn = document.getElementById("btn-onboard");
  const originalBtnHtml = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = "Submitting...";

  const payload = {
    storeName: document.getElementById("onboard-name").value.trim(),
    subdomain: document.getElementById("onboard-subdomain").value.trim(),
    businessType: document.getElementById("onboard-type").value,
    primaryColor: "#9a3412",
    ownerFullName: document.getElementById("onboard-owner-name").value.trim(),
    ownerEmail: document.getElementById("onboard-email").value.trim(),
    ownerPassword: document.getElementById("onboard-password").value,
    countyId,
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

  const res = await apiFetch("/api/platform/register-store", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  btn.disabled = false;
  btn.innerHTML = originalBtnHtml;
  if (typeof lucide !== "undefined") lucide.createIcons();

  if (res.ok && res.data?.success) {
    showToast(res.data.message || "Business registered successfully!");
    e.target.reset();
    clearSelectedCounty();
    toggleDrawer("onboard-modal", false);
  } else {
    showToast(res.data?.error?.message || res.data?.message || "Registration failed", true);
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
  ensureOnboardLocationsLoaded();
});
