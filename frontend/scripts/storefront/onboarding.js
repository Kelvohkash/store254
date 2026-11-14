let subdomainCheckTimer = null;
let googlePlaceSearchTimer = null;

const onboardLocationState = {
  countiesLoaded: false,
  googleMapsConfigured: false,
  townsInConstituency: [],
  selectedGooglePlace: null,
};

const LOCATION_KIND_LABELS = {
  TOWN: "Town",
  ESTATE: "Estate",
  SHOPPING_CENTRE: "Shopping Centre",
  TRADING_CENTRE: "Centre",
};

function resetLocationSelect(selectEl, placeholder, disabled = true) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  const opt = document.createElement("option");
  opt.value = "";
  opt.textContent = placeholder;
  selectEl.appendChild(opt);
  selectEl.disabled = disabled;
}

function renderTownOptions(filterQuery = "") {
  const locationSelect = document.getElementById("onboard-location");
  if (!locationSelect) return;

  const q = String(filterQuery || "").trim().toLowerCase();
  const filtered = q
    ? onboardLocationState.townsInConstituency.filter((loc) =>
        loc.name.toLowerCase().includes(q)
      )
    : onboardLocationState.townsInConstituency;

  const previousVal = locationSelect.value;
  locationSelect.innerHTML = "";

  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent =
    filtered.length > 0
      ? `Select Town / Shopping Centre (${filtered.length})...`
      : "No matching centre in directory — use custom or Google Maps";
  locationSelect.appendChild(defaultOpt);

  for (const loc of filtered) {
    const opt = document.createElement("option");
    opt.value = loc.id;
    const kindLabel = LOCATION_KIND_LABELS[loc.kind] || "Centre";
    opt.textContent = `${loc.name} (${kindLabel})`;
    locationSelect.appendChild(opt);
  }

  const customOpt = document.createElement("option");
  customOpt.value = "__custom__";
  customOpt.textContent = "+ My shopping centre is not listed (enter name)";
  locationSelect.appendChild(customOpt);

  locationSelect.disabled = false;
  if (
    previousVal &&
    Array.from(locationSelect.options).some((o) => o.value === previousVal)
  ) {
    locationSelect.value = previousVal;
  }
}

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

function clearSelectedGooglePlace() {
  onboardLocationState.selectedGooglePlace = null;
  const banner = document.getElementById("onboard-selected-google-banner");
  const textEl = document.getElementById("onboard-selected-google-text");
  if (banner) banner.classList.add("hidden");
  if (textEl) textEl.textContent = "";
  hideNearbyPreview();
}

async function ensureOnboardLocationsLoaded() {
  if (onboardLocationState.countiesLoaded) return;
  const countySelect = document.getElementById("onboard-county");
  if (!countySelect) return;

  const [countiesRes, googleStatusRes] = await Promise.all([
    apiFetch("/api/platform/locations/counties"),
    apiFetch("/api/platform/locations/google-status"),
  ]);

  if (countiesRes.ok && Array.isArray(countiesRes.data?.counties)) {
    countySelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select County (47)...";
    countySelect.appendChild(placeholder);

    for (const county of countiesRes.data.counties) {
      const opt = document.createElement("option");
      opt.value = county.id;
      opt.textContent = county.name;
      countySelect.appendChild(opt);
    }
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
}

async function handleOnboardCountyChange(countyId) {
  const constSelect = document.getElementById("onboard-constituency");
  const locSelect = document.getElementById("onboard-location");
  const searchInput = document.getElementById("onboard-location-search");
  const customWrap = document.getElementById("onboard-custom-location-wrap");
  const googleResults = document.getElementById("onboard-google-results");

  onboardLocationState.townsInConstituency = [];
  clearSelectedGooglePlace();
  hideNearbyPreview();
  if (customWrap) customWrap.classList.add("hidden");
  if (googleResults) {
    googleResults.classList.add("hidden");
    googleResults.innerHTML = "";
  }
  if (searchInput) {
    searchInput.value = "";
    searchInput.disabled = true;
  }
  resetLocationSelect(locSelect, "Select Constituency first...", true);

  if (!countyId) {
    resetLocationSelect(constSelect, "Select County first...", true);
    return;
  }

  resetLocationSelect(constSelect, "Loading constituencies...", true);
  const res = await apiFetch(
    `/api/platform/locations/constituencies?countyId=${encodeURIComponent(countyId)}`
  );

  if (!res.ok || !Array.isArray(res.data?.constituencies)) {
    resetLocationSelect(constSelect, "Could not load constituencies", true);
    return;
  }

  constSelect.innerHTML = "";
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = `Select Constituency (${res.data.constituencies.length})...`;
  constSelect.appendChild(defaultOpt);

  for (const constituency of res.data.constituencies) {
    const opt = document.createElement("option");
    opt.value = constituency.id;
    opt.textContent = constituency.name;
    constSelect.appendChild(opt);
  }
  constSelect.disabled = false;
}

async function handleOnboardConstituencyChange(constituencyId) {
  const countyId = document.getElementById("onboard-county")?.value || "";
  const locSelect = document.getElementById("onboard-location");
  const searchInput = document.getElementById("onboard-location-search");
  const customWrap = document.getElementById("onboard-custom-location-wrap");
  const googleResults = document.getElementById("onboard-google-results");

  clearSelectedGooglePlace();
  hideNearbyPreview();
  if (customWrap) customWrap.classList.add("hidden");
  if (googleResults) {
    googleResults.classList.add("hidden");
    googleResults.innerHTML = "";
  }

  if (!constituencyId) {
    onboardLocationState.townsInConstituency = [];
    if (searchInput) {
      searchInput.value = "";
      searchInput.disabled = true;
    }
    resetLocationSelect(locSelect, "Select Constituency first...", true);
    return;
  }

  resetLocationSelect(locSelect, "Loading towns & shopping centres...", true);
  const res = await apiFetch(
    `/api/platform/locations/towns?countyId=${encodeURIComponent(
      countyId
    )}&constituencyId=${encodeURIComponent(constituencyId)}&limit=800`
  );

  if (res.ok && Array.isArray(res.data?.locations)) {
    onboardLocationState.townsInConstituency = res.data.locations;
  } else {
    onboardLocationState.townsInConstituency = [];
  }

  if (searchInput) {
    searchInput.value = "";
    searchInput.disabled = false;
  }
  renderTownOptions("");
}

function handleOnboardLocationSearch(rawQuery) {
  const q = String(rawQuery || "").trim();
  renderTownOptions(q);

  if (googlePlaceSearchTimer) clearTimeout(googlePlaceSearchTimer);
  const resultsEl = document.getElementById("onboard-google-results");

  if (!onboardLocationState.googleMapsConfigured || q.length < 2) {
    if (resultsEl) {
      resultsEl.classList.add("hidden");
      resultsEl.innerHTML = "";
    }
    return;
  }

  googlePlaceSearchTimer = setTimeout(async () => {
    const countyId = document.getElementById("onboard-county")?.value || "";
    const constituencyId = document.getElementById("onboard-constituency")?.value || "";
    if (!countyId || !constituencyId) return;

    const res = await apiFetch("/api/platform/locations/google-autocomplete", {
      method: "POST",
      body: JSON.stringify({ query: q, countyId, constituencyId }),
    });

    if (!resultsEl) return;
    resultsEl.innerHTML = "";

    const suggestions = res.ok && Array.isArray(res.data?.suggestions) ? res.data.suggestions : [];
    if (suggestions.length === 0) {
      resultsEl.classList.add("hidden");
      return;
    }

    const header = document.createElement("div");
    header.className = "px-3 py-1.5 bg-emerald-50 text-[10px] font-bold text-emerald-700";
    header.textContent = "Google Maps Kenya Results (Click to select)";
    resultsEl.appendChild(header);

    for (const item of suggestions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex flex-col";

      const title = document.createElement("span");
      title.className = "font-semibold text-slate-800 text-xs";
      title.textContent = item.mainText || item.fullText;

      const sub = document.createElement("span");
      sub.className = "text-[10px] text-slate-500";
      sub.textContent = item.secondaryText || item.fullText;

      btn.appendChild(title);
      if (item.secondaryText) btn.appendChild(sub);

      btn.addEventListener("click", () => selectGooglePlaceSuggestion(item));
      resultsEl.appendChild(btn);
    }

    resultsEl.classList.remove("hidden");
  }, 350);
}

async function selectGooglePlaceSuggestion(item) {
  const countyId = document.getElementById("onboard-county")?.value || "";
  const constituencyId = document.getElementById("onboard-constituency")?.value || "";
  const resultsEl = document.getElementById("onboard-google-results");
  const locSelect = document.getElementById("onboard-location");
  const customWrap = document.getElementById("onboard-custom-location-wrap");
  const banner = document.getElementById("onboard-selected-google-banner");
  const textEl = document.getElementById("onboard-selected-google-text");

  if (resultsEl) resultsEl.classList.add("hidden");
  if (customWrap) customWrap.classList.add("hidden");
  if (locSelect) locSelect.value = "";

  onboardLocationState.selectedGooglePlace = {
    placeId: item.placeId,
    label: item.fullText || item.mainText,
  };

  if (banner && textEl) {
    textEl.textContent = `Google Maps: ${item.fullText || item.mainText}`;
    banner.classList.remove("hidden");
  }

  const res = await apiFetch("/api/platform/locations/resolve-location", {
    method: "POST",
    body: JSON.stringify({
      countyId,
      constituencyId,
      googlePlaceId: item.placeId,
    }),
  });

  if (res.ok && Array.isArray(res.data?.neighbors)) {
    renderNearbyPreview(res.data.neighbors);
  }
}

async function handleOnboardLocationChange(value) {
  const customWrap = document.getElementById("onboard-custom-location-wrap");
  const customInput = document.getElementById("onboard-custom-location");

  clearSelectedGooglePlace();

  if (value === "__custom__") {
    if (customWrap) customWrap.classList.remove("hidden");
    if (customInput) customInput.focus();
    hideNearbyPreview();
    return;
  }

  if (customWrap) customWrap.classList.add("hidden");
  if (!value) {
    hideNearbyPreview();
    return;
  }

  const res = await apiFetch(
    `/api/platform/locations/towns/${encodeURIComponent(value)}/nearby?limit=6`
  );
  if (res.ok && Array.isArray(res.data?.neighbors)) {
    renderNearbyPreview(res.data.neighbors);
  } else {
    hideNearbyPreview();
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
  const constituencyId = document.getElementById("onboard-constituency")?.value || "";
  const locationValue = document.getElementById("onboard-location")?.value || "";
  const customLocationName = (document.getElementById("onboard-custom-location")?.value || "").trim();
  const googlePlaceId = onboardLocationState.selectedGooglePlace?.placeId || "";

  if (!countyId || !constituencyId) {
    showToast("Please select both your County and Constituency.", true);
    return;
  }

  const hasSelectedLocation = Boolean(
    googlePlaceId ||
      (locationValue && locationValue !== "__custom__") ||
      (locationValue === "__custom__" && customLocationName.length >= 2)
  );

  if (!hasSelectedLocation) {
    showToast("Please choose your Town / Shopping Centre (or enter its name).", true);
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
    constituencyId,
  };

  if (googlePlaceId) {
    payload.googlePlaceId = googlePlaceId;
  } else if (locationValue === "__custom__") {
    payload.customLocationName = customLocationName;
  } else {
    payload.locationId = locationValue;
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
    clearSelectedGooglePlace();
    hideNearbyPreview();
    resetLocationSelect(
      document.getElementById("onboard-constituency"),
      "Select County first...",
      true
    );
    resetLocationSelect(
      document.getElementById("onboard-location"),
      "Select Constituency first...",
      true
    );
    toggleDrawer("onboard-modal", false);
  } else {
    showToast(res.data?.error?.message || res.data?.message || "Registration failed", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  ensureOnboardLocationsLoaded();
});
