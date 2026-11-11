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

function buildFacetDropdownHtml(facet) {
  if (!facet || !facet.options || facet.options.length === 0) return "";
  const selectedVals = state.activeFilters[facet.code] || [];
  const isActive = selectedVals.length > 0;
  const label = isActive
    ? `${facet.name}: ${selectedVals.length === 1 ? selectedVals[0] : `(${selectedVals.length})`}`
    : `${facet.name}`;

  return `
    <div class="relative inline-block text-left drilldown-facet-wrap shrink-0">
      <button type="button" onclick="toggleFilterPopover('popover-${facet.code}')" class="category-pill pc-filter-dropdown-btn ${
        isActive ? "is-active" : ""
      }" aria-expanded="false" aria-controls="popover-${facet.code}" title="Filter by ${escapeHtml(facet.name)}">
        <i data-lucide="sliders-horizontal" class="w-3.5 h-3.5"></i>
        <span>${escapeHtml(label)}</span>
        <i data-lucide="chevron-down" class="w-3 h-3 text-slate-400"></i>
      </button>
      <div id="popover-${facet.code}" class="filter-popover-card hidden absolute left-0 z-50 mt-2 w-64 p-3.5 bg-white rounded-2xl shadow-xl border border-slate-100">
        <div class="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
          <span class="text-xs font-bold text-slate-900 uppercase tracking-wider">${escapeHtml(facet.name)}</span>
          ${isActive ? `<button type="button" onclick="clearFacetFilter('${facet.code}')" class="text-[11px] text-slate-500 hover:text-slate-800 font-semibold">Clear</button>` : ""}
        </div>
        <div class="facet-options-list space-y-1 max-h-48 overflow-y-auto pr-1">
          ${facet.options
            .map((opt) => {
              const isChecked = selectedVals.some(
                (v) => String(v).toLowerCase() === String(opt.value).toLowerCase()
              );
              return `
                <label class="facet-option-row flex items-center justify-between text-xs cursor-pointer py-1.5 px-2 rounded-lg transition-colors ${
                  isChecked ? "is-checked" : ""
                }">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <input type="checkbox" onchange="toggleFilter('${facet.code}', ${inlineJs(opt.value)}, this.checked)" ${
                isChecked ? "checked" : ""
              } class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 shrink-0">
                    <span class="facet-option-label truncate">${escapeHtml(opt.value)}</span>
                  </div>
                  <span class="facet-option-count font-mono text-[11px] shrink-0">${opt.count}</span>
                </label>
              `;
            })
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function buildPriceDropdownHtml() {
  const maxSliderVal = Number(state.selectedPriceRange?.max || state.priceRange?.max || 200000);
  const maxBound = Number(state.priceRange?.max) || 200000;
  const isPriceActive = Boolean(state.priceFilterActive && maxSliderVal < maxBound);
  const label = isPriceActive
    ? `≤ ${maxSliderVal >= 1000 ? `${Math.round(maxSliderVal / 1000)}K` : maxSliderVal}`
    : "Price: All";

  return `
    <div class="relative inline-block text-left drilldown-price-wrap shrink-0">
      <button id="pc-price-dropdown-btn" type="button" onclick="toggleFilterPopover('price-popover')" class="category-pill pc-filter-dropdown-btn ${
        isPriceActive ? "is-active" : ""
      }" aria-expanded="false" aria-controls="price-popover" title="Filter by price">
        <i data-lucide="badge-dollar-sign" class="w-3.5 h-3.5"></i>
        <span id="pc-price-btn-label">${escapeHtml(label)}</span>
        <i data-lucide="chevron-down" class="w-3 h-3 text-slate-400"></i>
      </button>
      <div id="price-popover" class="filter-popover-card hidden absolute left-0 z-50 mt-2 w-72 p-4 bg-white rounded-2xl shadow-xl border border-slate-100">
        <div class="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <span class="text-xs font-bold text-slate-900 uppercase tracking-wider">Price Budget</span>
          <span id="price-filter-status" class="text-[11px] font-semibold text-slate-500">${isPriceActive ? `Up to KES ${maxSliderVal.toLocaleString()}` : "Any price"}</span>
        </div>
        <div class="flex items-center justify-between text-xs font-mono font-bold text-slate-700 mb-2">
          <span id="price-label-min">KES ${Number(state.priceRange?.min || 0).toLocaleString()}</span>
          <span id="price-label-max">KES ${maxSliderVal.toLocaleString()}</span>
        </div>
        <input type="range" id="price-filter-max" min="${state.priceRange?.min || 0}" max="${maxBound}" value="${maxSliderVal}" oninput="onDesktopPriceInput(this.value)" onchange="applyPriceFilter(this.value)" class="w-full accent-emerald-600 cursor-pointer mb-3">
        <div id="desktop-price-presets" class="price-presets-grid mb-3"></div>
        <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <button type="button" onclick="setPricePreset(null); toggleFilterPopover(null);" class="text-slate-500 hover:text-slate-800 font-semibold">Reset</button>
          <button type="button" onclick="toggleFilterPopover(null)" class="px-3 py-1 bg-slate-900 text-white rounded-lg font-bold">Apply</button>
        </div>
      </div>
    </div>
  `;
}

function buildDealsPillHtml() {
  return `
    <button type="button" data-quick-deals onclick="toggleDealsFilter()" class="category-pill pc-filter-pill-deals shrink-0 ${
      state.onlyDeals ? "category-pill-active" : "category-pill-inactive"
    }" aria-pressed="${Boolean(state.onlyDeals)}" title="Filter on sale items">
      <i data-lucide="flame" class="w-3.5 h-3.5 ${state.onlyDeals ? "text-white" : "text-amber-500"}"></i>
      <span>On Sale</span>
    </button>
  `;
}

function renderCategoryNavigation(animateLevelChange = false) {
  const container = document.getElementById("category-pills");
  const breadcrumbPath = document.getElementById("storefront-breadcrumb-path");
  const backWrap = document.getElementById("storefront-drilldown-back");
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
  const currentSlug = state.selectedCategory || "";
  const totalCount = getCategoryItemCount("");

  // Determine hierarchy level
  const activeRoot = categories.find((c) => c.slug === currentSlug);
  let activeSub = null;
  let parentOfSub = null;

  for (const cat of categories) {
    const sub = (cat.children || []).find((s) => s.slug === currentSlug);
    if (sub) {
      activeSub = sub;
      parentOfSub = cat;
      break;
    }
  }

  // 1. Render URL-Like Breadcrumb Trail for Backtracking
  if (breadcrumbPath) {
    if (!currentSlug) {
      // Level 0: Main Filters / All Departments
      breadcrumbPath.innerHTML = `
        <span class="url-protocol text-slate-400">catalog://</span>
        <span class="url-segment font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">all-departments</span>
      `;
      if (backWrap) {
        backWrap.innerHTML = "";
        backWrap.classList.add("hidden");
      }
    } else if (activeRoot) {
      // Level 1: Root Department (e.g. Electronics)
      const cleanRootSlug = activeRoot.slug || activeRoot.name.toLowerCase().replace(/\s+/g, "-");
      breadcrumbPath.innerHTML = `
        <span class="url-protocol text-slate-400">catalog://</span>
        <button type="button" onclick="selectCategory('')" class="url-crumb-btn text-slate-500 hover:text-slate-900 underline-offset-2 hover:underline transition-colors" title="Back to all departments">all-departments</button>
        <span class="url-slash text-slate-300">/</span>
        <span class="url-segment font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">${escapeHtml(cleanRootSlug)}</span>
      `;
      if (backWrap) {
        backWrap.innerHTML = `
          <button type="button" onclick="selectCategory('')" class="url-back-action-btn flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 text-xs font-bold rounded-xl shadow-xs transition-colors" title="Back to all departments">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5 text-slate-500"></i>
            <span>Main Filters</span>
          </button>
        `;
        backWrap.classList.remove("hidden");
      }
    } else if (activeSub && parentOfSub) {
      // Level 2: Subcategory Leaf (e.g. Smart TVs under Electronics)
      const cleanRootSlug = parentOfSub.slug || parentOfSub.name.toLowerCase().replace(/\s+/g, "-");
      const cleanSubSlug = activeSub.slug || activeSub.name.toLowerCase().replace(/\s+/g, "-");
      breadcrumbPath.innerHTML = `
        <span class="url-protocol text-slate-400">catalog://</span>
        <button type="button" onclick="selectCategory('')" class="url-crumb-btn text-slate-500 hover:text-slate-900 underline-offset-2 hover:underline transition-colors" title="Back to all departments">all-departments</button>
        <span class="url-slash text-slate-300">/</span>
        <button type="button" onclick="selectCategory('${escapeHtml(parentOfSub.slug)}')" class="url-crumb-btn text-slate-500 hover:text-slate-900 underline-offset-2 hover:underline transition-colors" title="Back to ${escapeHtml(parentOfSub.name)}">${escapeHtml(cleanRootSlug)}</button>
        <span class="url-slash text-slate-300">/</span>
        <span class="url-segment font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">${escapeHtml(cleanSubSlug)}</span>
      `;
      if (backWrap) {
        backWrap.innerHTML = `
          <button type="button" onclick="selectCategory('${escapeHtml(parentOfSub.slug)}')" class="url-back-action-btn flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 text-xs font-bold rounded-xl shadow-xs transition-colors" title="Back to ${escapeHtml(parentOfSub.name)}">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5 text-slate-500"></i>
            <span>Back to ${escapeHtml(parentOfSub.name)}</span>
          </button>
        `;
        backWrap.classList.remove("hidden");
      }
    }
    if (breadcrumbPath.parentElement) renderIcons(breadcrumbPath.parentElement);
  }

  // 2. Render Morphing Tabs Strip
  let pillsHtml = "";

  if (!currentSlug) {
    // Level 0: Start with general department tabs
    pillsHtml += `
      <button onclick="selectCategory('')" class="category-pill category-pill-active shrink-0" aria-selected="true" type="button">
        <span>All Departments</span>
        ${totalCount !== null ? `<span class="category-pill-count">${totalCount}</span>` : ""}
      </button>
    `;
    for (const cat of categories) {
      const count = getCategoryItemCount(cat.slug);
      pillsHtml += `
        <button onclick="selectCategory('${escapeHtml(cat.slug)}')" class="category-pill category-pill-inactive shrink-0" aria-selected="false" type="button">
          <span>${escapeHtml(cat.name)}</span>
          ${count !== null ? `<span class="category-pill-count">${count}</span>` : ""}
        </button>
      `;
    }
    // Append general Price filter dropdown and Deals toggle
    pillsHtml += buildPriceDropdownHtml();
    pillsHtml += buildDealsPillHtml();
  } else if (activeRoot) {
    // Level 1: User selected a root category (e.g. Electronics)
    // The first-level tabs are REMOVED and replaced with the electronics sub-filters!
    const subcategories = activeRoot.children || [];
    const rootCount = getCategoryItemCount(activeRoot.slug);

    pillsHtml += `
      <button onclick="selectCategory('${escapeHtml(activeRoot.slug)}')" class="category-pill category-pill-active shrink-0" aria-selected="true" type="button">
        <span>All ${escapeHtml(activeRoot.name)}</span>
        ${rootCount !== null ? `<span class="category-pill-count">${rootCount}</span>` : ""}
      </button>
    `;

    for (const sub of subcategories) {
      const subCount = getCategoryItemCount(sub.slug);
      pillsHtml += `
        <button onclick="selectCategory('${escapeHtml(sub.slug)}')" class="category-pill category-pill-inactive shrink-0" aria-selected="false" type="button">
          <span>${escapeHtml(sub.name)}</span>
          ${subCount !== null ? `<span class="category-pill-count">${subCount}</span>` : ""}
        </button>
      `;
    }

    // Append Brand dropdown if brands exist for this root department
    const brandFacet = (state.facets || []).find((f) => f.code === "brand");
    if (brandFacet) pillsHtml += buildFacetDropdownHtml(brandFacet);

    // Append Price dropdown and Deals toggle
    pillsHtml += buildPriceDropdownHtml();
    pillsHtml += buildDealsPillHtml();
  } else if (activeSub && parentOfSub) {
    // Level 2: User selected a subcategory (e.g. Smart TVs)
    // Replaced with TV-related filters: Brand dropdown, Screen Size, Resolution, Price, etc.!
    const subCount = getCategoryItemCount(activeSub.slug);

    pillsHtml += `
      <button onclick="selectCategory('${escapeHtml(activeSub.slug)}')" class="category-pill category-pill-active shrink-0" aria-selected="true" type="button">
        <span>All ${escapeHtml(activeSub.name)}</span>
        ${subCount !== null ? `<span class="category-pill-count">${subCount}</span>` : ""}
      </button>
    `;

    // Render Brand dropdown and all category-specific spec dropdowns
    for (const facet of (state.facets || [])) {
      pillsHtml += buildFacetDropdownHtml(facet);
    }

    // Append Price dropdown and Deals toggle
    pillsHtml += buildPriceDropdownHtml();
    pillsHtml += buildDealsPillHtml();
  }

  container.innerHTML = pillsHtml;
  if (animateLevelChange) {
    Array.from(container.children).forEach((pill, index) => {
      pill.classList.add("filter-paper-peel-in");
      pill.style.setProperty("--filter-peel-delay", `${Math.min(index, 8) * 34}ms`);
      pill.addEventListener("animationend", () => {
        pill.classList.remove("filter-paper-peel-in");
        pill.style.removeProperty("--filter-peel-delay");
      }, { once: true });
    });
  }
  renderIcons(container);

  // 3. Category Tree inside Desktop Slide-Over Drawer
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
        const isRootActive = activeRoot?.id === cat.id || parentOfSub?.id === cat.id;
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
  const shouldAnimate = state.selectedCategory !== slug;
  state.selectedCategory = slug;
  renderCategoryNavigation();
  Promise.all([loadDynamicFilters(), loadItems()]).then(() => {
    if (shouldAnimate && state.selectedCategory === slug) renderCategoryNavigation(true);
    scrollCatalogItemsIntoView();
  });
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
  const drawerPresets = document.getElementById("desktop-drawer-price-presets");
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
  if (drawerPresets) drawerPresets.innerHTML = html;
  if (mobilePresets) mobilePresets.innerHTML = html;
}

function renderDynamicFiltersUI() {
  const container = document.getElementById("dynamic-facets-container");
  const mobileContainer = document.getElementById("mobile-dynamic-facets");
  const brandList = document.getElementById("pc-brand-options-list");
  const brandWrap = document.getElementById("pc-brand-dropdown-wrap");

  const mergedFacets = buildMergedFacets(state.rawApiFacets || []);
  state.facets = mergedFacets;

  // Update Price Sliders across Popover, Desktop Drawer & Mobile Sheet
  const bounds = computeCatalogPriceBounds(state.rawApiPriceRange);
  state.priceRange = bounds;

  const maxEl = document.getElementById("price-filter-max");
  const drawerMaxEl = document.getElementById("desktop-drawer-price-filter");
  const mobileMaxEl = document.getElementById("mobile-price-filter");
  const minLabel = document.getElementById("price-label-min");
  const maxLabel = document.getElementById("price-label-max");
  const drawerMinLabel = document.getElementById("desktop-drawer-price-min");
  const drawerMaxLabel = document.getElementById("desktop-drawer-price-max");
  const mobileLabel = document.getElementById("mobile-price-val");
  const priceStatus = document.getElementById("price-filter-status");
  const drawerPriceStatus = document.getElementById("desktop-drawer-price-status");
  const priceBtnLabel = document.getElementById("pc-price-btn-label");
  const priceDropdownBtn = document.getElementById("pc-price-dropdown-btn");

  const effectiveMax = (!state.priceFilterActive || Number(maxEl?.value || bounds.max) > bounds.max)
    ? bounds.max
    : Number(state.selectedPriceRange.max || bounds.max);

  if (maxEl) {
    maxEl.min = bounds.min;
    maxEl.max = bounds.max;
    maxEl.value = String(effectiveMax);
    if (minLabel) minLabel.textContent = `KES ${Number(bounds.min).toLocaleString()}`;
    if (maxLabel) maxLabel.textContent = `KES ${Number(effectiveMax).toLocaleString()}`;
    if (priceStatus) {
      priceStatus.textContent = state.priceFilterActive
        ? `Up to KES ${Number(effectiveMax).toLocaleString()}`
        : "Any price";
    }
  }

  if (drawerMaxEl) {
    drawerMaxEl.min = bounds.min;
    drawerMaxEl.max = bounds.max;
    drawerMaxEl.value = String(effectiveMax);
    if (drawerMinLabel) drawerMinLabel.textContent = `KES ${Number(bounds.min).toLocaleString()}`;
    if (drawerMaxLabel) drawerMaxLabel.textContent = `KES ${Number(effectiveMax).toLocaleString()}`;
    if (drawerPriceStatus) {
      drawerPriceStatus.textContent = state.priceFilterActive
        ? `Up to KES ${Number(effectiveMax).toLocaleString()}`
        : "Any price";
    }
  }

  if (mobileMaxEl) {
    mobileMaxEl.min = bounds.min;
    mobileMaxEl.max = bounds.max;
    mobileMaxEl.value = String(effectiveMax);
    if (mobileLabel) {
      mobileLabel.textContent = state.priceFilterActive
        ? `Up to KES ${Number(effectiveMax).toLocaleString()}`
        : `KES ${Number(effectiveMax).toLocaleString()}`;
    }
  }

  if (priceBtnLabel) {
    priceBtnLabel.textContent = state.priceFilterActive
      ? `≤ ${effectiveMax >= 1000 ? `${Math.round(effectiveMax / 1000)}K` : effectiveMax}`
      : "Price: All";
  }
  priceDropdownBtn?.classList.toggle("is-active", Boolean(state.priceFilterActive));

  renderPricePresets();

  // Populate floating Brand Popover list
  const brandFacet = mergedFacets.find((f) => f.code === "brand");
  if (brandList && brandWrap) {
    if (brandFacet && brandFacet.options.length > 0) {
      brandWrap.classList.remove("hidden");
      const selectedBrands = state.activeFilters["brand"] || [];
      const brandBtnLabel = document.getElementById("pc-brand-btn-label");
      const brandDropdownBtn = document.getElementById("pc-brand-dropdown-btn");
      if (brandBtnLabel) {
        brandBtnLabel.textContent = selectedBrands.length > 0
          ? selectedBrands.length === 1 ? selectedBrands[0] : `Brand (${selectedBrands.length})`
          : "Brand";
      }
      brandDropdownBtn?.classList.toggle("is-active", selectedBrands.length > 0);

      brandList.innerHTML = brandFacet.options
        .map((opt) => {
          const isChecked = selectedBrands.some(
            (v) => String(v).toLowerCase() === String(opt.value).toLowerCase()
          );
          return `
            <label class="facet-option-row flex items-center justify-between text-xs cursor-pointer py-1.5 px-2 rounded-lg transition-colors ${
              isChecked ? "is-checked" : ""
            }">
              <div class="flex items-center gap-2.5 min-w-0">
                <input type="checkbox" onchange="toggleFilter('brand', ${inlineJs(opt.value)}, this.checked)" ${
            isChecked ? "checked" : ""
          } class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 shrink-0">
                <span class="facet-option-label truncate">${escapeHtml(opt.value)}</span>
              </div>
              <span class="facet-option-count font-mono text-[11px] shrink-0">${opt.count}</span>
            </label>
          `;
        })
        .join("");
    } else {
      brandWrap.classList.add("hidden");
    }
  }

  // Render Dynamic Facet Groups for Slide-Over Drawer and Mobile Sheet
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

  if (container) container.innerHTML = html;
  if (mobileContainer) mobileContainer.innerHTML = html;
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

function clearFacetFilter(code) {
  if (state.activeFilters[code]) {
    delete state.activeFilters[code];
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
  const drawerMaxLabel = document.getElementById("desktop-drawer-price-max");
  const statusEl = document.getElementById("price-filter-status");
  const drawerStatusEl = document.getElementById("desktop-drawer-price-status");
  const pcSlider = document.getElementById("price-filter-max");
  const drawerSlider = document.getElementById("desktop-drawer-price-filter");
  const mobileSlider = document.getElementById("mobile-price-filter");
  const mobileLabel = document.getElementById("mobile-price-val");
  const priceBtnLabel = document.getElementById("pc-price-btn-label");

  if (maxLabel) maxLabel.textContent = `KES ${numeric.toLocaleString()}`;
  if (drawerMaxLabel) drawerMaxLabel.textContent = `KES ${numeric.toLocaleString()}`;
  const statusText = numeric < (state.priceRange?.max || 200000)
    ? `Up to KES ${numeric.toLocaleString()}`
    : "Any price";
  if (statusEl) statusEl.textContent = statusText;
  if (drawerStatusEl) drawerStatusEl.textContent = statusText;

  if (pcSlider && pcSlider.value !== String(numeric)) pcSlider.value = String(numeric);
  if (drawerSlider && drawerSlider.value !== String(numeric)) drawerSlider.value = String(numeric);
  if (mobileSlider && mobileSlider.value !== String(numeric)) mobileSlider.value = String(numeric);
  if (mobileLabel) mobileLabel.textContent = `KES ${numeric.toLocaleString()}`;

  if (priceBtnLabel) {
    priceBtnLabel.textContent = numeric < (state.priceRange?.max || 200000)
      ? `≤ ${numeric >= 1000 ? `${Math.round(numeric / 1000)}K` : numeric}`
      : "Price: All";
  }
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
  const drawerSlider = document.getElementById("desktop-drawer-price-filter");
  const mobSlider = document.getElementById("mobile-price-filter");
  if (pcSlider) pcSlider.value = String(target);
  if (drawerSlider) drawerSlider.value = String(target);
  if (mobSlider) mobSlider.value = String(target);
  onDesktopPriceInput(target);
  renderPricePresets();
  loadItems();
}

function toggleFilterPopover(id) {
  const allPopovers = document.querySelectorAll(".filter-popover-card");
  allPopovers.forEach((el) => {
    const wrap = el.closest(".relative");
    const btn = wrap?.querySelector(".pc-filter-dropdown-btn");
    if (el.id === id) {
      const willOpen = el.classList.contains("hidden");
      el.classList.toggle("hidden", !willOpen);
      btn?.setAttribute("aria-expanded", String(willOpen));
      btn?.classList.toggle("is-open", willOpen);
    } else {
      el.classList.add("hidden");
      btn?.setAttribute("aria-expanded", "false");
      btn?.classList.remove("is-open");
    }
  });
}

function toggleDesktopFilterDrawer(show) {
  const drawer = document.getElementById("desktop-filter-drawer");
  const btn = document.getElementById("desktop-all-filters-btn");
  if (!drawer) return;
  const willShow = typeof show === "boolean" ? show : drawer.classList.contains("hidden");
  drawer.classList.toggle("hidden", !willShow);
  btn?.setAttribute("aria-expanded", String(willShow));
  document.body.classList.toggle("overflow-hidden", willShow);
  if (willShow) {
    toggleFilterPopover(null);
    renderDynamicFiltersUI();
    renderCategoryNavigation();
    renderIcons(drawer);
  }
}

// Global click-away listener for filter popovers
if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const openPopover = document.querySelector(".filter-popover-card:not(.hidden)");
    if (!openPopover) return;
    const wrap = openPopover.closest(".relative");
    if (wrap && !wrap.contains(e.target)) {
      openPopover.classList.add("hidden");
      const btn = wrap.querySelector(".pc-filter-dropdown-btn");
      btn?.setAttribute("aria-expanded", "false");
      btn?.classList.remove("is-open");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      toggleFilterPopover(null);
      toggleDesktopFilterDrawer(false);
    }
  });
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
