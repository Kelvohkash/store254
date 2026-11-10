// Categories & Dynamic Faceted Filters

async function loadCategories() {
  const res = await apiFetch("/api/categories");
  const container = document.getElementById("category-pills");
  const mobileCategoryContainer = document.getElementById("mobile-category-pills");
  const mobileCategorySection = document.getElementById("mobile-category-filter-section");
  const headerContainer = document.getElementById("storefront-header-categories");
  const mobileHeaderContainer = document.getElementById("fashion-mobile-categories");
  const headerNav = document.getElementById("storefront-fashion-nav");
  if (!container) return;

  if (res.ok && res.data.success) {
    state.categories = res.data.data;
    const isFashionTemplate = document.documentElement.dataset.storefrontTemplate === "fashion-and-design";
    const isHeaderFashionTemplate = document.documentElement.dataset.storefrontTemplate === "fashion-beauty-cosmetics";
    let html = `
      <button onclick="selectCategory('')" class="category-pill ${
        state.selectedCategory === ""
          ? "category-pill-active"
          : "category-pill-inactive"
      }" aria-selected="${state.selectedCategory === ""}" type="button">All Categories</button>
    `;

    for (const cat of state.categories) {
      const isSelected = state.selectedCategory === cat.slug;
      const children = cat.children || [];
      if (isFashionTemplate) {
        const expanded = isSelected || children.some((sub) => state.selectedCategory === sub.slug);
        html += `<div class="category-filter-group">
          <button onclick="selectCategory('${escapeHtml(cat.slug)}')" class="category-pill ${isSelected ? "category-pill-active" : "category-pill-inactive"}" aria-selected="${isSelected}" aria-expanded="${expanded}" type="button">${escapeHtml(cat.name)}${children.length ? `<span class="category-expand-indicator" aria-hidden="true">${expanded ? "−" : "+"}</span>` : ""}</button>`;
        if (children.length > 0 && expanded) {
          html += `<div class="category-subcategory-list" aria-label="${escapeHtml(cat.name)} subcategories">`;
          for (const sub of children) {
            const isSubSelected = state.selectedCategory === sub.slug;
            html += `<button onclick="selectCategory('${escapeHtml(sub.slug)}')" class="category-subpill ${isSubSelected ? "category-subpill-active" : "category-subpill-inactive"}" aria-selected="${isSubSelected}" type="button">${escapeHtml(sub.name)}</button>`;
          }
          html += `</div>`;
        }
        html += `</div>`;
        continue;
      }

      html += `
        <button onclick="selectCategory('${escapeHtml(cat.slug)}')" class="category-pill ${
        isSelected ? "category-pill-active" : "category-pill-inactive"
      }" aria-selected="${isSelected}" type="button">
          ${escapeHtml(cat.name)}
        </button>
      `;

      // Other templates retain their current flat category listing.
      if (children.length > 0) {
        for (const sub of children) {
          const isSubSelected = state.selectedCategory === sub.slug;
          html += `
            <button onclick="selectCategory('${escapeHtml(sub.slug)}')" class="category-subpill ${
            isSubSelected
              ? "category-subpill-active"
              : "category-subpill-inactive"
          }">
              ↳ ${escapeHtml(sub.name)}
            </button>
          `;
        }
      }
    }

    container.innerHTML = html;
    if (mobileCategoryContainer) mobileCategoryContainer.innerHTML = isFashionTemplate ? html : "";
    mobileCategorySection?.classList.toggle("hidden", !isFashionTemplate);
    if (headerContainer) headerContainer.innerHTML = isHeaderFashionTemplate ? html : "";
    if (mobileHeaderContainer) mobileHeaderContainer.innerHTML = isHeaderFashionTemplate ? html : "";
    headerNav?.classList.toggle("hidden", !isHeaderFashionTemplate);
  }
}

function selectCategory(slug) {
  state.selectedCategory = slug;
  loadCategories();
  Promise.all([loadDynamicFilters(), loadItems()]).then(scrollCatalogItemsIntoView);
}

let searchDebounceTimer = null;
function debouncedLoadItems() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadItems().then(scrollCatalogItemsIntoView);
  }, 280);
}

async function loadDynamicFilters() {
  const endpoint = state.selectedCategory
    ? `/api/filters?category=${state.selectedCategory}`
    : `/api/filters`;

  const res = await apiFetch(endpoint);
  const container = document.getElementById("dynamic-facets-container");
  if (!container) return;

  if (res.ok && res.data.success) {
    const data = res.data.data;
    state.facets = data.facets || [];

    // Update Price Sliders
    if (data.priceRange) {
      state.priceRange = data.priceRange;
      const maxEl = document.getElementById("price-filter-max");
      const minLabel = document.getElementById("price-label-min");
      const maxLabel = document.getElementById("price-label-max");

      if (maxEl) {
        maxEl.min = data.priceRange.min;
        maxEl.max = data.priceRange.max;

        if (state.selectedPriceRange.max === 200000) {
          maxEl.value = data.priceRange.max;
        }

        if (minLabel) minLabel.textContent = `KES ${Number(data.priceRange.min).toLocaleString()}`;
        if (maxLabel) maxLabel.textContent = `KES ${Number(maxEl.value).toLocaleString()}`;
      }
    }

    // Render Facet Checkboxes
    let html = "";
    for (const facet of state.facets) {
      if (!facet.options || facet.options.length === 0) continue;

      html += `
        <div class="mb-5 pb-5 border-b border-slate-100">
          <label class="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
            ${escapeHtml(facet.name)} ${facet.unit ? `<span class="text-slate-400 font-normal">(${escapeHtml(facet.unit)})</span>` : ""}
          </label>
          <div class="space-y-1.5 max-h-40 overflow-y-auto">
      `;

      for (const opt of facet.options) {
        const isChecked = state.activeFilters[facet.code]?.includes(opt.value);
        html += `
          <label class="flex items-center justify-between text-xs text-slate-700 hover:text-slate-900 cursor-pointer py-0.5">
            <div class="flex items-center gap-2">
              <input type="checkbox" onchange="toggleFilter(${inlineJs(facet.code)}, ${inlineJs(opt.value)}, this.checked)" ${
          isChecked ? "checked" : ""
        } class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5">
              <span>${escapeHtml(opt.value)}</span>
            </div>
            <span class="text-slate-400 font-mono text-[11px]">${opt.count}</span>
          </label>
        `;
      }

      html += `</div></div>`;
    }

    container.innerHTML = html;
  }
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

  loadItems().then(scrollCatalogItemsIntoView);
}
