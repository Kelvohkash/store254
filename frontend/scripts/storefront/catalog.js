// Storefront Product & Service Catalog Rendering

async function loadItems() {
  const container = document.getElementById("items-grid");
  const countBadge = document.getElementById("items-count-badge");
  if (!container) return;

  container.innerHTML = `
    <div class="col-span-full py-16 text-center text-slate-400">
      <div class="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full spin-slow mx-auto mb-3"></div>
      <p class="text-sm">Loading catalog items...</p>
    </div>
  `;

  const params = new URLSearchParams();
  if (state.selectedCategory) params.set("category", state.selectedCategory);

  const searchInput = document.getElementById("search-input");
  if (searchInput && searchInput.value.trim()) {
    params.set("search", searchInput.value.trim());
  }

  const maxPriceEl = document.getElementById("price-filter-max");
  if (!state.showWishlistOnly && maxPriceEl && maxPriceEl.value) {
    params.set("maxPrice", maxPriceEl.value);
  }

  for (const [key, values] of Object.entries(state.activeFilters)) {
    if (values && values.length > 0) {
      params.set(key, values.join(","));
    }
  }

  const res = await apiFetch(`/api/items?${params.toString()}`);
  if (res.ok && res.data.success) {
    state.items = res.data.data;
    updateMakerBuyBar();
    const visibleItems = state.showWishlistOnly
      ? state.items.filter((item) => state.wishlist.includes(item.id))
      : state.items;
    if (countBadge) {
      countBadge.textContent = state.showWishlistOnly
        ? `${visibleItems.length} saved`
        : `${visibleItems.length} items`;
    }

    if (visibleItems.length === 0) {
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
        </div>
      `;
      renderIcons();
      return;
    }

    let html = "";
    for (const item of visibleItems) {
      const isService = item.itemType === "SERVICE";
      const hasDiscount = item.compareAtPrice && item.compareAtPrice > item.basePrice;
      const discountPct = hasDiscount ? Math.round(((item.compareAtPrice - item.basePrice) / item.compareAtPrice) * 100) : 0;
      const primaryImage =
        item.images && item.images.length > 0
          ? item.images[0]
          : isService
          ? "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80"
          : "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80";
      const secondaryImage = item.images?.[1];
      const showSecondaryImage = document.documentElement.dataset.storefrontType === "lifestyle-boutique";

      html += `
        <div class="product-card flex flex-col group relative">
          <!-- Product Image Area (Uniform 1:1 Aspect Ratio) -->
          <div class="product-card-media relative overflow-hidden flex items-center justify-center cursor-pointer" onclick="viewItemDetails(${inlineJs(item.id)})">
            <img src="${escapeHtml(primaryImage)}" alt="${escapeHtml(item.title)}" loading="lazy">
            ${
              secondaryImage && showSecondaryImage
                ? `<img class="product-card-secondary" src="${escapeHtml(secondaryImage)}" alt="" loading="lazy">`
                : ""
            }
            ${
              `<button type="button" data-wishlist-item="${escapeHtml(item.id)}" class="product-wishlist ${state.wishlist.includes(item.id) ? "is-wishlisted" : ""}" onclick="event.stopPropagation(); toggleWishlist(${inlineJs(item.id)}, this)" aria-label="${state.wishlist.includes(item.id) ? "Remove from" : "Add to"} wishlist" aria-pressed="${state.wishlist.includes(item.id)}">
                    <i data-lucide="heart" class="w-4 h-4"></i>
                  </button>`
            }

            <!-- Badges Floating Overlay -->
            <div class="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
              <div class="flex items-center gap-1.5 flex-wrap">
                ${
                  isService
                    ? `<span class="bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">Service</span>`
                    : hasDiscount
                    ? `<span class="badge-discount-urgent">-${discountPct}% OFF</span>`
                    : ""
                }
              </div>
            </div>
          </div>

          <!-- Content Details Area -->
          <div class="product-card-content flex-1 flex flex-col justify-between">
              <h3 class="product-card-title cursor-pointer" onclick="viewItemDetails(${inlineJs(item.id)})">
              ${escapeHtml(item.title)}
            </h3>

            <div class="product-card-footer pt-2">
              <div class="flex items-baseline gap-2 mb-2">
                <span class="product-card-price">KES ${Number(item.basePrice).toLocaleString()}</span>
              </div>

              <button onclick="addToCart(${inlineJs(item.id)}, ${inlineJs(item.title)}, ${Number(item.basePrice) || 0}, ${inlineJs(primaryImage)}, ${inlineJs(item.itemType)})" class="product-card-add w-full ${
                isService ? "product-cart-service" : ""
              } flex items-center justify-center gap-2">
                <i data-lucide="${isService ? "calendar" : "shopping-bag"}" class="w-4 h-4"></i>
                <span>${isService ? "Book Session" : "Add to Cart"}</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
    renderIcons();
  }
}

function resetFilters() {
  state.activeFilters = {};
  state.selectedCategory = "";
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.value = "";
  loadCategories();
  loadDynamicFilters();
  loadItems();
}
