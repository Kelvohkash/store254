// Categories & Dynamic Faceted Filters Engine

const ATTRIBUTE_LABELS = {
  brand: "Brand",
  screen_size: "Screen Size",
  screenSize: "Screen Size",
  resolution: "Resolution",
  warranty: "Warranty",
  color: "Color",
  material: "Material",
  ageGroup: "Age Group",
  duration_minutes: "Session Duration",
  weightGroup: "Weight Group",
  size: "Size",
};

function formatAttributeLabel(code) {
  if (ATTRIBUTE_LABELS[code]) return ATTRIBUTE_LABELS[code];
  return String(code || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getCategoryItemCount(slug) {
  const all = Array.isArray(state.allStoreItems) ? state.allStoreItems : state.items || [];
  if (!all.length) return null;
  if (!slug) return all.length;
  return all.filter((item) => matchesCategory(item.categoryId, slug)).length;
}

function findCategoryNameBySlug(slug) {
  if (!slug) return "";
  for (const cat of state.categories || []) {
    if (cat.slug === slug) return cat.name;
    for (const sub of cat.children || []) {
      if (sub.slug === slug) return `${cat.name} › ${sub.name}`;
    }
  }
  return slug;
}

function renderCategoryNavigation() {
  const container = document.getElementById("category-pills");
  const subBar = document.getElementById("subcategory-pills-bar");
  const sidebarList = document.getElementById("sidebar-categories-list");
  const sidebarSection = document.getElementById("sidebar-categories-section");
  const mobileCategoryContainer = document.getElementById("mobile-category-pills");
  const mobileCategorySection = document.getElementById("mobile-category-filter-section");
  const headerContainer = document.getElementById("storefront-header-categories");
  const mobileHeaderContainer = document.getElementById("fashion-mobile-categories");
  const headerNav = document.getElementById("storefront-fashion-nav");
  if (!container) return;

  const isStorefront = document.documentElement.dataset.storefront === "true";
  const categories = state.categories || [];
  const totalCount = getCategoryItemCount("");

  // Find active root category (either selected directly or via one of its subcategories)
  let activeRootCat = null;
  for (const cat of categories) {
    if (cat.slug === state.selectedCategory || (cat.children || []).some((sub) => sub.slug === state.selectedCategory)) {
      activeRootCat = cat;
      break;
    }
  }

  // 1. Primary Horizontal Category Pill Bar (Clean single row on PC & Mobile)
  let pillsHtml = `
    <button onclick="selectCategory('')" class="category-pill ${
      state.selectedCategory === "" ? "category-pill-active" : "category-pill-inactive"
    }" aria-selected="${state.selectedCategory === ""}" type="button">
      <span>All Categories</span>
      ${totalCount !== null ? `<span class="category-pill-count">${totalCount}</span>` : ""}
    </button>
  `;

  for (const cat of categories) {
    const children = cat.children || [];
    const isRootActive = activeRootCat?.id === cat.id;
    const isDirectSelected = state.selectedCategory === cat.slug;
    const count = getCategoryItemCount(cat.slug);

    pillsHtml += `
      <button onclick="selectCategory('${escapeHtml(cat.slug)}')" class="category-pill ${
        isRootActive || isDirectSelected ? "category-pill-active" : "category-pill-inactive"
      }" aria-selected="${isRootActive || isDirectSelected}" type="button">
        <span>${escapeHtml(cat.name)}</span>
        ${count !== null ? `<span class="category-pill-count">${count}</span>` : ""}
      </button>
    `;
  }
  container.innerHTML = pillsHtml;

  // 2. Dedicated Subcategory Pill Strip (When active root category has subcategories)
  if (subBar) {
    const activeChildren = activeRootCat?.children || [];
    if (isStorefront && activeRootCat && activeChildren.length > 0) {
      const rootSelected = state.selectedCategory === activeRootCat.slug;
      let subHtml = `
        <span class="subcategory-bar-label">${escapeHtml(activeRootCat.name)}:</span>
        <button onclick="selectCategory('${escapeHtml(activeRootCat.slug)}')" class="category-subpill ${
          rootSelected ? "category-subpill-active" : "category-subpill-inactive"
        }" aria-selected="${rootSelected}" type="button">All ${escapeHtml(activeRootCat.name)}</button>
      `;
      for (const sub of activeChildren) {
        const isSubSelected = state.selectedCategory === sub.slug;
        const subCount = getCategoryItemCount(sub.slug);
        subHtml += `
          <button onclick="selectCategory('${escapeHtml(sub.slug)}')" class="category-subpill ${
            isSubSelected ? "category-subpill-active" : "category-subpill-inactive"
          }" aria-selected="${isSubSelected}" type="button">
            <span>${escapeHtml(sub.name)}</span>
            ${subCount !== null ? `<span class="category-subpill-count">${subCount}</span>` : ""}
          </button>
        `;
      }
      subBar.innerHTML = subHtml;
      subBar.classList.remove("hidden");
    } else {
      subBar.innerHTML = "";
      subBar.classList.add("hidden");
    }
  }

  // 3. PC Left Sidebar Structured Category Tree
  if (sidebarList && sidebarSection) {
    if (categories.length === 0) {
      sidebarSection.classList.add("hidden");
    } else {
      sidebarSection.classList.remove("hidden");
      let treeHtml = `
        <button type="button" onclick="selectCategory('')" class="sidebar-cat-btn ${
          state.selectedCategory === "" ? "is-active" : ""
        }" aria-selected="${state.selectedCategory === ""}">
          <span class="sidebar-cat-name">All Products &amp; Services</span>
          ${totalCount !== null ? `<span class="sidebar-cat-count">${totalCount}</span>` : ""}
        </button>
      `;
      for (const cat of categories) {
        const children = cat.children || [];
        const isRootActive = activeRootCat?.id === cat.id;
        const isDirectSelected = state.selectedCategory === cat.slug;
        const count = getCategoryItemCount(cat.slug);
        treeHtml += `
          <div class="sidebar-cat-group">
            <button type="button" onclick="selectCategory('${escapeHtml(cat.slug)}')" class="sidebar-cat-btn ${
              isDirectSelected || isRootActive ? "is-active" : ""
            }" aria-selected="${isDirectSelected}">
              <span class="sidebar-cat-name">${escapeHtml(cat.name)}</span>
              ${count !== null ? `<span class="sidebar-cat-count">${count}</span>` : ""}
            </button>
            ${
              children.length > 0 && isRootActive
                ? `<div class="sidebar-subcat-list">
                    ${children
                      .map((sub) => {
                        const isSubSelected = state.selectedCategory === sub.slug;
                        const subCount = getCategoryItemCount(sub.slug);
                        return `
                          <button type="button" onclick="selectCategory('${escapeHtml(sub.slug)}')" class="sidebar-subcat-btn ${
                            isSubSelected ? "is-active" : ""
                          }" aria-selected="${isSubSelected}">
                            <span>${escapeHtml(sub.name)}</span>
                            ${subCount !== null ? `<span class="sidebar-cat-count">${subCount}</span>` : ""}
                          </button>
                        `;
                      })
                      .join("")}
                  </div>`
                : ""
            }
          </div>
        `;
      }
      sidebarList.innerHTML = treeHtml;
    }
  }

  // 4. Mobile Filter Sheet Category & Subcategory Grid
  if (mobileCategoryContainer) {
    if (isStorefront && categories.length > 0) {
      let mobileHtml = `
        <button onclick="selectCategory('')" class="category-pill ${
          state.selectedCategory === "" ? "category-pill-active" : "category-pill-inactive"
        }" aria-selected="${state.selectedCategory === ""}" type="button">
          <span>All Categories</span>
          ${totalCount !== null ? `<span class="category-pill-count">${totalCount}</span>` : ""}
        </button>
      `;
      for (const cat of categories) {
        const isSelected = state.selectedCategory === cat.slug;
        const children = cat.children || [];
        const expanded = isSelected || children.some((sub) => state.selectedCategory === sub.slug);
        const count = getCategoryItemCount(cat.slug);
        mobileHtml += `<div class="category-filter-group">
          <button onclick="selectCategory('${escapeHtml(cat.slug)}')" class="category-pill ${
            isSelected ? "category-pill-active" : "category-pill-inactive"
          }" aria-selected="${isSelected}" aria-expanded="${expanded}" type="button">
            <span>${escapeHtml(cat.name)}</span>
            ${count !== null ? `<span class="category-pill-count">${count}</span>` : ""}
          </button>`;
        if (children.length > 0) {
          mobileHtml += `<div class="category-subcategory-list" aria-label="${escapeHtml(cat.name)} subcategories">`;
          for (const sub of children) {
            const isSubSelected = state.selectedCategory === sub.slug;
            const subCount = getCategoryItemCount(sub.slug);
            mobileHtml += `<button onclick="selectCategory('${escapeHtml(sub.slug)}')" class="category-subpill ${
              isSubSelected ? "category-subpill-active" : "category-subpill-inactive"
            }" aria-selected="${isSubSelected}" type="button">
              <span>${escapeHtml(sub.name)}</span>
              ${subCount !== null ? `<span class="category-subpill-count">${subCount}</span>` : ""}
            </button>`;
          }
          mobileHtml += `</div>`;
        }
        mobileHtml += `</div>`;
      }
      mobileCategoryContainer.innerHTML = mobileHtml;
      mobileCategorySection?.classList.remove("hidden");
    } else {
      mobileCategoryContainer.innerHTML = "";
      mobileCategorySection?.classList.add("hidden");
    }
  }

  if (headerContainer) headerContainer.innerHTML = isStorefront ? pillsHtml : "";
  if (mobileHeaderContainer) mobileHeaderContainer.innerHTML = isStorefront ? pillsHtml : "";
  headerNav?.classList.toggle("hidden", !isStorefront);
}

async function loadCategories() {
  const res = await apiFetch("/api/categories");
  if (res.ok && res.data.success) {
    state.categories = res.data.data;
  }
  renderCategoryNavigation();
}

function selectCategory(slug) {
  state.selectedCategory = slug;
  renderCategoryNavigation();
  Promise.all([loadDynamicFilters(), loadItems()]).then(scrollCatalogItemsIntoView);
}

let searchDebounceTimer = null;
function debouncedLoadItems() {
  syncSearchClearButtons();
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadItems().then(scrollCatalogItemsIntoView);
  }, 240);
}

function syncSearchClearButtons() {
  const pcVal = document.getElementById("search-input")?.value || "";
  const mobVal = document.getElementById("mobile-search-input")?.value || "";
  document.getElementById("desktop-search-clear")?.classList.toggle("hidden", !pcVal.trim());
  document.getElementById("mobile-search-clear")?.classList.toggle("hidden", !mobVal.trim());
}

function clearSearchInput() {
  const pcInput = document.getElementById("search-input");
  const mobInput = document.getElementById("mobile-search-input");
  if (pcInput) pcInput.value = "";
  if (mobInput) mobInput.value = "";
  syncSearchClearButtons();
  loadItems();
}

function buildMergedFacets(apiFacets = []) {
  const itemsPool = (state.allStoreItems || state.items || []).filter((item) =>
    !state.selectedCategory || matchesCategory(item.categoryId, state.selectedCategory)
  );

  const facetMap = new Map();

  // Seed with API facets first
  for (const f of apiFacets) {
    if (!f || !f.code) continue;
    const optMap = new Map();
    for (const o of f.options || []) {
      if (o && o.value !== undefined && o.value !== null && String(o.value).trim() !== "") {
        optMap.set(String(o.value).trim(), Number(o.count) || 0);
      }
    }
    facetMap.set(f.code, {
      code: f.code,
      name: f.name || formatAttributeLabel(f.code),
      unit: f.unit || null,
      optionsMap: optMap,
    });
  }

  // Enrich / compute live counts from actual store items so all product attributes are filterable
  if (itemsPool.length > 0) {
    const liveCounts = new Map();
    for (const item of itemsPool) {
      const attrs = item.attributes || {};
      for (const [rawCode, rawVal] of Object.entries(attrs)) {
        if (rawVal === undefined || rawVal === null || rawVal === "") continue;
        // Skip overly long narrative attributes like consultant bio
        const strVal = String(rawVal).trim();
        if (!strVal || strVal.length > 42) continue;
        if (!liveCounts.has(rawCode)) liveCounts.set(rawCode, new Map());
        const codeMap = liveCounts.get(rawCode);
        codeMap.set(strVal, (codeMap.get(strVal) || 0) + 1);
      }
    }

    for (const [code, countsMap] of liveCounts.entries()) {
      if (!facetMap.has(code)) {
        facetMap.set(code, {
          code,
          name: formatAttributeLabel(code),
          unit: code === "screen_size" ? "inches" : code === "duration_minutes" ? "mins" : null,
          optionsMap: countsMap,
        });
      } else {
        const existing = facetMap.get(code);
        for (const [val, cnt] of countsMap.entries()) {
          existing.optionsMap.set(val, cnt);
        }
      }
    }
  }

  const merged = [];
  for (const f of facetMap.values()) {
    const options = Array.from(f.optionsMap.entries())
      .filter(([, count]) => count > 0)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, undefined, { numeric: true }));
    if (options.length > 0) {
      merged.push({
        code: f.code,
        name: f.name,
        unit: f.unit,
        options,
      });
    }
  }
  return merged;
}

function computeCatalogPriceBounds(apiPriceRange) {
  const itemsPool = state.allStoreItems || state.items || [];
  if (itemsPool.length > 0) {
    const prices = itemsPool.map((i) => Number(i.basePrice) || 0).filter((p) => p > 0);
    if (prices.length > 0) {
      const minP = Math.floor(Math.min(...prices) / 100) * 100;
      const rawMax = Math.max(...prices);
      const maxP = Math.max(1000, Math.ceil(rawMax / 1000) * 1000);
      return { min: minP, max: maxP };
    }
  }
  if (apiPriceRange && Number(apiPriceRange.max) > 0) {
    return {
      min: Number(apiPriceRange.min) || 0,
      max: Number(apiPriceRange.max) || 200000,
    };
  }
  return { min: 0, max: 200000 };
}

function renderPricePresets() {
  const desktopPresets = document.getElementById("desktop-price-presets");
  const mobilePresets = document.getElementById("mobile-price-presets");
  const maxCatalogPrice = Number(state.priceRange?.max) || 200000;
  const minCatalogPrice = Number(state.priceRange?.min) || 0;
  const currentMax = Number(document.getElementById("price-filter-max")?.value || maxCatalogPrice);

  // Build smart budget steps based on catalog price range
  const candidateSteps = [5000, 15000, 30000, 50000, 100000].filter(
    (step) => step > minCatalogPrice && step < maxCatalogPrice
  );
  const steps = candidateSteps.slice(0, 3);

  const buildPresetsHtml = () => {
    let html = `
      <button type="button" onclick="setPricePreset(null)" class="price-preset-btn ${
        !state.priceFilterActive || currentMax >= maxCatalogPrice ? "is-active" : ""
      }">All Prices</button>
    `;
    for (const step of steps) {
      const isStepActive = state.priceFilterActive && currentMax === step;
      const shortLabel = step >= 1000 ? `≤ ${step / 1000}K` : `≤ ${step}`;
      html += `
        <button type="button" onclick="setPricePreset(${step})" class="price-preset-btn ${
          isStepActive ? "is-active" : ""
        }">${shortLabel}</button>
      `;
    }
    return html;
  };

  const html = buildPresetsHtml();
  if (desktopPresets) desktopPresets.innerHTML = html;
  if (mobilePresets) mobilePresets.innerHTML = html;
}

function renderDynamicFiltersUI() {
  const container = document.getElementById("dynamic-facets-container");
  const mobileContainer = document.getElementById("mobile-dynamic-facets");
  if (!container) return;

  const mergedFacets = buildMergedFacets(state.rawApiFacets || []);
  state.facets = mergedFacets;

  // Update Price Sliders
  const bounds = computeCatalogPriceBounds(state.rawApiPriceRange);
  state.priceRange = bounds;

  const maxEl = document.getElementById("price-filter-max");
  const mobileMaxEl = document.getElementById("mobile-price-filter");
  const minLabel = document.getElementById("price-label-min");
  const maxLabel = document.getElementById("price-label-max");
  const mobileLabel = document.getElementById("mobile-price-val");
  const priceStatus = document.getElementById("price-filter-status");

  if (maxEl) {
    maxEl.min = bounds.min;
    maxEl.max = bounds.max;
    if (!state.priceFilterActive || Number(maxEl.value) > bounds.max) {
      maxEl.value = bounds.max;
      state.selectedPriceRange.max = bounds.max;
    } else {
      maxEl.value = state.selectedPriceRange.max;
    }
    if (minLabel) minLabel.textContent = `KES ${Number(bounds.min).toLocaleString()}`;
    if (maxLabel) maxLabel.textContent = `KES ${Number(maxEl.value).toLocaleString()}`;
    if (priceStatus) {
      priceStatus.textContent = state.priceFilterActive
        ? `Up to KES ${Number(maxEl.value).toLocaleString()}`
        : "Any price";
    }
  }

  if (mobileMaxEl) {
    mobileMaxEl.min = bounds.min;
    mobileMaxEl.max = bounds.max;
    mobileMaxEl.value = maxEl ? maxEl.value : bounds.max;
    if (mobileLabel) {
      mobileLabel.textContent = state.priceFilterActive
        ? `Up to KES ${Number(mobileMaxEl.value).toLocaleString()}`
        : `KES ${Number(mobileMaxEl.value).toLocaleString()}`;
    }
  }

  renderPricePresets();

  // Render Facet Groups
  let html = "";
  for (const facet of mergedFacets) {
    if (!facet.options || facet.options.length === 0) continue;
    const selectedForFacet = state.activeFilters[facet.code] || [];

    html += `
      <div class="facet-group pb-4 border-b border-slate-100 last:border-b-0">
        <div class="flex items-center justify-between mb-2.5">
          <label class="filter-section-title block text-xs font-bold text-slate-900 uppercase tracking-wider m-0">
            ${escapeHtml(facet.name)} ${
      facet.unit ? `<span class="text-slate-400 font-normal lowercase">(${escapeHtml(facet.unit)})</span>` : ""
    }
          </label>
          ${
            selectedForFacet.length > 0
              ? `<span class="facet-active-badge">${selectedForFacet.length} selected</span>`
              : ""
          }
        </div>
        <div class="facet-options-list space-y-1 max-h-44 overflow-y-auto pr-1">
    `;

    for (const opt of facet.options) {
      const isChecked = selectedForFacet.some(
        (v) => String(v).toLowerCase() === String(opt.value).toLowerCase()
      );
      html += `
        <label class="facet-option-row flex items-center justify-between text-xs cursor-pointer py-1.5 px-2 rounded-lg transition-colors ${
          isChecked ? "is-checked" : ""
        }">
          <div class="flex items-center gap-2.5 min-w-0">
            <input type="checkbox" onchange="toggleFilter(${inlineJs(facet.code)}, ${inlineJs(opt.value)}, this.checked)" ${
        isChecked ? "checked" : ""
      } class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 shrink-0">
            <span class="facet-option-label truncate">${escapeHtml(opt.value)}</span>
          </div>
          <span class="facet-option-count font-mono text-[11px] shrink-0">${opt.count}</span>
        </label>
      `;
    }

    html += `</div></div>`;
  }

  container.innerHTML = html;
  if (mobileContainer) {
    mobileContainer.innerHTML = html;
  }
}

async function loadDynamicFilters() {
  const categorySlug = state.selectedCategory;
  const endpoint = categorySlug
    ? `/api/filters?category=${encodeURIComponent(categorySlug)}`
    : `/api/filters`;

  const res = await apiFetch(endpoint);
  if (categorySlug !== state.selectedCategory) return;

  if (res.ok && res.data.success) {
    const data = res.data.data || {};
    state.rawApiFacets = data.facets || [];
    state.rawApiPriceRange = data.priceRange || null;
  }
  renderDynamicFiltersUI();
}

function toggleFilter(code, value, checked) {
  if (!state.activeFilters[code]) {
    state.activeFilters[code] = [];
  }

  if (checked) {
    if (!state.activeFilters[code].includes(value)) {
      state.activeFilters[code].push(value);
    }
  } else {
    state.activeFilters[code] = state.activeFilters[code].filter((v) => v !== value);
    if (state.activeFilters[code].length === 0) {
      delete state.activeFilters[code];
    }
  }

  renderDynamicFiltersUI();
  loadItems();
}

function toggleDealsFilter(force) {
  state.onlyDeals = typeof force === "boolean" ? force : !state.onlyDeals;
  loadItems();
}

function setItemTypeFilter(type) {
  state.itemTypeFilter = state.itemTypeFilter === type ? "" : type;
  loadItems();
}

function onDesktopPriceInput(val) {
  const numeric = Number(val) || 0;
  const maxLabel = document.getElementById("price-label-max");
  const statusEl = document.getElementById("price-filter-status");
  const mobileSlider = document.getElementById("mobile-price-filter");
  const mobileLabel = document.getElementById("mobile-price-val");
  if (maxLabel) maxLabel.textContent = `KES ${numeric.toLocaleString()}`;
  if (statusEl) {
    statusEl.textContent =
      numeric < (state.priceRange?.max || 200000)
        ? `Up to KES ${numeric.toLocaleString()}`
        : "Any price";
  }
  if (mobileSlider) mobileSlider.value = String(numeric);
  if (mobileLabel) mobileLabel.textContent = `KES ${numeric.toLocaleString()}`;
}

function applyPriceFilter(val) {
  const numeric = Number(val) || 0;
  const maxBound = Number(state.priceRange?.max) || 200000;
  state.selectedPriceRange.max = numeric;
  state.priceFilterActive = numeric < maxBound;
  onDesktopPriceInput(numeric);
  renderPricePresets();
  loadItems();
}

function setPricePreset(maxVal) {
  const maxBound = Number(state.priceRange?.max) || 200000;
  const target = maxVal === null ? maxBound : Number(maxVal);
  state.selectedPriceRange.max = target;
  state.priceFilterActive = maxVal !== null && target < maxBound;
  const pcSlider = document.getElementById("price-filter-max");
  const mobSlider = document.getElementById("mobile-price-filter");
  if (pcSlider) pcSlider.value = String(target);
  if (mobSlider) mobSlider.value = String(target);
  onDesktopPriceInput(target);
  renderPricePresets();
  loadItems();
}

function removeSingleFilter(type, key, val) {
  if (type === "category") {
    state.selectedCategory = "";
    renderCategoryNavigation();
    loadDynamicFilters();
  } else if (type === "search") {
    const sInput = document.getElementById("search-input");
    const mInput = document.getElementById("mobile-search-input");
    if (sInput) sInput.value = "";
    if (mInput) mInput.value = "";
    syncSearchClearButtons();
  } else if (type === "price") {
    setPricePreset(null);
    return;
  } else if (type === "deals") {
    state.onlyDeals = false;
  } else if (type === "itemType") {
    state.itemTypeFilter = "";
  } else if (type === "wishlist") {
    toggleWishlistView(false);
    return;
  } else if (type === "facet" && key) {
    if (state.activeFilters[key]) {
      state.activeFilters[key] = state.activeFilters[key].filter((v) => v !== val);
      if (state.activeFilters[key].length === 0) delete state.activeFilters[key];
    }
    renderDynamicFiltersUI();
  }
  loadItems();
}
