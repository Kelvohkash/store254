// Every store shares one storefront design and dynamically adapts all surface, border, ink, and accent tokens to its chosen colour.
const THEME_FALLBACK_MAP = {
  "sapphire-blue": "#2563eb",
  "modern": "#2563eb",
  "modern-onyx": "#0f172a",
  "trust-forest": "#16805a",
  "organic-sage": "#2d6a4f",
  "sunset-amber": "#d97706",
  "plum": "#8b3fa5",
  "rose": "#be185d",
  "default": "#2563eb",
};

function resolveStoreAccentColor(settings = {}) {
  const raw = String(settings?.primaryColor || "").trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
    if (raw.length === 4) {
      return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
    }
    return raw.toLowerCase();
  }
  const legacyKey = String(settings?.themePalette || settings?.theme || "").trim().toLowerCase();
  if (THEME_FALLBACK_MAP[legacyKey]) {
    return THEME_FALLBACK_MAP[legacyKey];
  }
  return "#2563eb";
}

async function applyStorefrontSettings(settings = {}) {
  const root = document.documentElement;
  root.dataset.storefrontType = settings?.storefrontArchetype || "modern-retailer";
  root.dataset.storefront = "true";
  root.dataset.productImageRatio = settings?.productImageRatio || "square";
  root.dataset.cardDensity = settings?.cardDensity || "comfortable";
  root.dataset.headingFont = settings?.headingFont || "modern";
  root.dataset.heroStyle = settings?.heroStyle || "split";
  root.dataset.heroFocalPoint = settings?.heroFocalPoint || "center";
  root.dataset.headerVariant = settings?.headerVariant || "compact-search-first";
  root.dataset.productCardStyle = state?.catalogViewMode || settings?.productCardStyle || "grid-card";

  const accent = resolveStoreAccentColor(settings);

  // Primary brand & interactive tokens
  root.style.setProperty("--store-primary", accent);
  root.style.setProperty("--store-primary-hover", `color-mix(in srgb, ${accent} 82%, #000000)`);
  root.style.setProperty("--store-primary-subtle", `color-mix(in srgb, ${accent} 12%, #ffffff)`);
  root.style.setProperty("--store-primary-soft", `color-mix(in srgb, ${accent} 6%, #ffffff)`);
  root.style.setProperty("--store-primary-glow", `color-mix(in srgb, ${accent} 24%, transparent)`);
  root.style.setProperty("--store-on-primary", "#ffffff");

  // Full-site adaptive surfaces, borders, and typography tokens (no hardcoded pink/terracotta)
  root.style.setProperty("--store-paper", `color-mix(in srgb, ${accent} 5%, #f8fafc)`);
  root.style.setProperty("--store-white", "#ffffff");
  root.style.setProperty("--store-surface-subtle", `color-mix(in srgb, ${accent} 9%, #f8fafc)`);
  root.style.setProperty("--store-ink", `color-mix(in srgb, ${accent} 18%, #0f172a)`);
  root.style.setProperty("--store-muted", `color-mix(in srgb, ${accent} 14%, #475569)`);
  root.style.setProperty("--store-line", `color-mix(in srgb, ${accent} 16%, #e2e8f0)`);
  root.style.setProperty("--store-media-bg", `color-mix(in srgb, ${accent} 7%, #f1f5f9)`);

  // Sync secondary aliases so every legacy selector adopts the chosen store colour
  root.style.setProperty("--store-green", accent);
  root.style.setProperty("--store-green-dark", `color-mix(in srgb, ${accent} 82%, #000000)`);
  root.style.setProperty("--store-trust-blue", accent);
  root.style.setProperty("--store-trust-blue-dark", `color-mix(in srgb, ${accent} 82%, #000000)`);
  root.style.setProperty("--store-trust-blue-bg", `color-mix(in srgb, ${accent} 10%, #ffffff)`);
  root.style.setProperty("--store-trust-blue-line", `color-mix(in srgb, ${accent} 24%, #e2e8f0)`);
  root.style.setProperty("--store-clay", accent);

  await loadDefaultStorefrontStyles();
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
