/**
 * Store254 Web Application Client Engine
 * Connects directly to Hono Backend API on Cloudflare Workers + Cloudflare D1
 */

// 1. API Configuration
const API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8787"
    : "https://store254-backend.kelvinkamauofficial254.workers.dev";

// Helper to safely render Lucide icons
function renderIcons() {
  if (typeof lucide !== "undefined" && lucide.createIcons) {
    lucide.createIcons();
  }
}

// 2. Subdomain & Tenant Detection
function detectInitialTenantSlug() {
  const host = window.location.hostname.toLowerCase();
  const urlParams = new URLSearchParams(window.location.search);
  const paramStore = urlParams.get("store") || urlParams.get("subdomain");
  if (paramStore) return paramStore.toLowerCase().trim();

  // If host is a subdomain on store254.co.ke (e.g. alicebabycare.store254.co.ke)
  if (host.includes("store254.co.ke")) {
    const parts = host.split(".");
    // e.g. ["alicebabycare", "store254", "co", "ke"] -> length 4
    if (parts.length >= 3 && parts[0] !== "store254" && parts[0] !== "www") {
      return parts[0];
    }
    return ""; // Root store254.co.ke platform marketplace
  }

  // Check URL hash fallback (e.g. #store=alicebabycare)
  if (window.location.hash && window.location.hash.startsWith("#store=")) {
    return window.location.hash.replace("#store=", "").trim();
  }

  // On root store254.co.ke or main pages.dev, always default to root marketplace ("")
  return "";
}

// 3. Global Reactive State
const state = {
  activeTenantSlug: detectInitialTenantSlug(),
  activeTenant: null,
  currentItemId: null,
  categories: [],
  selectedCategory: "",
  activeFilters: {},
  priceRange: { min: 0, max: 200000 },
  selectedPriceRange: { min: 0, max: 200000 },
  facets: [],
  items: [],
  cart: JSON.parse(localStorage.getItem("store254_cart") || "[]"),
  appliedCoupon: null,
  customerToken: localStorage.getItem("store254_customer_token") || null,
  customerUser: JSON.parse(localStorage.getItem("store254_customer_user") || "null"),
  merchantToken: localStorage.getItem("store254_merchant_token") || null,
  superAdminKey: localStorage.getItem("store254_admin_key") || "store254-superadmin-secret-key-change-in-prod",
  myOrders: [],
  activePollInterval: null,
};

// 4. Helper API Fetcher with Tenant Header Injection
async function apiFetch(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  // Inject tenant scope header if targeting an active store
  if (state.activeTenantSlug && !endpoint.startsWith("/api/platform")) {
    headers["X-Tenant-Slug"] = state.activeTenantSlug;
  }

  // Inject auth token if available
  if (options.asMerchant && state.merchantToken) {
    headers["Authorization"] = `Bearer ${state.merchantToken}`;
  } else if (state.customerToken) {
    headers["Authorization"] = `Bearer ${state.customerToken}`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    const data = await res.json();
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err);
    return { ok: false, status: 0, data: { success: false, error: { message: "Network connection failed" } } };
  }
}

// 5. Toast Notifications
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  const bgClass =
    type === "success"
      ? "bg-emerald-600 text-white"
      : type === "error"
      ? "bg-rose-600 text-white"
      : "bg-slate-800 text-white";

  const iconName = type === "success" ? "check-circle-2" : type === "error" ? "alert-circle" : "info";

  toast.className = `flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold transition-all transform duration-300 ease-out ${bgClass}`;
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  renderIcons();

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-8px)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// 6. Store / Tenant Loading
async function loadStoreProfile() {
  const storeInfoBanner = document.getElementById("store-info-banner");
  const storeSelector = document.getElementById("store-selector");
  if (storeSelector) storeSelector.value = state.activeTenantSlug;

  if (!state.activeTenantSlug) {
    // Root Platform Mode (store254.co.ke)
    state.activeTenant = null;
    if (storeInfoBanner) storeInfoBanner.classList.add("hidden");
    document.getElementById("platform-hero")?.classList.remove("hidden");
    document.getElementById("storefront-view")?.classList.add("hidden");
    await loadPlatformStores();
    renderIcons();
    return;
  }

  // Subdomain Storefront Mode (e.g. alicebabycare.store254.co.ke)
  document.getElementById("platform-hero")?.classList.add("hidden");
  document.getElementById("storefront-view")?.classList.remove("hidden");

  const res = await apiFetch("/api/store");
  if (res.ok && res.data.success) {
    state.activeTenant = res.data.data;
    renderStoreBanner();
    await Promise.all([loadCategories(), loadDynamicFilters(), loadItems()]);
  } else {
    showToast(`Store "${state.activeTenantSlug}" not found or pending approval.`, "error");
    // Fallback to platform mode
    state.activeTenant = null;
    document.getElementById("platform-hero")?.classList.remove("hidden");
    document.getElementById("storefront-view")?.classList.add("hidden");
    await loadPlatformStores();
  }

  renderIcons();
}

// 7. Render Store Banner
function renderStoreBanner() {
  const banner = document.getElementById("store-info-banner");
  if (!banner || !state.activeTenant) return;

  banner.classList.remove("hidden");
  const settings = state.activeTenant.settings || {};

  document.getElementById("banner-store-name").textContent = state.activeTenant.name;
  document.getElementById("banner-store-subdomain").textContent = `${state.activeTenant.subdomain}.store254.co.ke`;
  document.getElementById("banner-store-desc").textContent =
    settings.description || `Welcome to ${state.activeTenant.name} on Store254`;

  const phoneEl = document.getElementById("banner-store-phone");
  const phoneText = document.getElementById("banner-store-phone-text");
  if (settings.phone && phoneEl && phoneText) {
    phoneText.textContent = settings.phone;
    phoneEl.classList.remove("hidden");
  } else if (phoneEl) {
    phoneEl.classList.add("hidden");
  }

  renderIcons();
}

// 8. Load Categories & Subcategories Tree
async function loadCategories() {
  const res = await apiFetch("/api/categories");
  const container = document.getElementById("category-pills");
  if (!container) return;

  if (res.ok && res.data.success) {
    state.categories = res.data.data;
    let html = `
      <button onclick="selectCategory('')" class="px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
        state.selectedCategory === ""
          ? "bg-emerald-600 text-white shadow-sm"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }">All Categories</button>
    `;

    for (const cat of state.categories) {
      const isSelected = state.selectedCategory === cat.slug;
      html += `
        <button onclick="selectCategory('${cat.slug}')" class="px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
        isSelected
          ? "bg-emerald-600 text-white shadow-sm"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }">
          ${cat.name}
        </button>
      `;

      // Render nested subcategories
      if (cat.children && cat.children.length > 0) {
        for (const sub of cat.children) {
          const isSubSelected = state.selectedCategory === sub.slug;
          html += `
            <button onclick="selectCategory('${sub.slug}')" class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            isSubSelected
              ? "bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
          }">
              ↳ ${sub.name}
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
      const minEl = document.getElementById("price-filter-min");
      const maxEl = document.getElementById("price-filter-max");
      const minLabel = document.getElementById("price-label-min");
      const maxLabel = document.getElementById("price-label-max");

      if (minEl && maxEl) {
        minEl.min = data.priceRange.min;
        minEl.max = data.priceRange.max;
        maxEl.min = data.priceRange.min;
        maxEl.max = data.priceRange.max;

        if (state.selectedPriceRange.max === 200000) {
          maxEl.value = data.priceRange.max;
          minEl.value = data.priceRange.min;
        }

        minLabel.textContent = `KES ${Number(minEl.value).toLocaleString()}`;
        maxLabel.textContent = `KES ${Number(maxEl.value).toLocaleString()}`;
      }
    }

    // Render Facet Checkboxes
    let html = "";
    for (const facet of state.facets) {
      if (!facet.options || facet.options.length === 0) continue;

      html += `
        <div class="mb-5 pb-5 border-b border-slate-100">
          <label class="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
            ${facet.name} ${facet.unit ? `<span class="text-slate-400 font-normal">(${facet.unit})</span>` : ""}
          </label>
          <div class="space-y-1.5 max-h-40 overflow-y-auto">
      `;

      for (const opt of facet.options) {
        const isChecked = state.activeFilters[facet.code]?.includes(opt.value);
        html += `
          <label class="flex items-center justify-between text-xs text-slate-700 hover:text-slate-900 cursor-pointer py-0.5">
            <div class="flex items-center gap-2">
              <input type="checkbox" onchange="toggleFilter('${facet.code}', '${opt.value}', this.checked)" ${
          isChecked ? "checked" : ""
        } class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5">
              <span>${opt.value}</span>
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
  if (maxPriceEl && maxPriceEl.value) {
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
    if (countBadge) countBadge.textContent = `${state.items.length} items`;

    if (state.items.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-20 text-center">
          <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <i data-lucide="package-search" class="w-6 h-6"></i>
          </div>
          <h3 class="text-base font-bold text-slate-800">No items match your filters</h3>
          <p class="text-xs text-slate-500 mt-1">Try resetting your filters or search keywords.</p>
          <button onclick="resetFilters()" class="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 mx-auto">
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            <span>Reset Filters</span>
          </button>
        </div>
      `;
      renderIcons();
      return;
    }

    let html = "";
    for (const item of state.items) {
      const isService = item.itemType === "SERVICE";
      const attrs = item.attributes || {};
      const brand = attrs.brand || "";
      const primaryImage =
        item.images && item.images.length > 0
          ? item.images[0]
          : isService
          ? "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80"
          : "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80";

      html += `
        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col group">
          <div class="relative bg-slate-50 h-52 overflow-hidden flex items-center justify-center p-4">
            <img src="${primaryImage}" alt="${item.title}" class="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300">
            ${
              isService
                ? `<span class="absolute top-3 left-3 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">Service</span>`
                : item.compareAtPrice && item.compareAtPrice > item.basePrice
                ? `<span class="absolute top-3 left-3 bg-rose-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">Sale</span>`
                : ""
            }
            ${
              brand
                ? `<span class="absolute top-3 right-3 bg-white/90 backdrop-blur text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded shadow-sm">${brand}</span>`
                : ""
            }
          </div>

          <div class="p-5 flex-1 flex flex-col justify-between">
            <div>
              <h3 class="font-bold text-slate-900 text-sm line-clamp-2 mb-2 group-hover:text-emerald-600 transition-colors">
                ${item.title}
              </h3>

              <!-- Dynamic Attribute Badges -->
              <div class="flex flex-wrap gap-1.5 mb-3">
                ${attrs.screen_size ? `<span class="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">${attrs.screen_size}" Screen</span>` : ""}
                ${attrs.duration_minutes ? `<span class="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> ${attrs.duration_minutes} Mins</span>` : ""}
                ${attrs.warranty ? `<span class="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded flex items-center gap-1"><i data-lucide="shield" class="w-3 h-3"></i> ${attrs.warranty}</span>` : ""}
              </div>
            </div>

            <div>
              <div class="flex items-baseline gap-2 mb-4">
                <span class="text-lg font-black text-slate-900">KES ${Number(item.basePrice).toLocaleString()}</span>
                ${
                  item.compareAtPrice && item.compareAtPrice > item.basePrice
                    ? `<span class="text-xs text-slate-400 line-through">KES ${Number(item.compareAtPrice).toLocaleString()}</span>`
                    : ""
                }
              </div>

              <div class="flex gap-2">
                <button onclick="viewItemDetails('${item.id}')" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5">
                  <i data-lucide="info" class="w-3.5 h-3.5"></i>
                  <span>Details</span>
                </button>
                <button onclick="addToCart('${item.id}', '${item.title.replace(/'/g, "\\'")}', ${item.basePrice}, '${primaryImage}', '${item.itemType}')" class="flex-1 py-2.5 ${
                  isService ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700"
                } text-white text-xs font-bold rounded-xl shadow-sm transition-all transform active:scale-95 flex items-center justify-center gap-1.5">
                  <i data-lucide="${isService ? "calendar" : "shopping-bag"}" class="w-3.5 h-3.5"></i>
                  <span>${isService ? "Book" : "Add"}</span>
                </button>
              </div>
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

// 11. View Item Details & Load Reviews
async function viewItemDetails(itemId) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;

  state.currentItemId = itemId;

  const isService = item.itemType === "SERVICE";
  const attrs = item.attributes || {};
  const primaryImage =
    item.images && item.images.length > 0
      ? item.images[0]
      : isService
      ? "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80"
      : "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80";

  document.getElementById("item-modal-title").textContent = item.title;
  document.getElementById("item-modal-image").src = primaryImage;
  document.getElementById("item-modal-price").textContent = `KES ${Number(item.basePrice).toLocaleString()}`;
  document.getElementById("item-modal-description").textContent = item.description || "High quality verified offering available on Store254.";

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
    ${attrs.brand ? `<span class="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">${attrs.brand}</span>` : ""}
  `;

  // Attributes table
  const attrsEl = document.getElementById("item-modal-attributes");
  let attrsHtml = "";
  for (const [k, v] of Object.entries(attrs)) {
    if (v) {
      const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      attrsHtml += `
        <div class="bg-slate-50 p-2 rounded-lg border border-slate-100">
          <span class="text-[10px] text-slate-400 font-semibold block">${label}</span>
          <span class="text-xs font-bold text-slate-800">${v}</span>
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
    addToCart(item.id, item.title, item.basePrice, primaryImage, item.itemType);
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
              <span class="font-bold text-slate-900">${r.customerName}</span>
              ${r.isVerifiedBuyer ? `<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Verified Buyer</span>` : ""}
            </div>
            <span class="text-slate-400 text-[10px]">${dateStr}</span>
          </div>
          <div class="flex items-center gap-1 text-amber-500 mb-1">
            ${Array.from({ length: r.rating || 5 }).map(() => `<i data-lucide="star" class="w-3 h-3 fill-amber-400 text-amber-400"></i>`).join("")}
          </div>
          ${r.comment ? `<p class="text-slate-600 leading-relaxed">${r.comment}</p>` : ""}
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

// 12. Cart Management
function addToCart(id, title, price, image, itemType = "PHYSICAL") {
  const existing = state.cart.find((i) => i.itemId === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      itemId: id,
      title,
      price,
      image,
      itemType,
      quantity: 1,
    });
  }

  saveCart();
  updateCartBadge();
  showToast(`Added "${title}" to your cart!`);
}

function updateCartQuantity(index, delta) {
  state.cart[index].quantity += delta;
  if (state.cart[index].quantity <= 0) {
    state.cart.splice(index, 1);
  }
  saveCart();
  renderCartDrawer();
  updateCartBadge();
}

function saveCart() {
  localStorage.setItem("store254_cart", JSON.stringify(state.cart));
}

function updateCartBadge() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById("cart-count-badge");
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle("hidden", count === 0);
  }
}

// 13. Render Cart & Checkout Drawer
function renderCartDrawer() {
  const container = document.getElementById("cart-items-container");
  const subtotalEl = document.getElementById("cart-subtotal");
  const discountRow = document.getElementById("cart-discount-row");
  const discountEl = document.getElementById("cart-discount");
  const totalEl = document.getElementById("cart-total");
  const serviceBookingSection = document.getElementById("service-booking-section");

  if (!container) return;

  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="py-16 text-center text-slate-400">
        <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-300">
          <i data-lucide="shopping-bag" class="w-6 h-6"></i>
        </div>
        <p class="text-sm font-semibold text-slate-700">Your cart is empty</p>
        <p class="text-xs text-slate-500 mt-1">Explore our catalog to add items!</p>
      </div>
    `;
    if (subtotalEl) subtotalEl.textContent = "KES 0";
    if (discountRow) discountRow.classList.add("hidden");
    if (totalEl) totalEl.textContent = "KES 0";
    if (serviceBookingSection) serviceBookingSection.classList.add("hidden");
    renderIcons();
    return;
  }

  // Check if any cart item is a SERVICE
  const hasService = state.cart.some((i) => i.itemType === "SERVICE");
  if (serviceBookingSection) {
    serviceBookingSection.classList.toggle("hidden", !hasService);
  }

  let subtotal = 0;
  let html = "";

  state.cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;

    html += `
      <div class="flex items-center gap-3 py-3 border-b border-slate-100 text-xs">
        <img src="${item.image}" alt="${item.title}" class="w-14 h-14 object-contain rounded-lg bg-slate-50 p-1 border border-slate-100">
        <div class="flex-1 min-w-0">
          <h4 class="font-bold text-slate-900 truncate">${item.title}</h4>
          <span class="text-slate-500 font-mono">KES ${item.price.toLocaleString()}</span>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="updateCartQuantity(${index}, -1)" class="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700">-</button>
          <span class="font-bold text-slate-900 w-4 text-center">${item.quantity}</span>
          <button onclick="updateCartQuantity(${index}, 1)" class="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700">+</button>
        </div>
        <span class="font-bold text-slate-900 min-w-[70px] text-right">KES ${itemTotal.toLocaleString()}</span>
      </div>
    `;
  });

  container.innerHTML = html;

  let discountAmount = 0;
  if (state.appliedCoupon) {
    if (state.appliedCoupon.type === "PERCENTAGE") {
      discountAmount = Math.round((subtotal * state.appliedCoupon.value) / 100);
    } else {
      discountAmount = state.appliedCoupon.value;
    }
  }

  const finalTotal = Math.max(1, subtotal - discountAmount);

  if (subtotalEl) subtotalEl.textContent = `KES ${subtotal.toLocaleString()}`;
  if (discountRow) {
    discountRow.classList.toggle("hidden", discountAmount === 0);
    if (discountEl) discountEl.textContent = `- KES ${discountAmount.toLocaleString()}`;
  }
  if (totalEl) totalEl.textContent = `KES ${finalTotal.toLocaleString()}`;
  renderIcons();
}

// 14. Apply Promotion / Coupon
async function applyCoupon() {
  const codeInput = document.getElementById("coupon-code-input");
  if (!codeInput) return;
  const code = codeInput.value.trim().toUpperCase();

  if (!code) {
    showToast("Please enter a promotion code", "error");
    return;
  }

  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const res = await apiFetch("/api/offers/validate-coupon", {
    method: "POST",
    body: JSON.stringify({
      code,
      cartTotal: subtotal,
      cartItems: state.cart.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
    }),
  });

  if (res.ok && res.data.success) {
    state.appliedCoupon = res.data.data;
    showToast(`Coupon "${code}" applied: ${res.data.data.discountDescription}`);
    renderCartDrawer();
  } else {
    showToast(res.data.error?.message || "Invalid or expired coupon", "error");
    state.appliedCoupon = null;
    renderCartDrawer();
  }
}

// 15. Initiate Checkout with M-Pesa STK Push
async function initiateMpesaCheckout() {
  const name = document.getElementById("checkout-name").value.trim();
  const email = document.getElementById("checkout-email").value.trim();
  const phone = document.getElementById("checkout-phone").value.trim();
  const btn = document.getElementById("btn-pay-mpesa");

  if (!name || !email || !phone) {
    showToast("Please fill in your name, email, and phone number", "error");
    return;
  }

  if (state.cart.length === 0) {
    showToast("Your cart is empty", "error");
    return;
  }

  // Booking details for services
  let bookingDetails = undefined;
  const hasService = state.cart.some((i) => i.itemType === "SERVICE");
  if (hasService) {
    const bookingDate = document.getElementById("booking-date")?.value;
    const timeSlot = document.getElementById("booking-time")?.value;
    bookingDetails = {
      bookingDate: bookingDate || new Date().toISOString().split("T")[0],
      timeSlot: timeSlot || "Morning (9am - 12pm)",
    };
  }

  btn.disabled = true;
  btn.innerHTML = `<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full spin-slow mr-2"></div> Initiating STK Push...`;

  const payload = {
    customerName: name,
    customerEmail: email,
    customerPhone: phone,
    items: state.cart.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
    couponCode: state.appliedCoupon?.code,
    bookingDetails,
  };

  const res = await apiFetch("/api/orders/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  btn.disabled = false;
  btn.innerHTML = `<i data-lucide="smartphone" class="w-4 h-4 mr-2"></i> Pay with M-Pesa STK Push`;
  renderIcons();

  if (res.ok && res.data.success) {
    const orderData = res.data.data;

    // Clear cart on successful order creation
    state.cart = [];
    saveCart();
    updateCartBadge();
    toggleDrawer("cart-drawer", false);

    // Open live PIN prompt modal
    openMpesaPinModal(
      orderData.checkoutRequestId,
      orderData.orderNumber,
      orderData.totalAmount,
      phone
    );
  } else {
    showToast(res.data.error?.message || "Checkout failed. Please check M-Pesa configuration.", "error");
  }
}

// 16. Real-Time M-Pesa PIN Prompt & Status Polling
function openMpesaPinModal(checkoutRequestId, orderNumber, amount, phone) {
  const modal = document.getElementById("mpesa-pin-modal");
  if (!modal) return;

  document.getElementById("mpesa-modal-phone").textContent = phone;
  document.getElementById("mpesa-modal-amount").textContent = `KES ${amount.toLocaleString()}`;
  document.getElementById("mpesa-modal-order").textContent = orderNumber;
  document.getElementById("mpesa-status-text").textContent = "Prompt sent! Check your phone and enter M-Pesa PIN...";

  modal.classList.remove("hidden");
  renderIcons();

  if (state.activePollInterval) clearInterval(state.activePollInterval);

  let attempts = 0;
  state.activePollInterval = setInterval(async () => {
    attempts++;
    if (attempts > 30) {
      clearInterval(state.activePollInterval);
      document.getElementById("mpesa-status-text").textContent = "Timed out. If you completed payment, check your order history.";
      return;
    }

    const res = await apiFetch(`/api/payments/mpesa/status/${checkoutRequestId}`);
    if (res.ok && res.data.success) {
      const statusData = res.data.data;
      if (statusData.status === "COMPLETED") {
        clearInterval(state.activePollInterval);
        document.getElementById("mpesa-modal-icon").innerHTML = `<i data-lucide="check-circle" class="w-8 h-8 text-emerald-600"></i>`;
        document.getElementById("mpesa-status-text").innerHTML = `
          <strong class="text-emerald-600 block text-base mb-1">Payment Successful!</strong>
          M-Pesa Receipt: <span class="font-mono font-bold">${statusData.mpesaReceiptNumber || "CONFIRMED"}</span>
        `;
        showToast("Payment received! Order confirmed.");
        renderIcons();
      } else if (statusData.status === "FAILED") {
        clearInterval(state.activePollInterval);
        document.getElementById("mpesa-modal-icon").innerHTML = `<i data-lucide="alert-circle" class="w-8 h-8 text-rose-600"></i>`;
        document.getElementById("mpesa-status-text").textContent = "Payment cancelled or insufficient funds.";
        renderIcons();
      }
    }
  }, 2500);
}

// 17. Platform Mode: Load All Stores
async function loadPlatformStores() {
  const container = document.getElementById("platform-stores-grid");
  const selector = document.getElementById("store-selector");
  if (!container) return;

  const res = await apiFetch("/api/platform/stores");
  const stores = (res.ok && res.data.success && Array.isArray(res.data.data)) ? res.data.data : [];

  if (selector) {
    let selectorHtml = `<option value="">Marketplace Directory</option>`;
    stores.forEach((s) => {
      selectorHtml += `<option value="${s.subdomain}" ${state.activeTenantSlug === s.subdomain ? "selected" : ""}>${s.name}</option>`;
    });
    selector.innerHTML = selectorHtml;
  }

  if (stores.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white rounded-3xl p-8 border border-slate-200 text-center shadow-sm">
        <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
          <i data-lucide="store" class="w-6 h-6"></i>
        </div>
        <h4 class="font-bold text-slate-900 text-base">Verified Stores Launching Daily</h4>
        <p class="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
          Store254 is welcoming verified Kenyan businesses. Be the first in your category to sell with your own subdomain and direct M-Pesa.
        </p>
        <button onclick="toggleDrawer('onboard-modal', true)" class="mt-4 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all inline-flex items-center gap-1.5">
          <i data-lucide="plus-circle" class="w-4 h-4"></i>
          <span>Onboard Your Store</span>
        </button>
      </div>
    `;
    renderIcons();
    return;
  }

  const iconMap = {
    ELECTRONICS: "tv",
    SERVICES: "briefcase",
    FURNITURE: "armchair",
    RETAIL: "shopping-bag",
    GENERAL: "store",
  };

  container.innerHTML = stores.map((s) => `
    <div onclick="switchStore('${s.subdomain}')" class="bg-white rounded-2xl p-6 border border-slate-200 hover:border-emerald-500 hover:shadow-xl transition-all cursor-pointer text-left group flex flex-col justify-between">
      <div>
        <div class="flex items-center gap-3 mb-3">
          <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <i data-lucide="${iconMap[s.businessType] || "store"}" class="w-6 h-6"></i>
          </div>
          <div>
            <h4 class="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">${s.name}</h4>
            <span class="text-xs text-slate-400 font-mono">${s.subdomain}.store254.co.ke</span>
          </div>
        </div>
        <p class="text-xs text-slate-600 line-clamp-2 leading-relaxed">${s.settings?.description || "Browse dynamic catalog and pay directly to merchant Till or Paybill."}</p>
      </div>
      <div class="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600">
        <span class="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
          <span>Visit Storefront</span>
          <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
        </span>
        <span class="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded text-[10px] font-mono uppercase">${s.businessType}</span>
      </div>
    </div>
  `).join("");

  renderIcons();
}

// 18. Store Switcher
function switchStore(slug) {
  state.activeTenantSlug = slug;
  if (slug) {
    window.location.hash = `store=${slug}`;
  } else {
    history.pushState("", document.title, window.location.pathname + window.location.search);
  }
  state.activeFilters = {};
  state.selectedCategory = "";
  loadStoreProfile();
}

// 19. UI Drawer Toggles
function toggleDrawer(id, show) {
  const el = document.getElementById(id);
  if (!el) return;

  if (show) {
    el.classList.remove("hidden");
    if (id === "cart-drawer") renderCartDrawer();
    if (id === "orders-drawer") loadMyOrders();
    if (id === "super-admin-drawer") loadSuperAdminStats();
  } else {
    el.classList.add("hidden");
  }
  renderIcons();
}

// 20. Customer Order Tracking (My Orders)
async function loadMyOrders() {
  const container = document.getElementById("my-orders-container");
  if (!container) return;

  const res = await apiFetch("/api/orders/my-orders");
  if (res.ok && res.data.success) {
    state.myOrders = res.data.data;
    if (state.myOrders.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center text-slate-400">
          <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-300">
            <i data-lucide="package" class="w-6 h-6"></i>
          </div>
          <p class="text-xs font-semibold text-slate-600">No past orders found.</p>
        </div>
      `;
      renderIcons();
      return;
    }

    let html = "";
    for (const order of state.myOrders) {
      html += `
        <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-2.5 text-xs">
          <div class="flex justify-between items-center mb-1.5">
            <span class="font-bold font-mono text-slate-900">#${order.orderNumber}</span>
            <span class="px-2 py-0.5 rounded font-bold text-[10px] ${
              order.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
            }">${order.status}</span>
          </div>
          <p class="text-slate-600">Total: <strong>KES ${Number(order.totalAmount).toLocaleString()}</strong></p>
          ${
            order.fulfillmentDetails?.trackingNumber
              ? `<p class="text-emerald-700 mt-2 flex items-center gap-1.5">
                  <i data-lucide="truck" class="w-3.5 h-3.5"></i>
                  <span>Tracking: <strong>${order.fulfillmentDetails.trackingNumber}</strong> (${order.fulfillmentDetails.courierName || "Courier"})</span>
                </p>`
              : ""
          }
        </div>
      `;
    }
    container.innerHTML = html;
    renderIcons();
  }
}

// 21. Super Admin Actions
async function loadSuperAdminStats() {
  const res = await apiFetch("/api/platform/admin/stats", {
    headers: { "x-admin-key": state.superAdminKey },
  });

  if (res.ok && res.data.success) {
    const stats = res.data.data;
    document.getElementById("admin-stat-stores").textContent = stats.stores.total;
    document.getElementById("admin-stat-pending").textContent = stats.stores.pendingApproval;
    document.getElementById("admin-stat-gmv").textContent = `KES ${stats.orders.platformGMV_KES.toLocaleString()}`;
    await loadSuperAdminStores();
  } else {
    showToast("Invalid Super Admin Key", "error");
  }
  renderIcons();
}

async function loadSuperAdminStores() {
  const container = document.getElementById("admin-stores-list");
  if (!container) return;

  const res = await apiFetch("/api/platform/admin/stores", {
    headers: { "x-admin-key": state.superAdminKey },
  });

  if (res.ok && res.data.success) {
    let html = "";
    for (const store of res.data.data) {
      html += `
        <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 text-xs">
          <div>
            <h5 class="font-bold text-slate-900">${store.name}</h5>
            <span class="text-slate-400 font-mono">${store.subdomain}.store254.co.ke</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
              store.status === "ACTIVE"
                ? "bg-emerald-100 text-emerald-700"
                : store.status === "PENDING"
                ? "bg-amber-100 text-amber-800"
                : "bg-rose-100 text-rose-700"
            }">${store.status}</span>
            ${
              store.status === "PENDING"
                ? `<button onclick="activateStore('${store.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Approve</button>`
                : ""
            }
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
    renderIcons();
  }
}

async function activateStore(storeId) {
  const res = await apiFetch(`/api/platform/admin/stores/${storeId}/activate`, {
    method: "PATCH",
    headers: { "x-admin-key": state.superAdminKey },
  });

  if (res.ok && res.data.success) {
    showToast("Store activated and email sent to owner!");
    loadSuperAdminStats();
  }
}

// 22. Initialization
window.addEventListener("DOMContentLoaded", () => {
  renderIcons();
  updateCartBadge();
  loadStoreProfile();
});
