// 8. Load Categories & Subcategories Tree
async function loadCategories() {
  const res = await apiFetch("/api/categories");
  const container = document.getElementById("category-pills");
  if (!container) return;

  if (res.ok && res.data.success) {
    state.categories = res.data.data;
    let html = `
      <button onclick="selectCategory('')" class="category-pill ${
        state.selectedCategory === ""
          ? "category-pill-active"
          : "category-pill-inactive"
      }">All Categories</button>
    `;

    for (const cat of state.categories) {
      const isSelected = state.selectedCategory === cat.slug;
      html += `
        <button onclick="selectCategory('${escapeHtml(cat.slug)}')" class="category-pill ${
        isSelected
          ? "category-pill-active"
          : "category-pill-inactive"
      }">
          ${escapeHtml(cat.name)}
        </button>
      `;

      // Render nested subcategories
      if (cat.children && cat.children.length > 0) {
        for (const sub of cat.children) {
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
  }
}

function selectCategory(slug) {
  state.selectedCategory = slug;
  loadCategories();
  loadDynamicFilters();
  loadItems();
}

// 9. Load Dynamic Faceted Filters
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

  loadItems();
}

// 10. Load Items (Products & Services)
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

function updateWishlistButton() {
  const count = document.getElementById("wishlist-count");
  if (count) {
    count.textContent = String(state.wishlist.length);
    count.classList.toggle("hidden", state.wishlist.length === 0);
  }
  const mobileCount = document.getElementById("mobile-wishlist-count");
  if (mobileCount) {
    mobileCount.textContent = String(state.wishlist.length);
    mobileCount.classList.toggle("hidden", state.wishlist.length === 0);
  }
  const toggle = document.getElementById("wishlist-toggle");
  if (toggle) {
    toggle.classList.toggle("hidden", !state.activeTenant);
    toggle.setAttribute("aria-pressed", String(state.showWishlistOnly));
    toggle.classList.toggle("is-active", state.showWishlistOnly);
    const label = toggle.querySelector("[data-wishlist-label]");
    if (label) label.textContent = state.showWishlistOnly ? "All Products" : "Wishlist";
  }
  const mobileToggle = document.getElementById("mobile-wishlist-toggle");
  if (mobileToggle) {
    mobileToggle.classList.toggle("hidden", !state.activeTenant);
    mobileToggle.classList.toggle("flex", Boolean(state.activeTenant));
    mobileToggle.setAttribute("aria-pressed", String(state.showWishlistOnly));
    const label = mobileToggle.querySelector("[data-wishlist-label]");
    if (label) label.textContent = state.showWishlistOnly ? "Shop" : "Saved";
  }
  document.getElementById("customer-profile-toggle")?.classList.toggle("hidden", !state.activeTenant);
  document.getElementById("mobile-customer-profile-toggle")?.classList.toggle("hidden", !state.activeTenant);
  const profileOrderCount = document.getElementById("customer-order-count");
  const profileWishlistCount = document.getElementById("customer-wishlist-count");
  if (profileOrderCount) profileOrderCount.textContent = String(state.myOrders.length);
  if (profileWishlistCount) profileWishlistCount.textContent = String(state.wishlist.length);
  renderIcons();
}

function toggleWishlistView(show = !state.showWishlistOnly) {
  void maybePromptGuestSignIn("wishlist");
  state.showWishlistOnly = show;
  state.selectedCategory = "";
  state.activeFilters = {};
  const search = document.getElementById("search-input");
  const mobileSearch = document.getElementById("mobile-search-input");
  if (search) search.value = "";
  if (mobileSearch) mobileSearch.value = "";
  updateWishlistButton();
  loadCategories();
  loadItems();
}

function toggleWishlist(itemId, button) {
  void maybePromptGuestSignIn("wishlist");
  const index = state.wishlist.indexOf(itemId);
  if (index >= 0) {
    state.wishlist.splice(index, 1);
  } else {
    state.wishlist.push(itemId);
  }
  localStorage.setItem(`store254_wishlist_${state.activeTenantSlug || "platform"}`, JSON.stringify(state.wishlist));
  const isWishlisted = state.wishlist.includes(itemId);
  document.querySelectorAll(`[data-wishlist-item="${CSS.escape(itemId)}"]`).forEach((wishlistButton) => {
    wishlistButton.classList.toggle("is-wishlisted", isWishlisted);
    wishlistButton.setAttribute("aria-pressed", String(isWishlisted));
    wishlistButton.setAttribute("aria-label", `${isWishlisted ? "Remove from" : "Add to"} wishlist`);
  });
  updateWishlistButton();
  showToast(isWishlisted ? "Added to your wishlist." : "Removed from your wishlist.", "info");
  if (state.showWishlistOnly) loadItems();
}

async function initializeGoogleSignIn(containerId = "google-signin-button") {
  const container = document.getElementById(containerId);
  if (!container || !state.activeTenant) return;
  const config = await apiFetch("/api/auth/google/config");
  if (!config.ok || !config.data?.success) {
    renderGoogleSignInUnavailable(container, config.data?.error?.message || "Google sign-in is currently unavailable.");
    return;
  }
  if (!config.data.data?.enabled || !config.data.data?.loginUrl) {
    renderGoogleSignInUnavailable(container, "Google sign-in is not set up for this store yet.");
    return;
  }

  let loginUrl;
  try {
    loginUrl = new URL(config.data.data.loginUrl);
    if (loginUrl.protocol !== "https:" || loginUrl.hostname !== "store254.co.ke" ||
        loginUrl.pathname !== "/auth/google/login") {
      throw new Error("Unexpected centralized sign-in URL.");
    }
  } catch (error) {
    console.error("[Google sign-in] Invalid centralized login URL:", error);
    renderGoogleSignInUnavailable(container, "Google sign-in is currently unavailable.");
    return;
  }

  loginUrl.searchParams.set("return_to", window.location.href);
  container.replaceChildren();
  const link = document.createElement("a");
  link.href = loginUrl.toString();
  link.className = "customer-google-link";
  link.innerHTML = '<span class="customer-google-g" aria-hidden="true">G</span><span>Continue with Google</span>';
  container.appendChild(link);
}

function renderGoogleSignInUnavailable(container, message) {
  container.replaceChildren();
  const status = document.createElement("p");
  status.className = "text-xs text-slate-600";
  status.textContent = message;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "customer-google-retry mt-2 text-xs font-semibold hover:underline";
  retry.textContent = "Try again";
  retry.addEventListener("click", () => initializeGoogleSignIn(container.id));
  container.append(status, retry);
}

async function maybePromptGuestSignIn(context) {
  if (!state.activeTenant || state.customerUser?.role === "CUSTOMER") return;
  const promptKey = `store254_signin_prompt_${state.activeTenantSlug || "store"}`;
  if (sessionStorage.getItem(promptKey)) return;

  const modal = document.getElementById("shopping-signin-modal");
  if (!modal) return;
  const copy = document.getElementById("shopping-signin-copy");
  if (copy) {
    copy.textContent = context === "wishlist"
      ? "Sign in with Google to keep your wishlist with your account. You can continue browsing as a guest."
      : "Sign in with Google to keep your cart and orders with your account. You can continue shopping as a guest.";
  }
  sessionStorage.setItem(promptKey, "shown");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  renderIcons();
  void initializeGoogleSignIn("shopping-google-signin");

  const profile = await apiFetch("/api/auth/me");
  if (profile.ok && profile.data?.success && profile.data.data?.role === "CUSTOMER") {
    persistCustomerSession(profile.data.data, state.customerToken || null);
    renderCustomerAuth();
    closeShoppingSignInPrompt();
  }
}

function closeShoppingSignInPrompt() {
  const modal = document.getElementById("shopping-signin-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

async function signOutCustomer() {
  const result = await apiFetch("/api/auth/logout", { method: "POST" });
  if (!result.ok) {
    showToast(result.data?.error?.message || "Could not sign out. Please try again.", "error");
    return;
  }
  clearCustomerSession();
  state.myOrders = [];
  showToast("You have been signed out.", "info");
  await loadMyOrders();
}

function renderCustomerAuth() {
  const section = document.getElementById("customer-auth-section");
  const signedOut = document.getElementById("customer-signed-out");
  const signedIn = document.getElementById("customer-signed-in");
  if (!section || !signedOut || !signedIn) return;

  section.classList.toggle("hidden", !state.activeTenant);
  const isSignedIn = Boolean(state.customerUser);
  signedOut.classList.toggle("hidden", isSignedIn);
  signedIn.classList.toggle("hidden", !isSignedIn);
  document.getElementById("customer-orders-section")?.classList.toggle("hidden", !isSignedIn);
  section.classList.toggle("customer-auth-guest", !isSignedIn);
  const signInTitle = document.getElementById("customer-signin-title");
  if (signInTitle) signInTitle.textContent = `Sign in to ${state.activeTenant?.name || "your store"}`;
  if (!isSignedIn) return;

  document.getElementById("customer-account-name").textContent =
    state.customerUser.fullName || "Store customer";
  document.getElementById("customer-account-email").textContent =
    state.customerUser.email || "";
  const avatar = document.getElementById("customer-avatar");
  if (state.customerUser.avatarUrl) {
    avatar.src = state.customerUser.avatarUrl;
    avatar.classList.remove("hidden");
    document.getElementById("customer-avatar-fallback")?.classList.add("hidden");
  } else {
    avatar.removeAttribute("src");
    avatar.classList.add("hidden");
    document.getElementById("customer-avatar-fallback")?.classList.remove("hidden");
  }
  const orderCount = document.getElementById("customer-order-count");
  const wishlistCount = document.getElementById("customer-wishlist-count");
  if (orderCount) orderCount.textContent = String(state.myOrders.length);
  if (wishlistCount) wishlistCount.textContent = String(state.wishlist.length);
  const memberSince = document.getElementById("customer-member-since");
  if (memberSince) {
    const createdAt = state.customerUser.createdAt ? new Date(state.customerUser.createdAt) : null;
    memberSince.textContent = createdAt && !Number.isNaN(createdAt.getTime())
      ? `Store member since ${createdAt.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`
      : "";
  }
}

// 11. View Item Details & Load Reviews
function setItemModalImage(index) {
  const image = document.getElementById("item-modal-image");
  const count = document.getElementById("item-modal-image-count");
  const thumbnails = document.getElementById("item-modal-image-thumbnails");
  const images = state.currentItemImages;
  if (!image || images.length === 0) return;

  state.currentItemImageIndex = (index + images.length) % images.length;
  image.src = images[state.currentItemImageIndex];
  image.alt = `${document.getElementById("item-modal-title").textContent} photo ${state.currentItemImageIndex + 1}`;
  count.textContent = `${state.currentItemImageIndex + 1} / ${images.length}`;
  image.onload = () => {
    const stage = document.getElementById("item-modal-gallery-stage");
    if (image.naturalWidth && image.naturalHeight) {
      stage.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
    }
  };

  for (const [thumbnailIndex, thumbnail] of [...thumbnails.children].entries()) {
    thumbnail.classList.toggle("is-active", thumbnailIndex === state.currentItemImageIndex);
    thumbnail.setAttribute("aria-pressed", String(thumbnailIndex === state.currentItemImageIndex));
  }
}

function changeItemModalImage(offset) {
  setItemModalImage(state.currentItemImageIndex + offset);
}

function renderItemImageGallery(images, title) {
  const thumbnailContainer = document.getElementById("item-modal-image-thumbnails");
  const count = document.getElementById("item-modal-image-count");
  const previous = document.getElementById("item-modal-image-prev");
  const next = document.getElementById("item-modal-image-next");

  state.currentItemImages = images.slice(0, 5);
  state.currentItemImageIndex = 0;
  document.getElementById("item-modal-gallery-stage").style.aspectRatio = "4 / 3";
  previous.onclick = () => changeItemModalImage(-1);
  next.onclick = () => changeItemModalImage(1);
  const hasMultipleImages = state.currentItemImages.length > 1;
  thumbnailContainer.replaceChildren();
  thumbnailContainer.classList.toggle("hidden", !hasMultipleImages);
  count.classList.toggle("hidden", !hasMultipleImages);
  previous.classList.toggle("hidden", !hasMultipleImages);
  next.classList.toggle("hidden", !hasMultipleImages);

  if (hasMultipleImages) {
    state.currentItemImages.forEach((src, index) => {
      const thumbnail = document.createElement("button");
      thumbnail.type = "button";
      thumbnail.className = "item-modal-image-thumbnail";
      thumbnail.setAttribute("aria-label", `Show photo ${index + 1} of ${title}`);
      thumbnail.setAttribute("aria-pressed", "false");

      const thumbnailImage = document.createElement("img");
      thumbnailImage.src = src;
      thumbnailImage.alt = "";
      thumbnailImage.loading = "lazy";
      thumbnail.appendChild(thumbnailImage);
      thumbnail.addEventListener("click", () => setItemModalImage(index));
      thumbnailContainer.appendChild(thumbnail);
    });
  }

  setItemModalImage(0);
}

async function viewItemDetails(itemId) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;

  state.currentItemId = itemId;

  const isService = item.itemType === "SERVICE";
  const attrs = item.attributes || {};
  const fallbackImage =
    item.images && item.images.length > 0
      ? item.images[0]
      : isService
      ? "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80"
      : "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80";
  const images = item.images?.length ? item.images : [fallbackImage];

  document.getElementById("item-modal-title").textContent = item.title;
  renderItemImageGallery(images, item.title);
  document.getElementById("item-modal-price").textContent = `KES ${Number(item.basePrice).toLocaleString()}`;
  document.getElementById("item-modal-description").textContent = item.description || "Available from this store.";

  const comparePriceEl = document.getElementById("item-modal-compare-price");
  if (item.compareAtPrice && item.compareAtPrice > item.basePrice) {
    comparePriceEl.textContent = `KES ${Number(item.compareAtPrice).toLocaleString()}`;
    comparePriceEl.classList.remove("hidden");
  } else {
    comparePriceEl.classList.add("hidden");
  }

  // Badges
  const badgesEl = document.getElementById("item-modal-badges");
  badgesEl.innerHTML = `
    <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
      isService ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
    }">${isService ? "Service" : "Product"}</span>
    ${attrs.brand ? `<span class="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">${escapeHtml(attrs.brand)}</span>` : ""}
  `;

  // Attributes table
  const attrsEl = document.getElementById("item-modal-attributes");
  let attrsHtml = "";
  for (const [k, v] of Object.entries(attrs)) {
    if (v) {
      const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      attrsHtml += `
        <div class="bg-slate-50 p-2 rounded-lg border border-slate-100">
          <span class="text-[10px] text-slate-400 font-semibold block">${escapeHtml(label)}</span>
          <span class="text-xs font-bold text-slate-800">${escapeHtml(v)}</span>
        </div>
      `;
    }
  }
  attrsEl.innerHTML = attrsHtml;

  // Add to Cart Button
  const btnCart = document.getElementById("item-modal-btn-cart");
  btnCart.innerHTML = `<i data-lucide="${isService ? "calendar" : "shopping-bag"}" class="w-4 h-4"></i> <span>${
    isService ? "Book Appointment" : "Add to Cart"
  }</span>`;
  btnCart.className = `w-full py-3 ${
    isService ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700"
  } text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2`;
  btnCart.onclick = () => {
    addToCart(item.id, item.title, item.basePrice, state.currentItemImages[state.currentItemImageIndex], item.itemType);
    toggleDrawer("item-details-modal", false);
  };

  // Reset Review Form
  toggleReviewForm(false);

  // Load Reviews
  await loadItemReviews(itemId);

  toggleDrawer("item-details-modal", true);
  renderIcons();
}

// Load Reviews from API
async function loadItemReviews(itemId) {
  const container = document.getElementById("item-modal-reviews-list");
  const summaryEl = document.getElementById("item-modal-rating-summary");
  if (!container) return;

  container.innerHTML = `<div class="text-xs text-slate-400 py-3">Loading customer reviews...</div>`;

  const res = await apiFetch(`/api/items/${itemId}/reviews`);
  if (res.ok && res.data.success) {
    const data = res.data.data;
    const avg = data.averageRating || 5;
    const count = data.totalReviews || 0;

    if (summaryEl) {
      summaryEl.textContent = `Rating: ${avg} / 5 (${count} ${count === 1 ? "review" : "reviews"})`;
    }

    if (!data.reviews || data.reviews.length === 0) {
      container.innerHTML = `
        <div class="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
          <p class="text-xs text-slate-500">No customer reviews yet. Be the first to share your experience!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = data.reviews.map((r) => {
      const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "";
      return `
        <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-2">
          <span class="font-semibold text-slate-900">${escapeHtml(r.customerName)}</span>
            </div>
            <span class="text-slate-400 text-[10px]">${dateStr}</span>
          </div>
          <div class="flex items-center gap-1 text-amber-500 mb-1">
            ${Array.from({ length: r.rating || 5 }).map(() => `<i data-lucide="star" class="w-3 h-3 fill-amber-400 text-amber-400"></i>`).join("")}
          </div>
          ${r.comment ? `<p class="text-slate-600 leading-relaxed">${escapeHtml(r.comment)}</p>` : ""}
        </div>
      `;
    }).join("");
    renderIcons();
  }
}

function toggleReviewForm(show) {
  const form = document.getElementById("item-modal-review-form");
  if (!form) return;
  if (show === undefined) {
    form.classList.toggle("hidden");
  } else if (show) {
    form.classList.remove("hidden");
  } else {
    form.classList.add("hidden");
  }
}

async function handleReviewSubmit(e) {
  e.preventDefault();
  if (!state.currentItemId) return;

  const btn = document.getElementById("btn-submit-review");
  btn.disabled = true;
  btn.textContent = "Submitting...";

  const customerName = document.getElementById("review-input-name").value.trim();
  const rating = parseInt(document.getElementById("review-input-rating").value, 10);
  const comment = document.getElementById("review-input-comment").value.trim();

  const res = await apiFetch(`/api/items/${state.currentItemId}/reviews`, {
    method: "POST",
    body: JSON.stringify({
      customerName,
      rating,
      comment,
    }),
  });

  btn.disabled = false;
  btn.textContent = "Submit Review";

  if (res.ok && res.data.success) {
    showToast("Thank you! Your review has been published.");
    document.getElementById("review-input-comment").value = "";
    toggleReviewForm(false);
    await loadItemReviews(state.currentItemId);
  } else {
    showToast(res.data.error?.message || "Failed to submit review", "error");
  }
}

