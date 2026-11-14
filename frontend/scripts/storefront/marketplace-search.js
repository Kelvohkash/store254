// Store254 International Ripple Marketplace Search (Homepage)
(() => {
  const BUYER_LOC_KEY = "store254_buyer_location_v1";
  let buyerCountyList = [];
  let selectedBuyerLocation = null; // { countyId, countyName, locationId, locationName, constituencyName, lat?, lng? }
  let activeCountyFilter = null;
  let searchAbortCtrl = null;
  let suggestTimer = null;
  let townSearchTimer = null;
  let expandFullSearch = false;
  let activeItemType = "";
  let inStockOnly = false;
  let currentSort = "smart";
  let lastQuery = "";

  function loadSavedBuyerLocation() {
    try {
      const raw = localStorage.getItem(BUYER_LOC_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && (parsed.locationId || (typeof parsed.lat === "number" && typeof parsed.lng === "number"))
        ? parsed
        : null;
    } catch {
      return null;
    }
  }

  function saveBuyerLocation(loc) {
    selectedBuyerLocation = loc;
    try {
      if (loc) localStorage.setItem(BUYER_LOC_KEY, JSON.stringify(loc));
      else localStorage.removeItem(BUYER_LOC_KEY);
    } catch {}
    syncLocationPillUI();
  }

  window.getStore254BuyerLocation = function getStore254BuyerLocation() {
    return selectedBuyerLocation;
  };

  function syncLocationPillUI() {
    const labelEl = document.getElementById("marketplace-location-pill-label");
    const clearBtn = document.getElementById("marketplace-location-clear");
    if (labelEl) {
      if (!selectedBuyerLocation) {
        labelEl.textContent = "All Kenya (Set your town)";
        if (clearBtn) clearBtn.classList.add("hidden");
      } else {
        if (selectedBuyerLocation.locationName) {
          const parts = [selectedBuyerLocation.locationName, selectedBuyerLocation.countyName].filter(Boolean);
          labelEl.textContent = `Near: ${parts.join(", ")}`;
        } else if (typeof selectedBuyerLocation.lat === "number") {
          labelEl.textContent = "Near: My GPS Location";
        }
        if (clearBtn) clearBtn.classList.remove("hidden");
      }
    }
    if (typeof window.syncMarketplaceHeaderState === "function") {
      window.syncMarketplaceHeaderState();
    }
    if (typeof window.filterPlatformStores === "function") {
      window.filterPlatformStores();
    }
  }

  function formatItemDirectUrl(storeSubdomain, itemSlug) {
    const base = typeof getStoreUrl === "function" ? getStoreUrl(storeSubdomain) : `/?store=${encodeURIComponent(storeSubdomain)}`;
    if (base.includes("?store=")) {
      return base;
    }
    const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
    return `${cleanBase}/item/${encodeURIComponent(itemSlug)}`;
  }

  function formatKesPrice(amount, currency = "KES") {
    const num = Number(amount || 0);
    return `${escapeHtml(currency)} ${num.toLocaleString("en-KE")}`;
  }

  async function ensureBuyerCountiesLoaded() {
    if (buyerCountyList.length > 0) return buyerCountyList;
    const res = await apiFetch("/api/platform/locations/counties");
    if (res.ok && Array.isArray(res.data?.counties)) {
      buyerCountyList = res.data.counties;
    }
    return buyerCountyList;
  }

  window.toggleMarketplaceLocationPanel = async function toggleMarketplaceLocationPanel(force) {
    const panel = document.getElementById("marketplace-location-panel");
    if (!panel) return;
    const open = typeof force === "boolean" ? force : panel.classList.contains("hidden");
    panel.classList.toggle("hidden", !open);
    if (open) {
      await ensureBuyerCountiesLoaded();
      renderBuyerCountyChips("");
      document.getElementById("marketplace-county-filter")?.focus();
    }
  };

  function renderBuyerCountyChips(filterText) {
    const listEl = document.getElementById("marketplace-county-list");
    if (!listEl) return;
    const q = String(filterText || "").trim().toLowerCase();
    const matches = q
      ? buyerCountyList.filter((c) => c.name.toLowerCase().includes(q))
      : buyerCountyList.slice(0, 12);

    if (matches.length === 0) {
      listEl.innerHTML = `<span class="text-xs text-slate-500 px-2 py-1">No matching county</span>`;
      return;
    }

    listEl.innerHTML = matches
      .map((c) => {
        const isSel = activeCountyFilter?.id === c.id;
        return `<button type="button" onclick="selectMarketplaceCounty(${inlineJs(c.id)})" class="marketplace-county-pill ${isSel ? "is-selected" : ""}">${escapeHtml(c.name)}</button>`;
      })
      .join("");
  }

  window.onMarketplaceCountyInput = function onMarketplaceCountyInput(val) {
    renderBuyerCountyChips(val);
  };

  window.selectMarketplaceCounty = function selectMarketplaceCounty(countyId) {
    activeCountyFilter = buyerCountyList.find((c) => c.id === countyId) || null;
    renderBuyerCountyChips(document.getElementById("marketplace-county-filter")?.value || "");
    const townWrap = document.getElementById("marketplace-town-search-wrap");
    const townHint = document.getElementById("marketplace-town-county-label");
    if (townWrap) townWrap.classList.remove("hidden");
    if (townHint && activeCountyFilter) {
      townHint.textContent = activeCountyFilter.name;
    }
    const townInput = document.getElementById("marketplace-town-search");
    if (townInput) {
      townInput.value = "";
      townInput.focus();
      onMarketplaceTownInput("");
    }
  };

  window.onMarketplaceTownInput = function onMarketplaceTownInput(val) {
    clearTimeout(townSearchTimer);
    townSearchTimer = setTimeout(async () => {
      const resultsEl = document.getElementById("marketplace-town-results");
      if (!resultsEl || !activeCountyFilter) return;
      const q = String(val || "").trim();
      const url = `/api/platform/locations/towns?countyId=${encodeURIComponent(activeCountyFilter.id)}&q=${encodeURIComponent(q)}&limit=10`;
      const res = await apiFetch(url);
      const locs = res.ok && Array.isArray(res.data?.locations) ? res.data.locations : [];
      if (locs.length === 0) {
        resultsEl.innerHTML = `<div class="p-2.5 text-xs text-slate-500">No matching centres in ${escapeHtml(activeCountyFilter.name)}.</div>`;
        return;
      }
      resultsEl.innerHTML = locs
        .map(
          (loc) => `
          <button type="button" onclick="selectMarketplaceBuyerLocation(${inlineJs(loc)})" class="w-full text-left px-3 py-2 hover:bg-emerald-50 flex items-center justify-between gap-2 border-b border-slate-100 last:border-0 text-xs">
            <div>
              <strong class="text-slate-800 block">${escapeHtml(loc.name)}</strong>
              <span class="text-[11px] text-emerald-700">${escapeHtml(loc.constituencyName || "")} · ${escapeHtml(loc.countyName || activeCountyFilter.name)}</span>
            </div>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">${escapeHtml(loc.kind === "TOWN" ? "Town" : loc.kind === "ESTATE" ? "Estate" : "Centre")}</span>
          </button>`
        )
        .join("");
    }, 160);
  };

  window.selectMarketplaceBuyerLocation = function selectMarketplaceBuyerLocation(loc) {
    if (!loc || (!loc.id && !loc.locationId && !loc.countyId)) return;
    saveBuyerLocation({
      locationId: loc.locationId || loc.id || null,
      locationName: loc.locationName || loc.name || "",
      countyId: loc.countyId || "",
      countyName: loc.countyName || activeCountyFilter?.name || "",
      constituencyName: loc.constituencyName || "",
    });
    window.toggleMarketplaceLocationPanel(false);
    expandFullSearch = false;
    window.runMarketplaceProductSearch();
  };

  window.clearMarketplaceBuyerLocation = function clearMarketplaceBuyerLocation() {
    saveBuyerLocation(null);
    expandFullSearch = false;
    window.runMarketplaceProductSearch();
  };

  async function resolveAndSaveNearestCoords(lat, lng, fallbackSource) {
    const query =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? `?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
        : "";
    try {
      const res = await apiFetch(`/api/platform/locations/nearest${query}`);
      const loc = res?.data?.location;
      if (res.ok && loc && loc.id) {
        const saved = {
          locationId: loc.id,
          locationName: loc.name,
          countyId: loc.countyId,
          countyName: loc.countyName || "",
          constituencyName: loc.constituencyName || "",
          lat: Number.isFinite(lat) ? lat : loc.latitude,
          lng: Number.isFinite(lng) ? lng : loc.longitude,
        };
        saveBuyerLocation(saved);
        window.toggleMarketplaceLocationPanel(false);
        expandFullSearch = false;
        window.runMarketplaceProductSearch();
        return { ok: true, source: res.data.source || fallbackSource, location: saved };
      }
    } catch {}

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const approx = {
        lat,
        lng,
        locationName: "My GPS Area",
        countyName: "",
      };
      saveBuyerLocation(approx);
      window.toggleMarketplaceLocationPanel(false);
      expandFullSearch = false;
      window.runMarketplaceProductSearch();
      return { ok: true, source: "gps", location: approx };
    }
    return { ok: false };
  }

  window.useBrowserGpsLocation = async function useBrowserGpsLocation(onResult) {
    const labelEl = document.getElementById("marketplace-location-pill-label");
    if (labelEl) labelEl.textContent = "Detecting location...";

    const finishWithFallback = async (reasonMsg) => {
      const netRes = await resolveAndSaveNearestCoords(NaN, NaN, "network");
      if (netRes.ok) {
        if (typeof onResult === "function") onResult(netRes);
        return;
      }
      syncLocationPillUI();
      if (typeof showToast === "function") showToast(reasonMsg, true);
      if (typeof onResult === "function") onResult({ ok: false, message: reasonMsg });
    };

    if (!navigator.geolocation) {
      await finishWithFallback("Browser location is unavailable. Please select your County below.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        const resolved = await resolveAndSaveNearestCoords(lat, lng, "gps");
        if (typeof onResult === "function") onResult(resolved);
      },
      async (err) => {
        const msg =
          err && err.code === 1
            ? "Location permission was denied. We fell back to searching manually or pick your County below."
            : "Could not detect precise GPS signal. Please select your County below.";
        await finishWithFallback(msg);
      },
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 180000 }
    );
  };

  window.onMarketplaceQueryInput = function onMarketplaceQueryInput(val) {
    const clearSearchBtn = document.getElementById("marketplace-query-clear");
    if (clearSearchBtn) clearSearchBtn.classList.toggle("hidden", !val || !val.trim());

    clearTimeout(suggestTimer);
    const sugBox = document.getElementById("marketplace-suggest-dropdown");
    const q = String(val || "").trim();
    if (q.length < 2) {
      if (sugBox) {
        sugBox.classList.add("hidden");
        sugBox.innerHTML = "";
      }
      return;
    }

    suggestTimer = setTimeout(async () => {
      const res = await apiFetch(`/api/platform/search/suggest?q=${encodeURIComponent(q)}&limit=6`);
      if (!sugBox) return;
      const suggestions = res.ok && Array.isArray(res.data?.suggestions) ? res.data.suggestions : [];
      const stores = res.ok && Array.isArray(res.data?.stores) ? res.data.stores : [];
      if (suggestions.length === 0 && stores.length === 0) {
        sugBox.classList.add("hidden");
        return;
      }

      const itemBtns = suggestions
        .map(
          (term) => `
          <button type="button" onclick="pickMarketplaceSuggestion(${inlineJs(term)})" class="w-full text-left px-3.5 py-2 hover:bg-emerald-50 flex items-center gap-2 text-xs text-slate-700 border-b border-slate-100">
            <i data-lucide="search" class="w-3.5 h-3.5 text-emerald-600 shrink-0"></i>
            <span class="truncate font-semibold">${escapeHtml(term)}</span>
          </button>`
        )
        .join("");

      const storeBtns = stores
        .map(
          (st) => `
          <a href="${escapeHtml(getStoreUrl(st.subdomain))}" class="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between gap-2 text-xs text-slate-700 border-b border-slate-100 last:border-0 no-underline">
            <span class="flex items-center gap-2 truncate"><i data-lucide="store" class="w-3.5 h-3.5 text-slate-500 shrink-0"></i><strong class="truncate">${escapeHtml(st.name)}</strong></span>
            <span class="text-[10px] text-emerald-700 shrink-0">${escapeHtml(st.locationLabel || `${st.subdomain}.store254.co.ke`)}</span>
          </a>`
        )
        .join("");

      sugBox.innerHTML = itemBtns + storeBtns;
      sugBox.classList.remove("hidden");
      if (typeof renderIcons === "function") renderIcons();
    }, 180);
  };

  window.pickMarketplaceSuggestion = function pickMarketplaceSuggestion(term) {
    const input = document.getElementById("marketplace-product-query");
    if (input) input.value = term;
    const sugBox = document.getElementById("marketplace-suggest-dropdown");
    if (sugBox) sugBox.classList.add("hidden");
    expandFullSearch = false;
    window.runMarketplaceProductSearch();
  };

  window.clearMarketplaceQuery = function clearMarketplaceQuery() {
    const input = document.getElementById("marketplace-product-query");
    if (input) input.value = "";
    const clearSearchBtn = document.getElementById("marketplace-query-clear");
    if (clearSearchBtn) clearSearchBtn.classList.add("hidden");
    window.runMarketplaceProductSearch();
  };

  window.setMarketplaceTypeFilter = function setMarketplaceTypeFilter(type) {
    activeItemType = type || "";
    document.querySelectorAll("[data-marketplace-type-btn]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-marketplace-type-btn") === activeItemType);
    });
    window.runMarketplaceProductSearch();
  };

  window.toggleMarketplaceInStock = function toggleMarketplaceInStock() {
    inStockOnly = !inStockOnly;
    const btn = document.getElementById("marketplace-instock-toggle");
    if (btn) {
      btn.classList.toggle("is-active", inStockOnly);
      btn.setAttribute("aria-pressed", String(inStockOnly));
    }
    window.runMarketplaceProductSearch();
  };

  window.onMarketplaceSortChange = function onMarketplaceSortChange(val) {
    currentSort = val || "smart";
    window.runMarketplaceProductSearch();
  };

  window.expandMarketplaceSearchNationwide = function expandMarketplaceSearchNationwide() {
    expandFullSearch = true;
    window.runMarketplaceProductSearch();
  };

  window.runMarketplaceProductSearch = async function runMarketplaceProductSearch(overrideQuery) {
    const input = document.getElementById("marketplace-product-query");
    if (typeof overrideQuery === "string" && input) {
      input.value = overrideQuery;
      const clearSearchBtn = document.getElementById("marketplace-query-clear");
      if (clearSearchBtn) clearSearchBtn.classList.toggle("hidden", !overrideQuery.trim());
    }
    const q = (input?.value || "").trim();
    lastQuery = q;

    const sugBox = document.getElementById("marketplace-suggest-dropdown");
    if (sugBox) sugBox.classList.add("hidden");

    const resultsWrap = document.getElementById("marketplace-search-results-wrap");
    const gridEl = document.getElementById("marketplace-search-results");
    const statusEl = document.getElementById("marketplace-ripple-headline");
    const trailEl = document.getElementById("marketplace-ripple-trail");
    if (!gridEl || !resultsWrap) return;

    resultsWrap.classList.remove("hidden");
    gridEl.innerHTML = Array.from({ length: 4 }, () => `
      <div class="marketplace-result-skeleton animate-pulse">
        <div class="h-36 bg-slate-200 rounded-xl mb-3"></div>
        <div class="h-3 bg-slate-200 rounded w-1/2 mb-2"></div>
        <div class="h-4 bg-slate-200 rounded w-4/5 mb-2"></div>
        <div class="h-4 bg-slate-200 rounded w-1/3"></div>
      </div>`).join("");

    if (searchAbortCtrl) searchAbortCtrl.abort();
    searchAbortCtrl = new AbortController();

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (selectedBuyerLocation?.locationId) params.set("locationId", selectedBuyerLocation.locationId);
    else if (selectedBuyerLocation?.countyId) params.set("countyId", selectedBuyerLocation.countyId);
    else if (typeof selectedBuyerLocation?.lat === "number" && typeof selectedBuyerLocation?.lng === "number") {
      params.set("lat", String(selectedBuyerLocation.lat));
      params.set("lng", String(selectedBuyerLocation.lng));
    }
    if (activeItemType) params.set("itemType", activeItemType);
    if (inStockOnly) params.set("inStockOnly", "true");
    if (currentSort) params.set("sort", currentSort);
    if (expandFullSearch) params.set("expand", "full");
    params.set("minResults", "8");
    params.set("limit", "24");

    try {
      const res = await apiFetch(`/api/platform/search/products?${params.toString()}`, {
        signal: searchAbortCtrl.signal,
      });

      if (!res.ok || !res.data?.success) {
        if (statusEl) statusEl.textContent = "Could not complete product search right now.";
        gridEl.innerHTML = "";
        return;
      }

      const payload = res.data;
      const summary = payload.rippleSummary || {};
      if (summary.origin?.name && selectedBuyerLocation && !selectedBuyerLocation.locationId) {
        saveBuyerLocation({
          locationId: summary.origin.id,
          locationName: summary.origin.name,
          countyId: summary.origin.countyId,
          countyName: summary.origin.countyName,
          constituencyName: summary.origin.constituencyName,
        });
      }

      if (statusEl) {
        const count = Number(payload.returnedCount || 0);
        const locPart = selectedBuyerLocation?.locationName
          ? ` near ${selectedBuyerLocation.locationName}`
          : "";
        statusEl.textContent = count > 0 ? `${count} item${count === 1 ? "" : "s"}${locPart}` : "";
      }

      // Did-you-mean banner
      const didYouMeanEl = document.getElementById("marketplace-did-you-mean");
      if (didYouMeanEl) {
        if (payload.didYouMean && payload.didYouMean.toLowerCase() !== lastQuery.toLowerCase()) {
          didYouMeanEl.innerHTML = `Showing spelling-corrected matches for <button type="button" onclick="pickMarketplaceSuggestion(${inlineJs(payload.didYouMean)})" class="font-extrabold text-emerald-700 underline">${escapeHtml(payload.didYouMean)}</button>`;
          didYouMeanEl.classList.remove("hidden");
        } else {
          didYouMeanEl.classList.add("hidden");
          didYouMeanEl.innerHTML = "";
        }
      }

      // Keep ripple progression silent in the background
      if (trailEl) {
        trailEl.innerHTML = "";
        trailEl.classList.add("hidden");
      }

      // Expand nationwide button if wider matches exist
      const expandBtn = document.getElementById("marketplace-expand-nationwide-btn");
      if (expandBtn) {
        expandBtn.classList.toggle("hidden", !payload.hasMoreNationalMatches);
      }

      const itemsList = Array.isArray(payload.results) ? payload.results : [];
      if (itemsList.length === 0) {
        gridEl.innerHTML = `
          <div class="col-span-full bg-white rounded-2xl p-8 border border-slate-200 text-center">
            <p class="font-bold text-slate-900 text-sm">No matching products found</p>
            <p class="text-xs text-slate-500 mt-1">Try another search or change your selected town.</p>
          </div>`;
        return;
      }

      gridEl.innerHTML = itemsList
        .map((item) => {
          const fallbackImg =
            item.itemType === "SERVICE"
              ? "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=500&auto=format&fit=crop&q=80"
              : "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&auto=format&fit=crop&q=80";
          const imgUrl = Array.isArray(item.images) && item.images[0] ? item.images[0] : fallbackImg;
          const hasDisc = item.compareAtPrice && item.compareAtPrice > item.basePrice;
          const locBadge = item.store.locationLabel ? escapeHtml(item.store.locationLabel) : "";
          const quickCartPayload = escapeHtml(
            JSON.stringify({
              itemId: item.id,
              storeId: item.store.id,
              storeName: item.store.name,
              storeSubdomain: item.store.subdomain,
              storeLocationLabel: item.store.locationLabel || "",
              title: item.title,
              unitPrice: item.startingPrice ?? item.basePrice,
              currency: item.currency || "KES",
              image: imgUrl,
              quantity: 1,
              itemType: item.itemType,
            })
          );
          return `
            <article class="marketplace-product-card" role="button" tabindex="0" onclick="openMarketplaceQuickView('${escapeHtml(item.id)}', '')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openMarketplaceQuickView('${escapeHtml(item.id)}', '');}">
              <div class="marketplace-product-media">
                <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='${fallbackImg}'" />
                ${locBadge ? `<span class="marketplace-ring-badge ring-local">${locBadge}</span>` : ""}
              </div>
              <div class="marketplace-product-body">
                <span class="marketplace-product-cat">${escapeHtml(item.categoryName || item.itemType)}</span>
                <h3 class="marketplace-product-title">${escapeHtml(item.title)}</h3>
                <div class="marketplace-product-price-row">
                  <strong>${formatKesPrice(item.startingPrice ?? item.basePrice, item.currency)}</strong>
                  ${hasDisc ? `<del>${formatKesPrice(item.compareAtPrice, item.currency)}</del>` : ""}
                </div>
                <div class="marketplace-product-store-row">
                  <span class="truncate">${escapeHtml(item.store.name)}</span>
                  <span class="shrink-0 font-semibold ${item.inStock ? "text-emerald-700" : "text-amber-700"}">${item.inStock ? "Available" : "Out of stock"}</span>
                </div>
                <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span class="text-[11px] font-bold text-slate-500">Quick View</span>
                  ${
                    item.inStock
                      ? `<button type="button" data-item="${quickCartPayload}" onclick="event.stopPropagation(); quickAddMarketplaceItem(JSON.parse(this.dataset.item))" class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-700 text-emerald-800 hover:text-white text-[11px] font-extrabold border border-emerald-200 transition-colors">+ Cart</button>`
                      : ""
                  }
                </div>
              </div>
            </article>`;
        })
        .join("");

      if (typeof renderIcons === "function") renderIcons();
    } catch (err) {
      if (err && err.name === "AbortError") return;
      if (statusEl) statusEl.textContent = "Search failed temporarily. Please try again.";
      gridEl.innerHTML = "";
    }
  };

  // Close autocomplete / location popovers when clicking outside
  document.addEventListener("click", (ev) => {
    const sugBox = document.getElementById("marketplace-suggest-dropdown");
    const searchWrap = document.getElementById("marketplace-search-input-wrap");
    if (sugBox && searchWrap && !searchWrap.contains(ev.target)) {
      sugBox.classList.add("hidden");
    }
    const locPanel = document.getElementById("marketplace-location-panel");
    const locWrap = document.getElementById("marketplace-location-selector-wrap");
    if (locPanel && locWrap && !locWrap.contains(ev.target)) {
      locPanel.classList.add("hidden");
    }
  });

  window.addEventListener("DOMContentLoaded", () => {
    selectedBuyerLocation = loadSavedBuyerLocation();
    syncLocationPillUI();
    if (document.documentElement.dataset.storefront !== "true") {
      window.runMarketplaceProductSearch();
    }
  });
})();
