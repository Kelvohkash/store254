// Storefront Product & Service Catalog Rendering, Active Filter Chips & View Modes
let catalogAbortCtrl = null;
let catalogObserver = null;
let currentRenderedCount = 0;
let currentFilteredList = [];
const CATALOG_PAGE_SIZE = 12;
const CACHE_TTL = 60000;

function renderSkeletonCards(count = 8) {
  const container = document.getElementById("items-grid");
  if (!container) return;
  container.innerHTML = Array.from({ length: count }, () => `
    <div class="product-card flex flex-col animate-pulse" aria-hidden="true">
      <div class="product-card-media bg-slate-200 aspect-square rounded-2xl mb-3"></div>
      <div class="product-card-content flex-1 flex flex-col justify-between">
        <div class="h-3 bg-slate-200 rounded w-1/3 mb-2"></div>
        <div class="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
        <div class="h-4 bg-slate-200 rounded w-1/2 mb-4"></div>
        <div class="h-9 bg-slate-200 rounded-xl w-full"></div>
      </div>
    </div>`).join("");
}

function matchesCategory(catId, targetSlug) {
  if (!targetSlug) return true;
  if (!catId) return false;
  return (state.categories || []).some((c) =>
    (c.slug === targetSlug && (c.id === catId || c.children?.some((s) => s.id === catId))) ||
    c.children?.some((s) => s.slug === targetSlug && s.id === catId)
  );
}

function getCategoryLabelForItem(catId) {
  if (!catId) return "";
  for (const c of state.categories || []) {
    if (c.id === catId) return c.name;
    for (const sub of c.children || []) {
      if (sub.id === catId) return sub.name;
    }
  }
  return "";
}

function getFilteredItems(items) {
  const q = document.getElementById("search-input")?.value?.trim().toLowerCase() || "";
  const maxSliderVal = Number(document.getElementById("price-filter-max")?.value || 0);
  const maxBound = Number(state.priceRange?.max) || 200000;
  const isPriceConstrained = state.priceFilterActive || (maxSliderVal > 0 && maxSliderVal < maxBound);
  const activeEntries = Object.entries(state.activeFilters || {});

  return (items || []).filter((item) => {
    if (state.showWishlistOnly && !state.wishlist.includes(item.id)) return false;
    if (state.selectedCategory && !matchesCategory(item.categoryId, state.selectedCategory)) return false;
    if (state.onlyDeals && !(item.compareAtPrice && Number(item.compareAtPrice) > Number(item.basePrice))) return false;
    if (state.itemTypeFilter && item.itemType !== state.itemTypeFilter) return false;
    if (isPriceConstrained && !state.showWishlistOnly && Number(item.basePrice) > maxSliderVal) return false;
    if (q) {
      const t = String(item.title || "").toLowerCase();
      const d = String(item.description || "").toLowerCase();
      const attrValues = Object.values(item.attributes || {}).map((v) => String(v || "").toLowerCase()).join(" ");
      if (!t.includes(q) && !d.includes(q) && !attrValues.includes(q)) return false;
    }
    return !activeEntries.some(([k, vals]) =>
      vals?.length && !vals.some((v) => String(v).toLowerCase() === String(item.attributes?.[k] || "").toLowerCase())
    );
  });
}

function buildItemCardHtml(item) {
  const isService = item.itemType === "SERVICE";
  const hasDisc = item.compareAtPrice && Number(item.compareAtPrice) > Number(item.basePrice);
  const discPct = hasDisc ? Math.round(((item.compareAtPrice - item.basePrice) / item.compareAtPrice) * 100) : 0;
  const primaryImg = item.images?.[0] || (isService
    ? "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80"
    : "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80");
  const secImg = item.images?.[1];
  const isWish = state.wishlist.includes(item.id);
  const attrs = item.attributes || {};
  const brandOrCat = attrs.brand || getCategoryLabelForItem(item.categoryId) || (isService ? "Service" : "Featured");

  // Extract up to 2 concise attribute specs for PC / List cards
  const specChips = Object.entries(attrs)
    .filter(([k, v]) => k !== "brand" && v !== null && v !== undefined && String(v).trim().length > 0 && String(v).trim().length <= 22)
    .slice(0, 2)
    .map(([k, v]) => {
      const suffix = k === "screen_size" ? '"' : k === "duration_minutes" ? " mins" : "";
      return `<span>${escapeHtml(String(v))}${suffix}</span>`;
    })
    .join("");

  return `
    <article class="product-card flex flex-col group relative">
      <div class="product-card-media relative overflow-hidden flex items-center justify-center cursor-pointer" onclick="viewItemDetails(${inlineJs(item.id)})">
        <img src="${escapeHtml(primaryImg)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async" width="400" height="400" class="w-full h-full object-cover">
        ${secImg ? `<img class="product-card-secondary w-full h-full object-cover" src="${escapeHtml(secImg)}" alt="" loading="lazy" decoding="async" width="400" height="400">` : ""}
        <div class="product-card-actions">
          <button type="button" data-wishlist-item="${escapeHtml(item.id)}" class="product-wishlist ${isWish ? "is-wishlisted" : ""}" onclick="event.stopPropagation(); toggleWishlist(${inlineJs(item.id)}, this)" aria-label="${isWish ? "Remove from" : "Add to"} wishlist" aria-pressed="${isWish}">
            <i data-lucide="heart" class="w-4 h-4"></i>
          </button>
          ${!isService ? `<button type="button" class="product-cart-icon" onclick="event.stopPropagation(); addToCart(${inlineJs(item.id)}, ${inlineJs(item.title)}, ${Number(item.basePrice) || 0}, ${inlineJs(primaryImg)}, ${inlineJs(item.itemType)})" aria-label="Add ${escapeHtml(item.title)} to cart" title="Add to cart"><i data-lucide="plus" class="w-4 h-4"></i></button>` : ""}
        </div>
        <button type="button" class="product-quick-view-btn" onclick="event.stopPropagation(); viewItemDetails(${inlineJs(item.id)})" aria-label="Quick view ${escapeHtml(item.title)}" title="Quick view details">
          <i data-lucide="eye" class="w-3.5 h-3.5"></i>
          <span>Quick View</span>
        </button>
        <div class="product-badge-rail absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none">
          <div class="flex items-center gap-1.5 flex-wrap">
            ${isService ? `<span class="badge-service-pill">Service</span>` : hasDisc ? `<span class="badge-discount-urgent">-${discPct}%</span>` : ""}
          </div>
        </div>
      </div>
      <div class="product-card-content flex-1 flex flex-col justify-between">
        <div>
          <div class="product-card-meta-row flex items-center justify-between gap-1.5 mb-1">
            <span class="product-tag-pill truncate">${escapeHtml(brandOrCat)}</span>
            ${item.stockQuantity > 0 && item.stockQuantity <= 8 && !isService ? `<span class="product-stock-note">${item.stockQuantity} left</span>` : ""}
          </div>
          <h3 class="product-card-title cursor-pointer" onclick="viewItemDetails(${inlineJs(item.id)})">${escapeHtml(item.title)}</h3>
          ${item.description ? `<p class="product-card-desc">${escapeHtml(item.description)}</p>` : ""}
          ${specChips ? `<div class="product-card-specs flex flex-wrap">${specChips}</div>` : ""}
        </div>
        <div class="product-card-footer pt-2.5 mt-auto">
          <div class="product-price-block flex items-baseline flex-wrap gap-1.5 mb-2.5">
            <span class="product-card-price">KES ${Number(item.basePrice).toLocaleString()}</span>
            ${hasDisc ? `<span class="product-card-compare-price">KES ${Number(item.compareAtPrice).toLocaleString()}</span>` : ""}
          </div>
          ${isService ? `<button type="button" onclick="addToCart(${inlineJs(item.id)}, ${inlineJs(item.title)}, ${Number(item.basePrice) || 0}, ${inlineJs(primaryImg)}, ${inlineJs(item.itemType)})" class="product-card-add w-full product-cart-service flex items-center justify-center gap-2"><i data-lucide="calendar" class="w-4 h-4"></i><span>Book Session</span></button>` : ""}
        </div>
      </div>
    </article>`;
}

function updateActiveFilterSummary() {
  const bar = document.getElementById("active-filters-bar");
  const contextPill = document.getElementById("catalog-active-context");
  const chips = [];

  if (state.showWishlistOnly) {
    chips.push({
      label: "Saved Wishlist",
      onRemove: `removeSingleFilter('wishlist')`,
    });
  }

  if (state.selectedCategory) {
    const catName = typeof findCategoryNameBySlug === "function"
      ? findCategoryNameBySlug(state.selectedCategory)
      : state.selectedCategory;
    chips.push({
      label: `${catName}`,
      onRemove: `removeSingleFilter('category')`,
    });
    if (contextPill) {
      contextPill.textContent = catName;
      contextPill.classList.remove("hidden");
    }
  } else if (contextPill) {
    contextPill.textContent = "";
    contextPill.classList.add("hidden");
  }

  const q = document.getElementById("search-input")?.value?.trim() || "";
  if (q) {
    chips.push({
      label: `"${q}"`,
      onRemove: `removeSingleFilter('search')`,
    });
  }

  if (state.onlyDeals) {
    chips.push({
      label: "On Sale / Deals",
      onRemove: `removeSingleFilter('deals')`,
    });
  }

  if (state.itemTypeFilter) {
    chips.push({
      label: state.itemTypeFilter === "SERVICE" ? "Services Only" : "Products Only",
      onRemove: `removeSingleFilter('itemType')`,
    });
  }

  const maxSliderVal = Number(document.getElementById("price-filter-max")?.value || 0);
  const maxBound = Number(state.priceRange?.max) || 200000;
  if (state.priceFilterActive && maxSliderVal > 0 && maxSliderVal < maxBound) {
    chips.push({
      label: `Max: KES ${maxSliderVal.toLocaleString()}`,
      onRemove: `removeSingleFilter('price')`,
    });
  }

  for (const [code, vals] of Object.entries(state.activeFilters || {})) {
    const labelPrefix = typeof formatAttributeLabel === "function" ? formatAttributeLabel(code) : code;
    for (const val of vals || []) {
      chips.push({
        label: `${labelPrefix}: ${val}`,
        onRemove: `removeSingleFilter('facet', ${inlineJs(code)}, ${inlineJs(val)})`,
      });
    }
  }

  // Update filter count badges across PC and Mobile buttons
  const activeCount = chips.length;
  for (const badgeId of [
    "desktop-filter-count",
    "mobile-header-filter-count",
    "catalog-mobile-filter-count",
    "mobile-drawer-filter-count",
    "tablet-filter-count",
  ]) {
    const el = document.getElementById(badgeId);
    if (el) {
      el.textContent = String(activeCount);
      el.classList.toggle("hidden", activeCount === 0);
    }
  }

  // Sync quick filter chip active states
  document.querySelectorAll("[data-quick-deals]").forEach((btn) => {
    btn.classList.toggle("is-active", Boolean(state.onlyDeals));
    btn.setAttribute("aria-pressed", String(Boolean(state.onlyDeals)));
  });
  document.querySelectorAll("[data-quick-type]").forEach((btn) => {
    const type = btn.getAttribute("data-quick-type");
    const active = state.itemTypeFilter === type;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });

  if (!bar) return;
  if (chips.length === 0) {
    bar.innerHTML = "";
    bar.classList.add("hidden");
    return;
  }

  bar.classList.remove("hidden");
  bar.innerHTML = `
    <div class="active-filters-inner flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
      <span class="active-filters-label shrink-0">Active:</span>
      ${chips
        .map(
          (c) => `
        <button type="button" onclick="${c.onRemove}" class="active-filter-chip shrink-0" title="Remove filter ${escapeHtml(c.label)}">
          <span>${escapeHtml(c.label)}</span>
          <i data-lucide="x" class="w-3 h-3"></i>
        </button>`
        )
        .join("")}
      ${
        chips.length > 1
          ? `<button type="button" onclick="resetFilters()" class="active-filters-clear-all shrink-0">Clear all</button>`
          : ""
      }
    </div>
  `;
  renderIcons(bar);
}

function setCatalogViewMode(mode = "grid-4") {
  state.catalogViewMode = mode;
  const grid = document.getElementById("items-grid");
  if (grid) {
    grid.dataset.viewMode = mode;
  }
  document.documentElement.dataset.productCardStyle =
    mode === "list" ? "horizontal-list-row" : "grid-card";

  for (const m of ["grid-4", "grid-3", "list"]) {
    const btn = document.getElementById(`view-mode-${m}`);
    if (btn) btn.classList.toggle("is-active", m === mode);
  }
}

function syncSortControls(val) {
  for (const id of ["sort-selector", "mobile-sort-selector", "mobile-inline-sort"]) {
    const el = document.getElementById(id);
    if (el && el.value !== val) el.value = val;
  }
}

function renderCatalogBatch() {
  const container = document.getElementById("items-grid");
  if (!container || currentRenderedCount >= currentFilteredList.length) return;
  const batch = currentFilteredList.slice(currentRenderedCount, currentRenderedCount + CATALOG_PAGE_SIZE);
  currentRenderedCount += batch.length;
  document.getElementById("catalog-sentinel")?.remove();

  const temp = document.createElement("div");
  temp.innerHTML = batch.map(buildItemCardHtml).join("");
  const fragment = document.createDocumentFragment();
  const added = [];
  while (temp.firstChild) { added.push(temp.firstChild); fragment.appendChild(temp.firstChild); }
  container.appendChild(fragment);
  added.forEach((node) => { if (node.nodeType === 1) renderIcons(node); });

  if (currentRenderedCount < currentFilteredList.length) {
    const sentinel = document.createElement("div");
    sentinel.id = "catalog-sentinel";
    sentinel.className = "col-span-full py-4 text-center";
    sentinel.innerHTML = `<button type="button" onclick="renderCatalogBatch()" class="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Load More Items (${currentFilteredList.length - currentRenderedCount} remaining)</button>`;
    container.appendChild(sentinel);
    if (typeof IntersectionObserver !== "undefined") {
      catalogObserver?.disconnect();
      catalogObserver = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) renderCatalogBatch(); }, { rootMargin: "300px" });
      catalogObserver.observe(sentinel);
    }
  } else {
    catalogObserver?.disconnect();
  }
}

function renderCatalogView() {
  const countBadge = document.getElementById("items-count-badge");
  const mobileCountBadge = document.getElementById("mobile-items-count-badge");
  const mobileApplyBtn = document.getElementById("mobile-apply-filters-btn");
  const container = document.getElementById("items-grid");
  if (!container) return;

  if (state.catalogViewMode) {
    container.dataset.viewMode = state.catalogViewMode;
  }

  currentFilteredList = getFilteredItems(state.items);
  const sortMode = document.getElementById("sort-selector")?.value || "featured";
  if (sortMode === "price_asc") {
    currentFilteredList.sort((a, b) => Number(a.basePrice) - Number(b.basePrice));
  } else if (sortMode === "price_desc") {
    currentFilteredList.sort((a, b) => Number(b.basePrice) - Number(a.basePrice));
  } else if (sortMode === "discount_desc") {
    currentFilteredList.sort((a, b) => {
      const discA = a.compareAtPrice > a.basePrice ? (a.compareAtPrice - a.basePrice) / a.compareAtPrice : 0;
      const discB = b.compareAtPrice > b.basePrice ? (b.compareAtPrice - b.basePrice) / b.compareAtPrice : 0;
      return discB - discA;
    });
  } else if (sortMode === "title_asc") {
    currentFilteredList.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
  }

  const countText = state.showWishlistOnly
    ? `${currentFilteredList.length} saved`
    : `${currentFilteredList.length} ${currentFilteredList.length === 1 ? "item" : "items"}`;
  if (countBadge) countBadge.textContent = countText;
  if (mobileCountBadge) mobileCountBadge.textContent = countText;
  if (mobileApplyBtn) {
    mobileApplyBtn.textContent = `Show ${currentFilteredList.length} ${currentFilteredList.length === 1 ? "Item" : "Items"}`;
  }

  updateActiveFilterSummary();

  currentRenderedCount = 0;
  container.innerHTML = "";

  if (currentFilteredList.length === 0) {
    container.innerHTML = `
      <div class="catalog-empty-state col-span-full py-16 px-4 text-center">
        <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
          <i data-lucide="${state.showWishlistOnly ? "heart" : "package-search"}" class="w-6 h-6"></i>
        </div>
        <h3 class="text-base font-bold text-slate-800">${state.showWishlistOnly ? "Your wishlist is empty" : "No items match your filters"}</h3>
        <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">${state.showWishlistOnly ? "Tap the heart icon on any product or service to save it for later." : "Try removing some active filter chips or clearing your search query."}</p>
        <button type="button" onclick="${state.showWishlistOnly ? "toggleWishlistView(false)" : "resetFilters()"}" class="mt-4 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 mx-auto">
          <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
          <span>${state.showWishlistOnly ? "Browse all products" : "Reset All Filters"}</span>
        </button>
      </div>`;
    renderIcons(container);
    return;
  }
  renderCatalogBatch();
}

function scrollCatalogItemsIntoView() {
  if (document.documentElement.dataset.storefront !== "true") return;
  const drawer = document.getElementById("mobile-filter-drawer");
  if (drawer && !drawer.classList.contains("hidden")) return;
  if (document.getElementById("storefront-view")?.classList.contains("hidden")) return;
  document.getElementById("catalog-items-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadItems(forceRefresh = false) {
  const container = document.getElementById("items-grid");
  if (!container) return;
  const tenantKey = `store254_catalog_${state.activeTenantSlug || "default"}`;

  if (!state.allStoreItems && !forceRefresh) {
    try {
      const stored = sessionStorage.getItem(tenantKey);
      if (stored) {
        const { time, data } = JSON.parse(stored);
        if (Array.isArray(data) && Date.now() - time < CACHE_TTL) state.allStoreItems = data;
      }
    } catch {}
  }

  if (state.allStoreItems && !forceRefresh) {
    state.items = state.allStoreItems;
    updateMakerBuyBar?.();
    if (typeof renderCategoryNavigation === "function") renderCategoryNavigation();
    if (typeof renderDynamicFiltersUI === "function") renderDynamicFiltersUI();
    renderCatalogView();
    return;
  }

  if (container.children.length === 0) renderSkeletonCards();
  catalogAbortCtrl?.abort();
  catalogAbortCtrl = new AbortController();
  const { signal } = catalogAbortCtrl;

  const res = await apiFetch("/api/items?limit=100", { signal });
  if (signal.aborted) return;

  if (res.ok && res.data.success) {
    state.allStoreItems = res.data.data;
    state.items = state.allStoreItems;
    try { sessionStorage.setItem(tenantKey, JSON.stringify({ time: Date.now(), data: res.data.data })); } catch {}
    updateMakerBuyBar?.();
    if (typeof renderCategoryNavigation === "function") renderCategoryNavigation();
    if (typeof renderDynamicFiltersUI === "function") renderDynamicFiltersUI();
    renderCatalogView();
  }
}

function resetFilters() {
  state.activeFilters = {};
  state.selectedCategory = "";
  state.onlyDeals = false;
  state.itemTypeFilter = "";
  state.priceFilterActive = false;
  if (state.priceRange?.max) {
    state.selectedPriceRange.max = state.priceRange.max;
  }
  const sInput = document.getElementById("search-input");
  if (sInput) sInput.value = "";
  const mInput = document.getElementById("mobile-search-input");
  if (mInput) mInput.value = "";
  if (typeof syncSearchClearButtons === "function") syncSearchClearButtons();
  const pcSlider = document.getElementById("price-filter-max");
  const mobSlider = document.getElementById("mobile-price-filter");
  if (pcSlider && state.priceRange?.max) pcSlider.value = String(state.priceRange.max);
  if (mobSlider && state.priceRange?.max) mobSlider.value = String(state.priceRange.max);

  loadCategories();
  loadDynamicFilters();
  return loadItems().then(scrollCatalogItemsIntoView);
}
