/**
 * Store254 Web Application Client Engine
 * Connects directly to Hono Backend API on Cloudflare Workers + Cloudflare D1
 */

// 1. API Configuration
const API_BASE_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.endsWith(".localhost")
    ? "http://localhost:8787"
    : "";
const DEFAULT_STORE_LOGO = "./assets/Store254_Digital_Marketplace_Logo_transparent.png";

// Helper to safely render Lucide icons
function renderIcons() {
  if (typeof lucide !== "undefined" && lucide.createIcons) {
    lucide.createIcons();
  }
}

// 1.5 Theme Palette Engine (Psychology-Driven Colors)
const THEME_PALETTES = {
  "trust-forest": { name: "Trust Emerald & Forest", accent: "#15803d" },
  "sapphire-blue": { name: "Sapphire Trust & Blue", accent: "#0284c7" },
  "organic-sage": { name: "Organic Sage & Wellness", accent: "#2d6a4f" },
  "modern-onyx": { name: "Modern Onyx & Mint", accent: "#059669" },
  "sunset-amber": { name: "Sunset Amber & Coral", accent: "#d97706" },
  "rose": { name: "Rose", accent: "#b64269" },
};

function setThemePalette(palette) {
  const selected = THEME_PALETTES[palette] ? palette : "trust-forest";
  const root = document.documentElement;
  root.setAttribute("data-theme", selected);
  for (const property of ["--store-paper", "--store-white", "--store-ink", "--store-muted", "--store-line", "--store-media-bg", "--store-on-primary", "--store-card-radius", "--store-card-shadow", "--store-primary-hover"]) {
    root.style.removeProperty(property);
  }
  delete root.dataset.backgroundTone;
}

function setStorefrontBackgroundColor(color) {
  const root = document.documentElement;
  const value = String(color || "");
  const match = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return;

  const hex = match[1].length === 3
    ? [...match[1]].map((digit) => digit + digit).join("")
    : match[1];
  const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const luminance = channels
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const dark = luminance <= 0.179;

  root.style.setProperty("--store-paper", value);
  root.style.setProperty("--store-ink", dark ? "#f8fafc" : "#0f172a");
  root.style.setProperty("--store-muted", dark ? "#cbd5e1" : "#475569");
  root.style.setProperty("--store-white", dark ? `color-mix(in srgb, ${value}, white 12%)` : "#ffffff");
  root.style.setProperty("--store-line", dark ? `color-mix(in srgb, ${value}, white 28%)` : `color-mix(in srgb, ${value}, black 18%)`);
  root.style.setProperty("--store-media-bg", dark ? `color-mix(in srgb, ${value}, white 8%)` : `color-mix(in srgb, ${value}, white 55%)`);
  root.dataset.backgroundTone = dark ? "dark" : "light";
}

const STOREFRONT_LAYOUTS = {
  "modern-retailer": { header: "compact-search-first", card: "grid-card" },
  "lifestyle-boutique": { header: "centered-brand", card: "grid-card" },
  "single-product-maker": { header: "centered-brand", card: "grid-card" },
  "service-portfolio": { header: "minimal-nav", card: "service-card" },
};

let storefrontTemplateCatalogPromise;
function loadStorefrontTemplateCatalog() {
  if (!storefrontTemplateCatalogPromise) {
    storefrontTemplateCatalogPromise = fetch("/templates/catalog.json", { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) throw new Error("Template catalog unavailable");
        return response.json();
      })
      .then((catalog) => Array.isArray(catalog.templates) ? catalog : { templates: [] })
      .catch((error) => {
        console.error("[Storefront] Could not load template catalog:", error);
        return { templates: [] };
      });
  }
  return storefrontTemplateCatalogPromise;
}

async function loadStorefrontTemplateStylesheet(template) {
  let link = document.getElementById("active-storefront-template-styles");
  const stylesheet = template?.stylesheet;
  if (!stylesheet || !/^[a-z0-9][a-z0-9/_-]*\.css$/i.test(stylesheet) || stylesheet.includes("..")) {
    link?.remove();
    return;
  }
  const href = new URL(`/templates/${stylesheet}`, window.location.origin).href;
  if (link?.href === href && link.dataset.loaded === "true") return;
  link?.remove();
  link = document.createElement("link");
  link.id = "active-storefront-template-styles";
  link.rel = "stylesheet";
  link.href = href;
  await new Promise((resolve) => {
    link.addEventListener("load", () => { link.dataset.loaded = "true"; resolve(); }, { once: true });
    link.addEventListener("error", () => { console.error(`[Storefront] Template style could not be loaded: ${template.id}`); resolve(); }, { once: true });
    document.head.append(link);
  });
}

async function applyStorefrontSettings(settings = {}) {
  settings = settings || {};
  const root = document.documentElement;
  const catalog = await loadStorefrontTemplateCatalog();
  const requestedId = /^[a-z0-9][a-z0-9-]{0,63}$/i.test(settings.storefrontTemplate || "") ? settings.storefrontTemplate : "";
  const template = catalog.templates.find((entry) => entry.id === requestedId)
    || catalog.templates.find((entry) => entry.id === "market-modern")
    || { id: "market-modern", defaults: {} };
  const defaults = template.defaults || {};
  const archetype = STOREFRONT_LAYOUTS[defaults.archetype] ? defaults.archetype : "modern-retailer";

  root.dataset.storefrontType = archetype;
  root.dataset.storefrontTemplate = template.id;
  root.dataset.productImageRatio = "square";
  root.dataset.cardDensity = "comfortable";
  root.dataset.headingFont = defaults.font || "modern";
  root.dataset.heroStyle = defaults.hero || "split";
  root.dataset.heroFocalPoint = "center";
  root.dataset.headerVariant = defaults.header || STOREFRONT_LAYOUTS[archetype].header;
  root.dataset.productCardStyle = defaults.card || STOREFRONT_LAYOUTS[archetype].card;
  setStorefrontBackgroundColor(settings.backgroundColor);
  root.style.removeProperty("--store-primary");
  root.removeAttribute("data-custom-accent");
  if (/^#(?:[0-9a-f]{3}){1,2}$/i.test(settings.primaryColor || "")) {
    root.style.setProperty("--store-primary", settings.primaryColor);
    root.setAttribute("data-custom-accent", "true");
  }
  const primary = getHexLuminance(getComputedStyle(root).getPropertyValue("--store-primary").trim());
  root.style.setProperty("--store-on-primary", primary > 0.179 ? "#142019" : "#ffffff");
  root.style.setProperty("--store-primary-hover", "color-mix(in srgb, var(--store-primary) 82%, black)");
  root.style.setProperty("--store-card-radius", template.id === "editorial-boutique" ? "1.15rem" : template.id === "tech-home" ? ".65rem" : ".85rem");
  root.style.setProperty("--store-card-shadow", template.id === "premium-maker" ? "0 16px 38px rgba(15, 23, 42, .10)" : "0 8px 26px rgba(15, 23, 42, .06)");
  await loadStorefrontTemplateStylesheet(template);
}

function getHexLuminance(color) {
  const match = String(color).match(/#([0-9a-f]{3}|[0-9a-f]{6})/i);
  if (!match) return 0.1;
  const hex = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
  const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  return channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function setHeaderLogo(src = DEFAULT_STORE_LOGO, alt = "Store254") {
  const logo = document.getElementById("header-platform-logo");
  if (!logo) return;

  logo.onerror = () => {
    logo.onerror = null;
    logo.src = DEFAULT_STORE_LOGO;
    logo.alt = "Store254";
  };
  logo.src = src || DEFAULT_STORE_LOGO;
  logo.alt = alt;
}

// 2. Subdomain & Tenant Detection
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

  // Keep other preview hosts in marketplace mode unless a store is selected.
  return "";
}

const INITIAL_TENANT_SLUG = detectInitialTenantSlug();

// Bearer tokens persisted by older storefront builds are unsafe to keep in browser storage.
for (const key of ["store254_customer_token", "store254_merchant_token", "store254_superadmin_token", getCustomerStorageKey("token")]) {
  localStorage.removeItem(key);
}

function getCustomerStorageKey(key) {
  return `store254_customer_${INITIAL_TENANT_SLUG || "platform"}_${key}`;
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

// 3. Global Reactive State
const state = {
  activeTenantSlug: INITIAL_TENANT_SLUG,
  activeTenant: null,
  currentItemId: null,
  currentItemImages: [],
  currentItemImageIndex: 0,
  categories: [],
  selectedCategory: "",
  activeFilters: {},
  priceRange: { min: 0, max: 200000 },
  selectedPriceRange: { min: 0, max: 200000 },
  facets: [],
  items: [],
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

// 4. Helper API Fetcher with legacy tenant hint (server resolves tenant from Host only)
async function apiFetch(endpoint, options = {}) {
  const { asMerchant, ...requestOptions } = options;
  const headers = {
    "Content-Type": "application/json",
    ...(requestOptions.headers || {}),
  };

  // Inject tenant scope header if targeting an active store
  if (state.activeTenantSlug && !endpoint.startsWith("/api/platform")) {
    headers["X-Tenant-Slug"] = state.activeTenantSlug;
  }

  // Inject auth token if available
  if (endpoint.startsWith("/api/platform")) {
    // Platform admin sessions are carried by the HttpOnly cookie.
  } else if (asMerchant && state.merchantToken) {
    headers["Authorization"] = `Bearer ${state.merchantToken}`;
  } else if (state.customerToken) {
    headers["Authorization"] = `Bearer ${state.customerToken}`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...requestOptions,
      credentials: "include", // Super Admin session cookie is issued by the API subdomain.
      headers,
    });
    let data;
    const responseType = res.headers.get("content-type") || "";
    if (responseType.includes("application/json")) {
      try {
        data = await res.json();
      } catch {
        data = {
          success: false,
          error: { message: `The API returned an unreadable response (${res.status}).` },
        };
      }
    } else {
      const responseText = await res.text();
      data = {
        success: false,
        error: {
          message: responseText || `The API returned an empty response (${res.status}).`,
        },
      };
    }
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
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  renderIcons();

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-8px)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function inlineJs(value) {
  const encoded = JSON.stringify(String(value ?? "")).slice(1, -1);
  return `'${encoded.replace(/'/g, "\\'").replace(/[<>&\u2028\u2029]/g, (character) => ({
    "<": "\\u003c",
    ">": "\\u003e",
    "&": "\\u0026",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029",
  })[character])}'`;
}
