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

// 1.5 Theme Palette & Automatic Contrast-Safe Color Engine
const THEME_PALETTES = {
  "trust-forest": { name: "Trust Emerald & Forest", accent: "#15803d", background: "#edf5ee" },
  "sapphire-blue": { name: "Sapphire Trust & Blue", accent: "#08718b", background: "#e9f2f9" },
  "organic-sage": { name: "Organic Sage & Wellness", accent: "#66835c", background: "#f1f4eb" },
  "modern-onyx": { name: "Modern Onyx & Mint", accent: "#334155", background: "#edf0f3" },
  "sunset-amber": { name: "Sunset Amber & Coral", accent: "#c46a2d", background: "#fbf0e5" },
  "rose": { name: "Rose", accent: "#b64269", background: "#f8edf1" },
  "midnight-gold": { name: "Midnight Gold", accent: "#f59e0b", background: "#0f172a" },
  "obsidian-emerald": { name: "Obsidian Emerald", accent: "#10b981", background: "#111827" },
  "royal-velvet": { name: "Royal Velvet", accent: "#a855f7", background: "#18122b" },
  "terracotta-sand": { name: "Terracotta Sand", accent: "#c2410c", background: "#fdf6ee" },
};

function normalizeHexColor(input, fallback = "#15803d") {
  const match = String(input || "").trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return fallback;
  const raw = match[1].toLowerCase();
  return `#${raw.length === 3 ? [...raw].map((c) => c + c).join("") : raw}`;
}

function hexToRgbChannels(hex) {
  const normalized = normalizeHexColor(hex, "#000000").slice(1);
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function rgbChannelsToHex([r, g, b]) {
  return `#${[r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixHexColors(hexA, hexB, weightA = 0.5) {
  const a = hexToRgbChannels(hexA);
  const b = hexToRgbChannels(hexB);
  const w = Math.max(0, Math.min(1, weightA));
  return rgbChannelsToHex([
    a[0] * w + b[0] * (1 - w),
    a[1] * w + b[1] * (1 - w),
    a[2] * w + b[2] * (1 - w),
  ]);
}

function getHexLuminance(color) {
  const [r, g, b] = hexToRgbChannels(color).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getHexContrastRatio(hexA, hexB) {
  const lumA = getHexLuminance(hexA);
  const lumB = getHexLuminance(hexB);
  const brightest = Math.max(lumA, lumB);
  const darkest = Math.min(lumA, lumB);
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Automatically derives a complete set of contrast-safe storefront tokens from
 * ANY user-selected foreground color and background color (including dark+dark
 * or light+light combinations) so visibility is never compromised.
 */
function resolveStorefrontColorTokens(foregroundHex, backgroundHex) {
  const rawPrimary = normalizeHexColor(foregroundHex, "#15803d");
  const rawBackground = normalizeHexColor(backgroundHex, "#edf5ee");
  const bgLuminance = getHexLuminance(rawBackground);
  const isDark = bgLuminance <= 0.18;

  // 1. Page canvas & elevated card surface
  const paper = bgLuminance > 0.96
    ? mixHexColors(rawBackground, rawPrimary, 0.96)
    : rawBackground;
  const white = isDark
    ? mixHexColors(paper, "#ffffff", 0.88)
    : "#ffffff";
  const surfaceSubtle = isDark
    ? mixHexColors(paper, "#ffffff", 0.93)
    : mixHexColors(paper, "#ffffff", 0.45);

  // 2. Ensure foreground/primary color is always visible against both paper and card surface
  let primary = rawPrimary;
  let wasAdjusted = false;
  const minAccentContrast = 4.5;
  if (
    getHexContrastRatio(primary, paper) < minAccentContrast ||
    getHexContrastRatio(primary, white) < minAccentContrast
  ) {
    wasAdjusted = true;
    const pole = isDark ? "#ffffff" : "#000000";
    for (let step = 0.04; step <= 0.96; step += 0.04) {
      const candidate = mixHexColors(rawPrimary, pole, 1 - step);
      if (
        getHexContrastRatio(candidate, paper) >= minAccentContrast &&
        getHexContrastRatio(candidate, white) >= minAccentContrast
      ) {
        primary = candidate;
        break;
      }
    }
    // Ultimate fallback if both surfaces straddle mid-tone
    if (
      getHexContrastRatio(primary, paper) < 3.5 ||
      getHexContrastRatio(primary, white) < 3.5
    ) {
      primary = isDark ? "#f8fafc" : "#0f172a";
    }
  }

  // 3. Button text on primary (--store-on-primary)
  const onPrimary =
    getHexContrastRatio("#ffffff", primary) >= getHexContrastRatio("#090d16", primary)
      ? "#ffffff"
      : "#090d16";

  // 4. Primary hover, subtle wash, and glow
  const primaryHover = isDark
    ? mixHexColors(primary, "#ffffff", 0.82)
    : mixHexColors(primary, "#000000", 0.82);
  const primarySubtle = isDark
    ? mixHexColors(paper, primary, 0.78)
    : mixHexColors("#ffffff", primary, 0.88);
  const [pr, pg, pb] = hexToRgbChannels(primary);
  const primaryGlow = `rgba(${pr}, ${pg}, ${pb}, ${isDark ? 0.36 : 0.26})`;

  // 5. High-contrast body ink & muted secondary copy
  const ink = isDark
    ? mixHexColors("#f8fafc", primary, 0.92)
    : mixHexColors("#0f172a", primary, 0.92);
  let muted = isDark
    ? mixHexColors("#cbd5e1", primary, 0.90)
    : mixHexColors("#475569", primary, 0.90);
  if (getHexContrastRatio(muted, white) < 4.5) {
    muted = isDark ? "#cbd5e1" : "#334155";
  }

  // 6. Borders & media frame backdrop
  const line = isDark
    ? mixHexColors(paper, "#ffffff", 0.78)
    : mixHexColors(paper, "#0f172a", 0.84);
  const mediaBg = isDark
    ? mixHexColors(paper, "#ffffff", 0.92)
    : mixHexColors(paper, "#ffffff", 0.55);

  return {
    rawPrimary,
    rawBackground,
    primary,
    primaryHover,
    primarySubtle,
    primaryGlow,
    onPrimary,
    paper,
    white,
    surfaceSubtle,
    ink,
    muted,
    line,
    mediaBg,
    isDark,
    wasAdjusted,
    contrastOnPaper: Number(getHexContrastRatio(primary, paper).toFixed(2)),
    contrastOnSurface: Number(getHexContrastRatio(primary, white).toFixed(2)),
  };
}

if (typeof window !== "undefined") {
  window.resolveStorefrontColorTokens = resolveStorefrontColorTokens;
  window.getHexContrastRatio = getHexContrastRatio;
}

function applyResolvedColorTokensToRoot(tokens) {
  const root = document.documentElement;
  root.style.setProperty("--store-primary", tokens.primary);
  root.style.setProperty("--store-primary-hover", tokens.primaryHover);
  root.style.setProperty("--store-primary-subtle", tokens.primarySubtle);
  root.style.setProperty("--store-primary-glow", tokens.primaryGlow);
  root.style.setProperty("--store-on-primary", tokens.onPrimary);
  root.style.setProperty("--store-paper", tokens.paper);
  root.style.setProperty("--store-white", tokens.white);
  root.style.setProperty("--store-surface-subtle", tokens.surfaceSubtle);
  root.style.setProperty("--store-ink", tokens.ink);
  root.style.setProperty("--store-muted", tokens.muted);
  root.style.setProperty("--store-line", tokens.line);
  root.style.setProperty("--store-media-bg", tokens.mediaBg);
  root.style.setProperty("--store-green", tokens.primary);
  root.style.setProperty("--store-green-dark", tokens.primaryHover);
  root.dataset.backgroundTone = tokens.isDark ? "dark" : "light";
  root.setAttribute("data-custom-accent", "true");
}

function setThemePalette(palette) {
  const selected = THEME_PALETTES[palette] ? palette : "trust-forest";
  const entry = THEME_PALETTES[selected];
  const root = document.documentElement;
  root.setAttribute("data-theme", selected);
  const tokens = resolveStorefrontColorTokens(entry.accent, entry.background);
  applyResolvedColorTokensToRoot(tokens);
}

function setStorefrontBackgroundColor(color, foregroundColor) {
  const root = document.documentElement;
  const bgMatch = String(color || "").match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!bgMatch) return;
  const currentPrimary =
    foregroundColor ||
    root.style.getPropertyValue("--store-primary").trim() ||
    getComputedStyle(root).getPropertyValue("--store-primary").trim() ||
    "#15803d";
  const tokens = resolveStorefrontColorTokens(currentPrimary, color);
  applyResolvedColorTokensToRoot(tokens);
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

  const paletteEntry = THEME_PALETTES[settings.themePalette] || THEME_PALETTES["trust-forest"];
  const fgColor = /^#(?:[0-9a-f]{3}){1,2}$/i.test(settings.primaryColor || "")
    ? settings.primaryColor
    : paletteEntry.accent;
  const bgColor = /^#(?:[0-9a-f]{3}){1,2}$/i.test(settings.backgroundColor || "")
    ? settings.backgroundColor
    : paletteEntry.background;
  const tokens = resolveStorefrontColorTokens(fgColor, bgColor);
  applyResolvedColorTokensToRoot(tokens);

  root.style.setProperty("--store-card-radius", template.id === "editorial-boutique" ? "1.15rem" : template.id === "tech-home" ? ".65rem" : ".85rem");
  root.style.setProperty("--store-card-shadow", template.id === "premium-maker" ? "0 16px 38px rgba(15, 23, 42, .10)" : "0 8px 26px rgba(15, 23, 42, .06)");
  await loadStorefrontTemplateStylesheet(template);
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

  // Inject tenant scope header if targeting an active store (custom domains resolve via Host header)
  if (
    state.activeTenantSlug &&
    state.activeTenantSlug !== "__custom_domain__" &&
    !endpoint.startsWith("/api/platform")
  ) {
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

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  for (const modalId of ["item-details-modal", "cart-drawer", "orders-drawer", "onboard-modal", "recovery-modal", "mpesa-pin-modal"]) {
    const el = document.getElementById(modalId);
    if (el && !el.classList.contains("hidden") && typeof toggleDrawer === "function") {
      toggleDrawer(modalId, false);
    }
  }
});
