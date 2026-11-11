// Subdomain & Tenant Detection
function detectInitialTenantSlug() {
  const host = window.location.hostname.toLowerCase();
  const urlParams = new URLSearchParams(window.location.search);
  const paramStore = urlParams.get("store") || urlParams.get("subdomain");
  if (paramStore) return paramStore.toLowerCase().trim();

  // Check URL hash fallback (e.g. #store=alicebabycare)
  if (window.location.hash && window.location.hash.startsWith("#store=")) {
    return window.location.hash.replace("#store=", "").trim();
  }

  const platformDomain = "store254.co.ke";
  if (host === platformDomain || host === `www.${platformDomain}`) return "";
  if (host.endsWith(`.${platformDomain}`)) {
    const subdomain = host.slice(0, -(platformDomain.length + 1));
    return subdomain === "www" || subdomain === "api" ? "" : subdomain;
  }

  // Handle local development subdomains like alicebabycare.localhost
  if (host.endsWith(".localhost")) {
    const subdomain = host.slice(0, -".localhost".length);
    return subdomain === "www" || subdomain === "api" ? "" : subdomain;
  }

  // Custom domains (any host that is not localhost, 127.0.0.1, or a workers.dev preview domain)
  if (
    host !== "localhost" &&
    host !== "127.0.0.1" &&
    !host.endsWith(".workers.dev") &&
    !host.endsWith(".pages.dev")
  ) {
    return "__custom_domain__";
  }

  // Keep other preview hosts in marketplace mode unless a store is selected.
  return "";
}

const INITIAL_TENANT_SLUG = detectInitialTenantSlug();

function getCustomerStorageKey(key) {
  return `store254_customer_${INITIAL_TENANT_SLUG || "platform"}_${key}`;
}

// Bearer tokens persisted by older storefront builds are unsafe to keep in browser storage.
for (const key of ["store254_customer_token", "store254_merchant_token", "store254_superadmin_token", getCustomerStorageKey("token")]) {
  localStorage.removeItem(key);
}

function getInitialCustomerStorage(key, legacyKey) {
  const scopedKey = getCustomerStorageKey(key);
  const existing = localStorage.getItem(scopedKey);
  if (existing !== null) return existing;
  if (INITIAL_TENANT_SLUG !== "alicebabycare") return null;

  const legacyValue = localStorage.getItem(legacyKey);
  if (legacyValue !== null) localStorage.setItem(scopedKey, legacyValue);
  return legacyValue;
}

function getInitialWishlist() {
  const key = `store254_wishlist_${INITIAL_TENANT_SLUG || "platform"}`;
  const stored = localStorage.getItem(key) ??
    (INITIAL_TENANT_SLUG === "alicebabycare" ? localStorage.getItem("store254_wishlist") : null);
  if (!stored) return [];
  try {
    const wishlist = JSON.parse(stored);
    if (!Array.isArray(wishlist)) return [];
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(wishlist));
    return wishlist.filter((itemId) => typeof itemId === "string");
  } catch (error) {
    console.error("[Wishlist] Could not read saved items:", error);
    return [];
  }
}

function getCartStorageKey() {
  return `store254_cart_${state?.activeTenantSlug || INITIAL_TENANT_SLUG || "platform"}`;
}

function getInitialCart() {
  const scopedKey = `store254_cart_${INITIAL_TENANT_SLUG || "platform"}`;
  const stored = localStorage.getItem(scopedKey);
  if (stored) {
    try { return JSON.parse(stored); } catch { return []; }
  }
  const legacy = localStorage.getItem("store254_cart");
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy);
      localStorage.setItem(scopedKey, legacy);
      return parsed;
    } catch { return []; }
  }
  return [];
}

// Global Reactive State
const state = {
  activeTenantSlug: INITIAL_TENANT_SLUG,
  activeTenant: null,
  currentItemId: null,
  currentItemImages: [],
  currentItemImageIndex: 0,
  categories: [],
  selectedCategory: "",
  activeFilters: {},
  onlyDeals: false,
  itemTypeFilter: "",
  priceFilterActive: false,
  catalogViewMode: "grid-4",
  priceRange: { min: 0, max: 200000 },
  selectedPriceRange: { min: 0, max: 200000 },
  facets: [],
  items: [],
  allStoreItems: null,
  cart: getInitialCart(),
  appliedCoupon: null,
  customerToken: getInitialCustomerStorage("token", "store254_customer_token"),
  customerUser: JSON.parse(getInitialCustomerStorage("user", "store254_customer_user") || "null"),
  merchantToken: null,
  myOrders: [],
  activePollInterval: null,
  activePaymentStatusToken: null,
  wishlist: getInitialWishlist(),
  showWishlistOnly: false,
};

function persistCustomerSession(user, token) {
  state.customerUser = user;
  state.customerToken = token;
  localStorage.setItem(getCustomerStorageKey("user"), JSON.stringify(user));
}

function clearCustomerSession() {
  state.customerUser = null;
  state.customerToken = null;
  localStorage.removeItem(getCustomerStorageKey("user"));
  localStorage.removeItem(getCustomerStorageKey("token"));
}
