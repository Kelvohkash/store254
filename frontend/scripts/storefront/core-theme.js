// Theme Palette & Layout Engine
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
