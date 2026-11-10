// Storefront Product & Service Catalog Rendering
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
        <div class="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
        <div class="h-3 bg-slate-200 rounded w-1/3 mb-4"></div>
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

function getFilteredItems(items) {
  const q = document.getElementById("search-input")?.value?.trim().toLowerCase() || "";
  const maxP = Number(document.getElementById("price-filter-max")?.value || 0);
  const activeEntries = Object.entries(state.activeFilters || {});

  return items.filter((item) => {
    if (state.showWishlistOnly && !state.wishlist.includes(item.id)) return false;
    if (state.selectedCategory && !matchesCategory(item.categoryId, state.selectedCategory)) return false;
    if (maxP > 0 && !state.showWishlistOnly && Number(item.basePrice) > maxP) return false;
    if (q) {
      const t = String(item.title || "").toLowerCase();
      const d = String(item.description || "").toLowerCase();
      if (!t.includes(q) && !d.includes(q)) return false;
    }
    return !activeEntries.some(([k, vals]) => vals?.length && !vals.some((v) => v.toLowerCase() === String(item.attributes?.[k] || "").toLowerCase()));
  });
}

function buildItemCardHtml(item) {
  const isService = item.itemType === "SERVICE";
  const hasDisc = item.compareAtPrice && item.compareAtPrice > item.basePrice;
  const discPct = hasDisc ? Math.round(((item.compareAtPrice - item.basePrice) / item.compareAtPrice) * 100) : 0;
  const primaryImg = item.images?.[0] || (isService
    ? "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80"
    : "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80");
  const secImg = item.images?.[1];
  const showSec = document.documentElement.dataset.storefrontType === "lifestyle-boutique";
  const isWish = state.wishlist.includes(item.id);

  return `
    <div class="product-card flex flex-col group relative">
      <div class="product-card-media relative overflow-hidden flex items-center justify-center cursor-pointer" onclick="viewItemDetails(${inlineJs(item.id)})">
        <img src="${escapeHtml(primaryImg)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async" width="400" height="400" class="w-full h-full object-cover">
        ${secImg && showSec ? `<img class="product-card-secondary w-full h-full object-cover" src="${escapeHtml(secImg)}" alt="" loading="lazy" decoding="async" width="400" height="400">` : ""}
        <button type="button" data-wishlist-item="${escapeHtml(item.id)}" class="product-wishlist ${isWish ? "is-wishlisted" : ""}" onclick="event.stopPropagation(); toggleWishlist(${inlineJs(item.id)}, this)" aria-label="${isWish ? "Remove from" : "Add to"} wishlist" aria-pressed="${isWish}">
          <i data-lucide="heart" class="w-4 h-4"></i>
        </button>
        <div class="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
          <div class="flex items-center gap-1.5 flex-wrap">
            ${isService ? `<span class="bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">Service</span>` : hasDisc ? `<span class="badge-discount-urgent">-${discPct}% OFF</span>` : ""}
          </div>
        </div>
      </div>
      <div class="product-card-content flex-1 flex flex-col justify-between">
        <h3 class="product-card-title cursor-pointer" onclick="viewItemDetails(${inlineJs(item.id)})">${escapeHtml(item.title)}</h3>
        <div class="product-card-footer pt-2">
          <div class="flex items-baseline gap-2 mb-2"><span class="product-card-price">KES ${Number(item.basePrice).toLocaleString()}</span></div>
          <button onclick="addToCart(${inlineJs(item.id)}, ${inlineJs(item.title)}, ${Number(item.basePrice) || 0}, ${inlineJs(primaryImg)}, ${inlineJs(item.itemType)})" class="product-card-add w-full ${isService ? "product-cart-service" : ""} flex items-center justify-center gap-2">
            <i data-lucide="${isService ? "calendar" : "shopping-bag"}" class="w-4 h-4"></i>
            <span>${isService ? "Book Session" : "Add to Cart"}</span>
          </button>
        </div>
      </div>
    </div>`;
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
    sentinel.innerHTML = `<button type="button" onclick="renderCatalogBatch()" class="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Load More Items</button>`;
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
  const container = document.getElementById("items-grid");
  if (!container) return;
  currentFilteredList = getFilteredItems(state.items);
  if (countBadge) countBadge.textContent = state.showWishlistOnly ? `${currentFilteredList.length} saved` : `${currentFilteredList.length} items`;
  currentRenderedCount = 0;
  container.innerHTML = "";

  if (currentFilteredList.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-20 text-center">
        <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
          <i data-lucide="${state.showWishlistOnly ? "heart" : "package-search"}" class="w-6 h-6"></i>
        </div>
        <h3 class="text-base font-bold text-slate-800">${state.showWishlistOnly ? "Your wishlist is empty" : "No items match your filters"}</h3>
        <p class="text-xs text-slate-500 mt-1">${state.showWishlistOnly ? "Tap a heart on any product to save it here." : "Try resetting your filters or search keywords."}</p>
        <button onclick="${state.showWishlistOnly ? "toggleWishlistView(false)" : "resetFilters()"}" class="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 mx-auto">
          <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
          <span>${state.showWishlistOnly ? "Browse all products" : "Reset Filters"}</span>
        </button>
      </div>`;
    renderIcons(container);
    return;
  }
  renderCatalogBatch();
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
    renderCatalogView();
  }
}

function resetFilters() {
  state.activeFilters = {};
  state.selectedCategory = "";
  const sInput = document.getElementById("search-input");
  if (sInput) sInput.value = "";
  const mInput = document.getElementById("mobile-search-input");
  if (mInput) mInput.value = "";
  loadCategories();
  loadDynamicFilters();
  loadItems();
}
