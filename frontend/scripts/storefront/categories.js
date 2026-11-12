// Categories & Dynamic Faceted Filters Engine

const STOREFRONT_CATEGORY_HISTORY_KEY = "__storefrontCategory";

if (typeof window !== "undefined" && window.history) {
  const currentHistoryState = window.history.state && typeof window.history.state === "object"
    ? window.history.state
    : {};
  if (!(STOREFRONT_CATEGORY_HISTORY_KEY in currentHistoryState)) {
    window.history.replaceState(
      { ...currentHistoryState, [STOREFRONT_CATEGORY_HISTORY_KEY]: state.selectedCategory || "" },
      "",
      window.location.href,
    );
  }

  window.addEventListener("popstate", (event) => {
    const historyState = event.state;
    if (!historyState || typeof historyState !== "object" || !(STOREFRONT_CATEGORY_HISTORY_KEY in historyState)) return;
    const previousCategory = historyState[STOREFRONT_CATEGORY_HISTORY_KEY] || "";
    if (previousCategory === (state.selectedCategory || "")) return;
    toggleFilterPopover(null);
    state.selectedCategory = previousCategory;
    renderCategoryNavigation();
    Promise.all([loadDynamicFilters(), loadItems()]).then(scrollCatalogItemsIntoView);
  });
}

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

function syncCategoryScrollHint() {
  const strip = document.getElementById("category-pills");
  const hint = document.getElementById("category-scroll-hint");
  if (!strip || !hint) return;
  const canScroll = strip.scrollWidth > strip.clientWidth + 1;
  const hasMore = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2;
  hint.classList.toggle("hidden", !canScroll || !hasMore);
  hint.disabled = !hasMore;
}

window.addEventListener("resize", syncCategoryScrollHint, { passive: true });

const categoryPillStrip = document.getElementById("category-pills");
const categoryScrollHint = document.getElementById("category-scroll-hint");
categoryPillStrip?.addEventListener("scroll", syncCategoryScrollHint, { passive: true });
categoryScrollHint?.addEventListener("click", () => {
  if (!categoryPillStrip) return;
  categoryPillStrip.scrollBy({ left: Math.max(150, categoryPillStrip.clientWidth * 0.72), behavior: "smooth" });
});

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
      <button type="button" onclick="event.stopPropagation(); toggleFilterPopover('popover-${facet.code}', this)" class="category-pill pc-filter-dropdown-btn ${
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
      <button id="pc-price-dropdown-btn" type="button" onclick="event.stopPropagation(); toggleFilterPopover('price-popover', this)" class="category-pill pc-filter-dropdown-btn ${
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

function buildCategoryFilterDividerHtml() {
  return `
    <div class="category-filter-divider shrink-0 flex items-center gap-1.5 px-2 my-auto self-stretch" aria-hidden="true">
      <span class="category-filter-divider-line"></span>
      <span class="category-filter-divider-label">
        <i data-lucide="sliders-horizontal" class="w-3 h-3 text-slate-400"></i>
        <span>Filters</span>
      </span>
    </div>
  `;
}

function buildResetFiltersPillHtml() {
  return `
    <button type="button" onclick="resetFilters()" class="category-pill category-pill-inactive shrink-0" aria-label="Reset filters and show all categories" title="Reset filters and return to all categories">
      <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
      <span>Reset Filters</span>
    </button>
  `;
}

function getCategoryPhoto(category) {
  if (category.imageUrl) return category.imageUrl;
  if (category.bannerUrl) return category.bannerUrl;

  const allItems = state.allStoreItems || state.items || [];
  const matchingItem = allItems.find((item) => {
    if (!item.images || !item.images.length) return false;
    if (item.categoryId === category.id) return true;
    if (category.children && category.children.some((c) => c.id === item.categoryId)) return true;
    return matchesCategory(item.categoryId, category.slug);
  });
  if (matchingItem && matchingItem.images && matchingItem.images[0]) {
    return matchingItem.images[0];
  }

  const name = (category.name || "").toLowerCase();
  const slug = (category.slug || "").toLowerCase();
  const text = `${name} ${slug}`;

  if (/shoe|footwear|sneaker|heel|boot|loafer/.test(text)) {
    return "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80";
  }
  if (/cloth|dress|shirt|trouser|jacket|hoodie|suit|men|women|fashion|wear|outfit/.test(text)) {
    return "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=600&auto=format&fit=crop&q=80";
  }
  if (/phone|smartphone|tablet|iphone|samsung|mobile/.test(text)) {
    return "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80";
  }
  if (/laptop|computer|macbook|pc|desktop/.test(text)) {
    return "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80";
  }
  if (/audio|sound|headphone|earphone|speaker/.test(text)) {
    return "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80";
  }
  if (/electronic|tv|gadget|smart home|charger|cable/.test(text)) {
    return "https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=600&auto=format&fit=crop&q=80";
  }
  if (/braid|wig|hair|weave|styling|salon|cut/.test(text)) {
    return "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&auto=format&fit=crop&q=80";
  }
  if (/barber|fade|shave|beard|grooming/.test(text)) {
    return "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&auto=format&fit=crop&q=80";
  }
  if (/massage|spa|wellness|facial|scrub|relax/.test(text)) {
    return "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&auto=format&fit=crop&q=80";
  }
  if (/photo|camera|portrait|studio|wedding|video/.test(text)) {
    return "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&auto=format&fit=crop&q=80";
  }
  if (/apartment|house|home|vacant|rental|villa|flat|studio/.test(text)) {
    return "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&auto=format&fit=crop&q=80";
  }
  if (/land|plot|real estate|commercial|acre/.test(text)) {
    return "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=80";
  }
  if (/code|software|cloud|web|engineer|design|dev/.test(text)) {
    return "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&auto=format&fit=crop&q=80";
  }
  if (/drive|driving|license|motorcycle|vehicle|car|lesson/.test(text)) {
    return "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=600&auto=format&fit=crop&q=80";
  }
  if (/bag|watch|accessory|jewelry|ring/.test(text)) {
    return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80";
  }
  if (/furniture|decor|bed|sofa|table/.test(text)) {
    return "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&auto=format&fit=crop&q=80";
  }

  return "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&auto=format&fit=crop&q=80";
}

function renderCategoryNavigation(animateLevelChange = false) {
  const container = document.getElementById("category-pills");
  const breadcrumbPath = document.getElementById("storefront-breadcrumb-path");
  const breadcrumbViewport = document.getElementById("storefront-breadcrumb-viewport");
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

  // Browse categories as product-style cards with photos and titles
  const categoryCards = document.getElementById("category-cards-grid");
  const isSearchActive = Boolean(document.getElementById("search-input")?.value?.trim() || document.getElementById("mobile-search-input")?.value?.trim());
  const isWishlistActive = Boolean(state.showWishlistOnly);

  if (categoryCards) {
    let cardCategories = [];
    let sectionTitle = "";

    if (!isSearchActive && !isWishlistActive) {
      if (!currentSlug) {
        // Level 0 (All departments): Show main root categories
        cardCategories = categories;
        sectionTitle = "Departments";
      } else if (activeRoot && (activeRoot.children || []).length > 0) {
        // Level 1: Main category selected -> Show its subcategories!
        cardCategories = activeRoot.children;
        sectionTitle = `${activeRoot.name} Subcategories`;
      }
    }

    if (cardCategories.length > 0) {
      categoryCards.classList.remove("hidden");
      categoryCards.innerHTML = `
        <div class="col-span-full flex items-center justify-between pt-1 pb-2 border-b border-slate-100 mb-3">
          <h2 class="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <i data-lucide="layers" class="w-3.5 h-3.5 text-emerald-600"></i>
            <span>${escapeHtml(sectionTitle)}</span>
          </h2>
          <span class="text-[11px] text-slate-400 font-semibold">${cardCategories.length} ${cardCategories.length === 1 ? 'category' : 'categories'}</span>
        </div>
        ${cardCategories.map((cat) => {
          const photo = getCategoryPhoto(cat);
          const count = getCategoryItemCount(cat.slug);
          const hasChildren = (cat.children || []).length > 0;
          const subCountText = hasChildren ? `${cat.children.length} subcategories` : "";
          const itemCountText = count !== null ? `${count} ${count === 1 ? 'item' : 'items'}` : 'Browse';

          return `
            <article class="product-card category-card flex flex-col group cursor-pointer" onclick="selectCategory('${escapeHtml(cat.slug)}')">
              <div class="product-card-media relative overflow-hidden flex items-center justify-center">
                <img src="${escapeHtml(photo)}" alt="${escapeHtml(cat.name)}" loading="lazy" decoding="async" width="400" height="400" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                <div class="product-badge-rail absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none">
                  <span class="product-tag-pill font-mono">${hasChildren ? 'Department' : 'Category'}</span>
                </div>
              </div>
              <div class="product-card-content flex-1 flex flex-col justify-between">
                <div>
                  <div class="product-card-meta-row flex items-center justify-between gap-1.5 mb-1">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-600">${itemCountText}</span>
                    ${subCountText ? `<span class="product-stock-note">${subCountText}</span>` : ""}
                  </div>
                  <h3 class="product-card-title">${escapeHtml(cat.name)}</h3>
                  ${cat.description ? `<p class="product-card-desc">${escapeHtml(cat.description)}</p>` : ""}
                </div>
                <div class="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600">
                  <span>${hasChildren ? "Open Subcategories" : "View Items"}</span>
                  <i data-lucide="arrow-right" class="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform"></i>
                </div>
              </div>
            </article>
          `;
        }).join("")}
      `;
      renderIcons(categoryCards);
    } else {
      categoryCards.classList.add("hidden");
      categoryCards.innerHTML = "";
    }
  }
  container.classList.remove("hidden");
  document.getElementById("items-grid")?.classList.remove("hidden");

  // 1. Render URL-Like Breadcrumb Trail for Backtracking
  if (breadcrumbPath) {
    if (!currentSlug) {
      // Level 0: Leave the breadcrumb clear when no category is selected.
      breadcrumbPath.innerHTML = `
        <span class="url-protocol text-slate-400">catalog://</span>
      `;
    } else if (activeRoot) {
      // Level 1: Keep the parent breadcrumb as the back action; omit the current category title.
      breadcrumbPath.innerHTML = `
        <span class="url-protocol text-slate-400">catalog://</span>
        <button type="button" onclick="selectCategory('')" class="url-crumb-btn text-slate-500 hover:text-slate-900 underline-offset-2 hover:underline transition-colors" title="Back to all departments">all-departments</button>
      `;
    } else if (activeSub && parentOfSub) {
      // Level 2: Keep parent breadcrumbs for backtracking; omit the current subcategory title.
      breadcrumbPath.innerHTML = `
        <span class="url-protocol text-slate-400">catalog://</span>
        <button type="button" onclick="selectCategory('')" class="url-crumb-btn text-slate-500 hover:text-slate-900 underline-offset-2 hover:underline transition-colors" title="Back to all departments">all-departments</button>
        <span class="url-slash text-slate-300">/</span>
        <button type="button" onclick="selectCategory('${escapeHtml(parentOfSub.slug)}')" class="url-crumb-btn text-slate-500 hover:text-slate-900 underline-offset-2 hover:underline transition-colors" title="Back to ${escapeHtml(parentOfSub.name)}">${escapeHtml(parentOfSub.slug || parentOfSub.name.toLowerCase().replace(/\s+/g, "-"))}</button>
      `;
    }
    if (breadcrumbPath.parentElement) renderIcons(breadcrumbPath.parentElement);
    if (breadcrumbViewport) {
      requestAnimationFrame(() => {
        breadcrumbViewport.scrollTo({
          left: 0,
          behavior: "auto",
        });
      });
    }
  }

  // 2. Render Morphing Tabs Strip
  let pillsHtml = "";

  if (!currentSlug) {
    // Level 0: Show ONLY main categories upfront
    pillsHtml += `
      <button onclick="selectCategory('')" class="category-pill category-pill-active shrink-0" aria-selected="true" type="button">
        <span>All</span>
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
    // Distinct separator between categories and filters
    pillsHtml += buildCategoryFilterDividerHtml();
    pillsHtml += buildPriceDropdownHtml();
    pillsHtml += buildResetFiltersPillHtml();
  } else if (activeRoot) {
    // Level 1: User pressed/selected a main category - NOW show its subcategories!
    const subcategories = activeRoot.children || [];

    // Back to All button
    pillsHtml += `
      <button onclick="selectCategory('')" class="category-pill category-pill-inactive shrink-0" aria-selected="false" type="button" title="View all departments">
        <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
        <span>All</span>
      </button>
    `;

    // Active main category pill
    pillsHtml += `
      <button onclick="selectCategory('${escapeHtml(activeRoot.slug)}')" class="category-pill category-pill-active shrink-0" aria-selected="true" type="button">
        <span>${escapeHtml(activeRoot.name)}</span>
      </button>
    `;

    // Render direct subcategories
    for (const sub of subcategories) {
      const subCount = getCategoryItemCount(sub.slug);
      pillsHtml += `
        <button onclick="selectCategory('${escapeHtml(sub.slug)}')" class="category-pill category-pill-inactive shrink-0" aria-selected="false" type="button">
          <span>${escapeHtml(sub.name)}</span>
          ${subCount !== null ? `<span class="category-pill-count">${subCount}</span>` : ""}
        </button>
      `;
    }

    // Distinct separator between categories and filters
    pillsHtml += buildCategoryFilterDividerHtml();
    pillsHtml += buildPriceDropdownHtml();
    pillsHtml += buildResetFiltersPillHtml();
  } else if (activeSub && parentOfSub) {
    // Level 2: User selected a subcategory
    pillsHtml += `
      <button onclick="selectCategory('${escapeHtml(parentOfSub.slug)}')" class="category-pill category-pill-inactive shrink-0" aria-selected="false" type="button" title="Back to ${escapeHtml(parentOfSub.name)}">
        <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
        <span>${escapeHtml(parentOfSub.name)}</span>
      </button>
    `;
    pillsHtml += `
      <button onclick="selectCategory('${escapeHtml(activeSub.slug)}')" class="category-pill category-pill-active shrink-0" aria-selected="true" type="button">
        <span>${escapeHtml(activeSub.name)}</span>
      </button>
    `;

    // Sibling subcategories
    for (const sibling of (parentOfSub.children || [])) {
      if (sibling.slug === activeSub.slug) continue;
      const sibCount = getCategoryItemCount(sibling.slug);
      pillsHtml += `
        <button onclick="selectCategory('${escapeHtml(sibling.slug)}')" class="category-pill category-pill-inactive shrink-0" aria-selected="false" type="button">
          <span>${escapeHtml(sibling.name)}</span>
          ${sibCount !== null ? `<span class="category-pill-count">${sibCount}</span>` : ""}
        </button>
      `;
    }

    // Distinct separator between categories and filters
    pillsHtml += buildCategoryFilterDividerHtml();
    for (const facet of (state.facets || [])) {
      pillsHtml += buildFacetDropdownHtml(facet);
    }
    pillsHtml += buildPriceDropdownHtml();
    pillsHtml += buildResetFiltersPillHtml();
  }

  container.innerHTML = pillsHtml;
  container.scrollLeft = 0;
  requestAnimationFrame(syncCategoryScrollHint);
  if (animateLevelChange) {
    Array.from(container.children).forEach((pill, index) => {
      pill.classList.add("filter-brick-lay-in");
      pill.style.setProperty("--filter-brick-delay", `${Math.min(index, 8) * 90}ms`);
      pill.addEventListener("animationend", () => {
        pill.classList.remove("filter-brick-lay-in");
        pill.style.removeProperty("--filter-brick-delay");
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
        const isChildSelected = children.some((sub) => state.selectedCategory === sub.slug);
        const expanded = isSelected || isChildSelected;
        const count = getCategoryItemCount(cat.slug);
        mobileHtml += `<div class="category-filter-group ${expanded ? 'is-expanded' : ''}">
          <button onclick="selectCategory('${escapeHtml(cat.slug)}')" class="category-pill ${
            isSelected ? "category-pill-active" : isChildSelected ? "category-pill-parent-active" : "category-pill-inactive"
          }" aria-selected="${isSelected || isChildSelected}" aria-expanded="${expanded}" type="button">
            <span class="flex items-center gap-1.5">
              <span>${escapeHtml(cat.name)}</span>
              ${children.length > 0 ? `<i data-lucide="${expanded ? 'chevron-up' : 'chevron-down'}" class="w-3.5 h-3.5 opacity-60"></i>` : ''}
            </span>
            ${count !== null ? `<span class="category-pill-count">${count}</span>` : ""}
          </button>`;
        if (children.length > 0 && expanded) {
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
      renderIcons(mobileCategoryContainer);
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
  if (shouldAnimate && window.matchMedia?.("(max-width: 767px)").matches) {
    const currentHistoryState = window.history.state && typeof window.history.state === "object"
      ? window.history.state
      : {};
    window.history.pushState(
      { ...currentHistoryState, [STOREFRONT_CATEGORY_HISTORY_KEY]: slug || "" },
      "",
      window.location.href,
    );
  }
  toggleFilterPopover(null);
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
  loadItems().then(scrollCatalogItemsIntoView);
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
  loadItems().then(scrollCatalogItemsIntoView);
}

function clearFacetFilter(code) {
  if (state.activeFilters[code]) {
    delete state.activeFilters[code];
  }
  renderDynamicFiltersUI();
  loadItems().then(scrollCatalogItemsIntoView);
}

function toggleDealsFilter(force) {
  state.onlyDeals = typeof force === "boolean" ? force : !state.onlyDeals;
  loadItems().then(scrollCatalogItemsIntoView);
}

function setItemTypeFilter(type) {
  state.itemTypeFilter = state.itemTypeFilter === type ? "" : type;
  loadItems().then(scrollCatalogItemsIntoView);
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
  loadItems().then(scrollCatalogItemsIntoView);
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
  loadItems().then(scrollCatalogItemsIntoView);
}

function toggleFilterPopover(id, trigger = null) {
  const allPopovers = document.querySelectorAll(".filter-popover-card");
  trigger ||= Array.from(document.querySelectorAll(".pc-filter-dropdown-btn"))
    .find((button) => button.getAttribute("aria-controls") === id);
  const filterWrap = trigger?.closest(".drilldown-facet-wrap, .drilldown-price-wrap");
  const targetPopover = filterWrap?.querySelector(".filter-popover-card")
    || Array.from(allPopovers).find((popover) => popover.id === id);
  const openingPopover = targetPopover?.classList.contains("hidden") ? targetPopover : null;

  allPopovers.forEach((el) => closeFilterPopover(el));
  if (!openingPopover) return;

  if (!trigger || !openingPopover.parentNode) return;

  const placeholder = document.createComment(`popover:${id}`);
  openingPopover.parentNode.insertBefore(placeholder, openingPopover);
  openingPopover._popoverPlaceholder = placeholder;
  openingPopover._popoverTrigger = trigger;
  document.body.appendChild(openingPopover);
  openingPopover.classList.remove("hidden");
  openingPopover.style.setProperty("display", "block", "important");
  trigger.setAttribute("aria-expanded", "true");
  trigger.classList.add("is-open");

  const triggerRect = trigger.getBoundingClientRect();
  const panelWidth = Math.min(openingPopover.getBoundingClientRect().width || 256, window.innerWidth - 24);
  const left = Math.max(12, Math.min(triggerRect.left, window.innerWidth - panelWidth - 12));
  const top = triggerRect.bottom + 8;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const availableHeight = Math.max(0, viewportHeight - top - 12);
  Object.assign(openingPopover.style, {
    position: "fixed",
    inset: "auto",
    top: `${top}px`,
    left: `${left}px`,
    right: "auto",
    bottom: "auto",
    width: `${panelWidth}px`,
    maxHeight: `${availableHeight}px`,
    overflowY: "auto",
    zIndex: "1000",
    margin: "0",
  });
}

function closeFilterPopover(popover) {
  if (!popover) return;
  const trigger = popover._popoverTrigger || Array.from(document.querySelectorAll(".pc-filter-dropdown-btn"))
    .find((button) => button.getAttribute("aria-controls") === popover.id);
  if (popover._popoverPlaceholder?.parentNode) {
    popover._popoverPlaceholder.parentNode.insertBefore(popover, popover._popoverPlaceholder);
    popover._popoverPlaceholder.remove();
  }
  delete popover._popoverPlaceholder;
  delete popover._popoverTrigger;
  popover.classList.add("hidden");
  popover.removeAttribute("style");
  trigger?.setAttribute("aria-expanded", "false");
  trigger?.classList.remove("is-open");
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
    const trigger = openPopover._popoverTrigger;
    const clickedTrigger = trigger && (e.composedPath().includes(trigger) || trigger.contains(e.target));
    if (!openPopover.contains(e.target) && !clickedTrigger) {
      closeFilterPopover(openPopover);
    }
  });

  document.addEventListener("scroll", () => {
    document.querySelectorAll(".filter-popover-card:not(.hidden)").forEach(closeFilterPopover);
  }, true);

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
  loadItems().then(scrollCatalogItemsIntoView);
}
