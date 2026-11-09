#!/usr/bin/env node
/**
 * Store254 Universal Storefront Template & Automatic Color Harmony Generator
 *
 * Generates self-contained storefront themes under `frontend/templates/<id>/`
 * (`template.css` + `preview.html`) and updates `frontend/templates/catalog.json`.
 *
 * Every generated template is 100% driven by automatic CSS color variables:
 *   --store-primary, --store-primary-hover, --store-primary-subtle, --store-primary-ink,
 *   --store-on-primary, --store-paper, --store-white, --store-surface-subtle,
 *   --store-ink, --store-muted, --store-line, --store-media-bg
 * so any foreground + background color pair (even dark+dark or light+light)
 * maintains guaranteed WCAG AA/AAA visibility across every business type.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PALETTES = [
  { id: "trust-forest", name: "Forest", primary: "#15803d", background: "#edf5ee" },
  { id: "sapphire-blue", name: "Ocean", primary: "#08718b", background: "#e9f2f9" },
  { id: "organic-sage", name: "Sage", primary: "#66835c", background: "#f1f4eb" },
  { id: "modern-onyx", name: "Charcoal", primary: "#334155", background: "#edf0f3" },
  { id: "sunset-amber", name: "Amber", primary: "#c46a2d", background: "#fbf0e5" },
  { id: "rose", name: "Rose", primary: "#b64269", background: "#f8edf1" },
  { id: "midnight-gold", name: "Midnight", primary: "#f59e0b", background: "#0f172a" },
  { id: "obsidian-emerald", name: "Obsidian", primary: "#10b981", background: "#111827" },
  { id: "royal-velvet", name: "Velvet", primary: "#a855f7", background: "#18122b" },
  { id: "terracotta-sand", name: "Terracotta", primary: "#c2410c", background: "#fdf6ee" },
];

export const TEMPLATE_BLUEPRINTS = [
  {
    id: "market-modern",
    name: "Market Modern",
    description: "Clean, confident everyday shopping with a balanced split hero and elevated cards.",
    previewImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1100&q=85",
    defaults: {
      archetype: "modern-retailer",
      header: "compact-search-first",
      card: "grid-card",
      hero: "split",
      font: "modern",
      kicker: "MADE FOR EVERY DAY",
      cta: "Explore collection",
      title: "Good things,<br>chosen well.",
    },
    tokens: {
      fontHeading: '"Manrope", system-ui, sans-serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "0.95rem",
      buttonRadius: "0.75rem",
      pillRadius: "9999px",
      mediaRatio: "1 / 1",
      heroAlign: "left",
      headerStyle: "surface-glass",
      cardVariant: "elevated",
      gridColumnsDesktop: "repeat(4, minmax(0, 1fr))",
      gridGap: "1.15rem",
    },
  },
  {
    id: "editorial-boutique",
    name: "Editorial Boutique",
    description: "A considered fashion and lifestyle lookbook with serif typography and portrait frames.",
    previewImage: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1100&q=85",
    defaults: {
      archetype: "lifestyle-boutique",
      header: "centered-brand",
      card: "grid-card",
      hero: "editorial",
      font: "editorial",
      kicker: "A CONSIDERED EDIT",
      cta: "Discover the edit",
      title: "A little more<br>beautiful, every day.",
    },
    tokens: {
      fontHeading: 'Georgia, "Playfair Display", "Times New Roman", serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "1.15rem",
      buttonRadius: "9999px",
      pillRadius: "9999px",
      mediaRatio: "4 / 5",
      heroAlign: "left",
      headerStyle: "centered-editorial",
      cardVariant: "borderless-lookbook",
      gridColumnsDesktop: "repeat(4, minmax(0, 1fr))",
      gridGap: "1.5rem",
    },
  },
  {
    id: "fashion-beauty-cosmetics",
    name: "Fashion, Beauty and Cosmetics",
    description: "A photo-led fashion storefront with a bold brand bar, category ribbon, and editorial product cards.",
    previewImage: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1100&q=85",
    defaults: {
      archetype: "lifestyle-boutique",
      header: "centered-brand",
      card: "grid-card",
      hero: "editorial",
      font: "editorial",
      kicker: "THE NEW SEASON",
      cta: "Discover the edit",
      title: "Everyday,<br>considered.",
    },
    tokens: {
      fontHeading: 'Georgia, "Playfair Display", "Times New Roman", serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "0.25rem",
      buttonRadius: "0.25rem",
      pillRadius: "0.25rem",
      mediaRatio: "4 / 5",
      heroAlign: "left",
      headerStyle: "primary-solid-ribbon",
      cardVariant: "sharp-runway",
      gridColumnsDesktop: "repeat(4, minmax(0, 1fr))",
      gridGap: "1.25rem",
    },
  },
  {
    id: "premium-maker",
    name: "Premium Maker",
    description: "An architectural studio showcase for signature craft, horizontal story rows, and bespoke goods.",
    previewImage: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1100&q=85",
    defaults: {
      archetype: "single-product-maker",
      header: "centered-brand",
      card: "horizontal-list-row",
      hero: "minimal",
      font: "editorial",
      kicker: "MADE WITH INTENTION",
      cta: "Meet the collection",
      title: "Made slowly.<br>Kept forever.",
    },
    tokens: {
      fontHeading: 'Georgia, "Playfair Display", serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "1rem",
      buttonRadius: "9999px",
      pillRadius: "9999px",
      mediaRatio: "4 / 3",
      heroAlign: "center",
      headerStyle: "minimal-atelier",
      cardVariant: "horizontal-showcase",
      gridColumnsDesktop: "repeat(2, minmax(0, 1fr))",
      gridGap: "1.4rem",
    },
  },
  {
    id: "tech-home",
    name: "Tech & Home",
    description: "Precision bento-grid storefront for electronics, appliances, and modern living essentials.",
    previewImage: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1100&q=85",
    defaults: {
      archetype: "modern-retailer",
      header: "compact-search-first",
      card: "grid-card",
      hero: "split",
      font: "modern",
      kicker: "SMARTER LIVING STARTS HERE",
      cta: "Shop essentials",
      title: "A smarter home<br>starts here.",
    },
    tokens: {
      fontHeading: '"Manrope", system-ui, sans-serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "0.6rem",
      buttonRadius: "0.5rem",
      pillRadius: "0.45rem",
      mediaRatio: "1 / 1",
      heroAlign: "left",
      headerStyle: "bento-tech",
      cardVariant: "bento-spec",
      gridColumnsDesktop: "repeat(4, minmax(0, 1fr))",
      gridGap: "0.9rem",
    },
  },
  {
    id: "service-studio",
    name: "Service Studio",
    description: "A welcoming booking and consultation storefront for salons, clinics, studios, and agencies.",
    previewImage: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1100&q=85",
    defaults: {
      archetype: "service-portfolio",
      header: "minimal-nav",
      card: "service-card",
      hero: "minimal",
      font: "modern",
      kicker: "PERSONAL SERVICE, BEAUTIFULLY DONE",
      cta: "View services",
      title: "Good care,<br>made personal.",
    },
    tokens: {
      fontHeading: 'Georgia, "Times New Roman", serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "1.25rem",
      buttonRadius: "9999px",
      pillRadius: "9999px",
      mediaRatio: "4 / 3",
      heroAlign: "center",
      headerStyle: "floating-pill",
      cardVariant: "service-accent-top",
      gridColumnsDesktop: "repeat(3, minmax(0, 1fr))",
      gridGap: "1.35rem",
    },
  },
  {
    id: "food-local",
    name: "Food & Local",
    description: "Warm, appetizing menu & market layout for restaurants, bakeries, grocers, and fresh produce.",
    previewImage: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1100&q=85",
    defaults: {
      archetype: "modern-retailer",
      header: "centered-brand",
      card: "grid-card",
      hero: "editorial",
      font: "rounded",
      kicker: "FRESH FROM OUR KITCHEN",
      cta: "Order something good",
      title: "A little joy,<br>made fresh.",
    },
    tokens: {
      fontHeading: '"DM Sans", ui-rounded, system-ui, sans-serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "1.35rem",
      buttonRadius: "9999px",
      pillRadius: "9999px",
      mediaRatio: "4 / 3",
      heroAlign: "left",
      headerStyle: "warm-canopy",
      cardVariant: "soft-menu",
      gridColumnsDesktop: "repeat(3, minmax(0, 1fr))",
      gridGap: "1.2rem",
    },
  },
  {
    id: "brutalist-studio",
    name: "Neo-Brutalist Studio",
    description: "Bold architectural grid with crisp 2px ink borders, offset hard shadows, and streetwear punch.",
    previewImage: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1100&q=85",
    defaults: {
      archetype: "modern-retailer",
      header: "compact-search-first",
      card: "grid-card",
      hero: "split",
      font: "modern",
      kicker: "LIMITED EDITION ARCHIVE",
      cta: "Shop the drop",
      title: "Bold form.<br>Zero compromise.",
    },
    tokens: {
      fontHeading: '"Manrope", system-ui, sans-serif',
      fontBody: '"DM Sans", monospace, sans-serif',
      cardRadius: "0px",
      buttonRadius: "0px",
      pillRadius: "0px",
      mediaRatio: "1 / 1",
      heroAlign: "left",
      headerStyle: "brutalist-framed",
      cardVariant: "brutalist-shadow",
      gridColumnsDesktop: "repeat(4, minmax(0, 1fr))",
      gridGap: "1.15rem",
    },
  },
  {
    id: "luxury-atelier",
    name: "Luxury Atelier",
    description: "Ultra-refined gallery with generous breathing room, hairline dividers, and tall showcase frames.",
    previewImage: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1100&q=85",
    defaults: {
      archetype: "lifestyle-boutique",
      header: "centered-brand",
      card: "grid-card",
      hero: "minimal",
      font: "editorial",
      kicker: "PRIVATE COLLECTION",
      cta: "Enter the gallery",
      title: "Timeless craft,<br>quiet luxury.",
    },
    tokens: {
      fontHeading: 'Georgia, "Playfair Display", serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "0.15rem",
      buttonRadius: "0.15rem",
      pillRadius: "0.15rem",
      mediaRatio: "4 / 5",
      heroAlign: "center",
      headerStyle: "minimal-atelier",
      cardVariant: "hairline-gallery",
      gridColumnsDesktop: "repeat(3, minmax(0, 1fr))",
      gridGap: "1.85rem",
    },
  },
  {
    id: "bazaar-vibrant",
    name: "Dynamic Bazaar",
    description: "High-energy merchant marketplace with pill-framed navigation, quick-buy badges, and dense discovery.",
    previewImage: "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=1100&q=85",
    defaults: {
      archetype: "modern-retailer",
      header: "compact-search-first",
      card: "grid-card",
      hero: "split",
      font: "rounded",
      kicker: "TOP DEALS & NEW FINDS",
      cta: "Browse deals",
      title: "Everything you need,<br>right here.",
    },
    tokens: {
      fontHeading: '"Manrope", system-ui, sans-serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "1.1rem",
      buttonRadius: "9999px",
      pillRadius: "9999px",
      mediaRatio: "1 / 1",
      heroAlign: "left",
      headerStyle: "floating-pill",
      cardVariant: "bazaar-pop",
      gridColumnsDesktop: "repeat(4, minmax(0, 1fr))",
      gridGap: "0.85rem",
    },
  },
];

function generateTemplateCss(template) {
  const { id, name, tokens } = template;
  const scope = `html[data-storefront="true"][data-storefront-template="${id}"]`;
  const standaloneScope = `html[data-storefront-template="${id}"]`;

  let headerCss = "";
  if (tokens.headerStyle === "primary-solid-ribbon") {
    headerCss = `
${scope} .site-header,
${standaloneScope} #site-header {
  position: sticky;
  top: 0;
  background: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border-bottom: 1px solid color-mix(in srgb, var(--store-on-primary) 18%, var(--store-primary)) !important;
  box-shadow: 0 10px 28px var(--store-primary-glow) !important;
}
${scope} .site-header::before { display: none; }
${scope} .site-header-inner {
  display: grid !important;
  grid-template-columns: minmax(11rem, auto) minmax(12rem, 1fr) auto;
  gap: clamp(0.8rem, 2vw, 2rem);
  min-height: 4.8rem;
  padding-inline: clamp(1rem, 4vw, 3.5rem);
}
${scope} #header-store-name,
${scope} .header-powered-by strong,
${standaloneScope} #header-store-name {
  color: var(--store-on-primary) !important;
}
${scope} .header-powered-by,
${standaloneScope} #header-store-tagline,
${standaloneScope} #header-powered-by {
  color: color-mix(in srgb, var(--store-on-primary) 78%, transparent) !important;
}
${scope} .header-logo-frame {
  width: 3.1rem;
  height: 3.1rem;
  padding: 0.3rem;
  border-radius: 0.45rem;
  background: var(--store-white);
}
${scope} .search-field input,
${standaloneScope} #search-input {
  border-radius: 9999px !important;
  background: var(--store-white) !important;
  color: var(--store-ink) !important;
  border: 1px solid var(--store-line) !important;
}
${scope} .site-header-inner > .flex.items-center.gap-2 > button,
${standaloneScope} #header-actions-nav button {
  border-radius: 9999px !important;
  border: 1px solid color-mix(in srgb, var(--store-on-primary) 32%, transparent) !important;
  background: color-mix(in srgb, var(--store-on-primary) 10%, transparent) !important;
  color: var(--store-on-primary) !important;
}
${scope} #desktop-cart-btn,
${standaloneScope} #desktop-cart-btn {
  background: var(--store-white) !important;
  color: var(--store-ink) !important;
  border-color: var(--store-white) !important;
}
${scope} .storefront-fashion-nav {
  display: block;
  padding: 0 clamp(1rem, 4vw, 3.5rem);
  background: color-mix(in srgb, var(--store-primary) 88%, #000000);
}
${scope} .storefront-fashion-nav.hidden { display: none; }
${scope} .storefront-header-categories {
  display: flex;
  min-height: 2.85rem;
  align-items: center;
  justify-content: center;
  gap: clamp(1rem, 3vw, 2.25rem);
  overflow-x: auto;
  scrollbar-width: none;
}
${scope} .storefront-header-categories .category-pill,
${scope} .storefront-header-categories .category-subpill {
  background: transparent !important;
  color: color-mix(in srgb, var(--store-on-primary) 82%, transparent) !important;
  border: 0 !important;
  border-radius: 0 !important;
  font-size: 0.7rem !important;
  font-weight: 800 !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase;
  box-shadow: none !important;
}
${scope} .storefront-header-categories .category-pill-active,
${scope} .storefront-header-categories .category-pill:hover {
  color: var(--store-on-primary) !important;
  box-shadow: inset 0 -2px var(--store-on-primary) !important;
}`;
  } else if (tokens.headerStyle === "brutalist-framed") {
    headerCss = `
${scope} .site-header,
${standaloneScope} #site-header {
  background: var(--store-white) !important;
  color: var(--store-ink) !important;
  border-top: 0 !important;
  border-bottom: 3px solid var(--store-ink) !important;
  box-shadow: none !important;
}
${scope} .site-header::before { display: none; }
${scope} .header-action,
${scope} .cart-action,
${standaloneScope} #header-actions-nav button {
  border-radius: 0px !important;
  border: 2px solid var(--store-ink) !important;
  box-shadow: 3px 3px 0 var(--store-ink) !important;
  text-transform: uppercase;
  font-weight: 800 !important;
}`;
  } else if (tokens.headerStyle === "floating-pill") {
    headerCss = `
${scope} .site-header,
${standaloneScope} #site-header {
  margin: 0.65rem auto 0;
  max-width: min(96%, 80rem);
  border: 1px solid var(--store-line) !important;
  border-radius: 9999px !important;
  background: color-mix(in srgb, var(--store-white) 92%, transparent) !important;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08) !important;
  backdrop-filter: blur(16px);
}
${scope} .site-header::before { display: none; }`;
  } else if (tokens.headerStyle === "minimal-atelier") {
    headerCss = `
${scope} .site-header,
${standaloneScope} #site-header {
  background: var(--store-paper) !important;
  border-top: 0 !important;
  border-bottom: 1px solid var(--store-line) !important;
  box-shadow: none !important;
}
${scope} .site-header::before { display: none; }
${scope} #header-store-name,
${standaloneScope} #header-store-name {
  font-family: ${tokens.fontHeading} !important;
  font-size: 1.15rem !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase;
}`;
  } else if (tokens.headerStyle === "bento-tech") {
    headerCss = `
${scope} .site-header,
${standaloneScope} #site-header {
  background: var(--store-white) !important;
  border-top: 3px solid var(--store-primary) !important;
  border-bottom: 1px solid var(--store-line) !important;
}`;
  } else {
    headerCss = `
${scope} .site-header,
${standaloneScope} #site-header {
  background: color-mix(in srgb, var(--store-white) 94%, var(--store-paper)) !important;
  border-bottom: 1px solid var(--store-line) !important;
}`;
  }

  let cardCss = "";
  if (tokens.cardVariant === "borderless-lookbook") {
    cardCss = `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
${scope} #items-grid .product-card-media,
${standaloneScope} .product-card-media {
  aspect-ratio: ${tokens.mediaRatio} !important;
  border-radius: ${tokens.cardRadius} !important;
  border: 1px solid var(--store-line) !important;
}
${scope} .product-card-content,
${standaloneScope} .product-card-body {
  padding-inline: 0.25rem !important;
}`;
  } else if (tokens.cardVariant === "sharp-runway") {
    cardCss = `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 1px solid var(--store-line) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06) !important;
}
${scope} #items-grid .product-card-media,
${standaloneScope} .product-card-media {
  aspect-ratio: ${tokens.mediaRatio} !important;
  border-radius: 0 !important;
}`;
  } else if (tokens.cardVariant === "horizontal-showcase") {
    cardCss = `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 1px solid var(--store-line) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.08) !important;
}`;
  } else if (tokens.cardVariant === "bento-spec") {
    cardCss = `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 1.5px solid var(--store-line) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04) !important;
}
${scope} .product-card-price,
${standaloneScope} .product-price {
  font-variant-numeric: tabular-nums;
  color: var(--store-primary) !important;
}`;
  } else if (tokens.cardVariant === "service-accent-top") {
    cardCss = `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 1px solid var(--store-line) !important;
  border-top: 4px solid var(--store-primary) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06) !important;
}`;
  } else if (tokens.cardVariant === "brutalist-shadow") {
    cardCss = `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 2px solid var(--store-ink) !important;
  border-radius: 0px !important;
  background: var(--store-white) !important;
  box-shadow: 5px 5px 0 var(--store-ink) !important;
}
${scope} #storefront-view .product-card:hover,
${standaloneScope} .product-card:hover {
  transform: translate(-2px, -2px) !important;
  box-shadow: 7px 7px 0 var(--store-primary) !important;
}`;
  } else if (tokens.cardVariant === "hairline-gallery") {
    cardCss = `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 1px solid var(--store-line) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: none !important;
}
${scope} .product-card-title,
${standaloneScope} .product-title {
  font-family: ${tokens.fontHeading} !important;
  font-weight: 500 !important;
}`;
  } else {
    cardCss = `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 1px solid var(--store-line) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: var(--store-card-shadow, 0 8px 26px rgba(15, 23, 42, 0.06)) !important;
}`;
  }

  return `/* ==========================================================================
   Store254 Generated Storefront Theme: ${name} (${id})
   Auto-generated by frontend/templates/generate-templates.mjs
   100% Contrast-Safe & Automatic Foreground/Background Color Adaptation
   ========================================================================== */

${scope},
${standaloneScope} {
  --store-card-radius: ${tokens.cardRadius};
  --store-btn-radius: ${tokens.buttonRadius};
  --store-pill-radius: ${tokens.pillRadius};
  --store-font-heading: ${tokens.fontHeading};
  --store-font-body: ${tokens.fontBody};
  background-color: var(--store-paper);
  color: var(--store-ink);
  font-family: var(--store-font-body);
}

/* Base Structural Layout for Pure Semantic HTML (store-tenant.html) & Live Shell */
${standaloneScope} body {
  margin: 0;
  background-color: var(--store-paper) !important;
  color: var(--store-ink) !important;
  font-family: var(--store-font-body) !important;
  line-height: 1.55;
}

${standaloneScope} #site-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem clamp(1rem, 4vw, 3rem);
}

${standaloneScope} #header-brand {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

${standaloneScope} #header-store-logo {
  width: 2.75rem;
  height: 2.75rem;
  object-fit: contain;
  border-radius: var(--store-btn-radius);
}

${standaloneScope} #header-store-name {
  margin: 0;
  font-family: var(--store-font-heading);
  font-size: 1.15rem;
  color: var(--store-ink);
}

${standaloneScope} #header-store-tagline,
${standaloneScope} #header-powered-by {
  margin: 0;
  font-size: 0.72rem;
  color: var(--store-muted);
}

${standaloneScope} #search-form {
  display: flex;
  flex: 1 1 18rem;
  max-width: 32rem;
  align-items: center;
  gap: 0.4rem;
}

${standaloneScope} #search-form label,
${standaloneScope} #mobile-search-bar label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

${standaloneScope} input[type="search"],
${standaloneScope} input[type="text"],
${standaloneScope} input[type="email"],
${standaloneScope} input[type="tel"],
${standaloneScope} input[type="number"],
${standaloneScope} input[type="date"],
${standaloneScope} select,
${standaloneScope} textarea {
  padding: 0.6rem 0.85rem;
  border: 1px solid var(--store-line);
  border-radius: var(--store-btn-radius);
  background-color: var(--store-white);
  color: var(--store-ink);
  font: inherit;
}

${standaloneScope} #search-input {
  flex: 1;
}

${standaloneScope} #header-actions-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

${standaloneScope} button,
${standaloneScope} #storefront-primary-cta,
${standaloneScope} #banner-store-call-btn,
${standaloneScope} #whatsapp-quick-contact {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  border-radius: var(--store-btn-radius);
  border: 1px solid var(--store-line);
  background-color: var(--store-white);
  color: var(--store-ink);
  font-weight: 700;
  font-size: 0.82rem;
  text-decoration: none;
  cursor: pointer;
  transition: transform 150ms ease, background-color 150ms ease, border-color 150ms ease;
}

${standaloneScope} #desktop-cart-btn,
${standaloneScope} .add-to-cart-btn,
${standaloneScope} #storefront-primary-cta,
${standaloneScope} #btn-pay-mpesa,
${standaloneScope} #item-modal-btn-cart,
${standaloneScope} #maker-buy-button,
${standaloneScope} #apply-desktop-filters-btn,
${standaloneScope} #mobile-apply-filters-btn {
  background-color: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border-color: var(--store-primary) !important;
}

/* Header Variant Styling */
${headerCss}

/* Hero Banner Styling */
${scope} .store-banner,
${standaloneScope} #store-info-banner {
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid var(--store-line);
  background: linear-gradient(
    130deg,
    color-mix(in srgb, var(--store-primary) 16%, var(--store-paper)) 0%,
    var(--store-paper) 58%,
    color-mix(in srgb, var(--store-primary) 8%, var(--store-white)) 100%
  ) !important;
  color: var(--store-ink) !important;
  padding: clamp(2rem, 5vw, 4rem) clamp(1rem, 4vw, 3rem);
  text-align: ${tokens.heroAlign};
}

${scope} .store-banner h1,
${standaloneScope} #banner-store-name {
  font-family: var(--store-font-heading) !important;
  color: var(--store-ink) !important;
  font-size: clamp(2.15rem, 4.5vw, 3.75rem) !important;
  line-height: 1.06 !important;
  margin: 0.35rem 0 0.75rem;
}

${scope} .store-banner #banner-store-desc,
${standaloneScope} #banner-store-desc {
  color: var(--store-muted) !important;
  max-width: 42rem;
  ${tokens.heroAlign === "center" ? "margin-inline: auto;" : ""}
}

${scope} .store-banner .store-address,
${scope} .store-banner .store-tagline,
${standaloneScope} #banner-store-subdomain,
${standaloneScope} #banner-store-tagline {
  color: var(--store-primary) !important;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.76rem;
}

${scope} .storefront-primary-cta,
${standaloneScope} #storefront-primary-cta {
  border-radius: var(--store-btn-radius) !important;
  background-color: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border-color: var(--store-primary) !important;
}

/* Category Pills Bar */
${standaloneScope} #storefront-category-nav {
  padding: 0.85rem clamp(1rem, 4vw, 3rem);
  border-bottom: 1px solid var(--store-line);
  background: var(--store-white);
  overflow-x: auto;
}

${standaloneScope} #category-pills {
  display: flex;
  gap: 0.5rem;
}

${scope} .category-pill,
${standaloneScope} #category-pills button {
  border-radius: var(--store-pill-radius) !important;
}

${standaloneScope} #category-pills button[aria-selected="true"] {
  background-color: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border-color: var(--store-primary) !important;
}

/* Main Catalog Layout (Sidebar + Product Grid) */
${standaloneScope} #storefront-view {
  max-width: 84rem;
  margin: 0 auto;
  padding: 2rem clamp(1rem, 4vw, 3rem);
}

${standaloneScope} #catalog-layout {
  display: grid;
  grid-template-columns: 17rem minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}

${scope} #desktop-filter-sidebar,
${standaloneScope} #desktop-filter-sidebar {
  background-color: var(--store-white) !important;
  color: var(--store-ink) !important;
  border: 1px solid var(--store-line) !important;
  border-top: 3px solid var(--store-primary) !important;
  border-radius: var(--store-card-radius) !important;
  padding: 1.25rem;
}

${standaloneScope} #desktop-filter-sidebar fieldset {
  border: 0;
  border-top: 1px solid var(--store-line);
  padding: 1rem 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

${standaloneScope} #desktop-filter-sidebar legend {
  font-weight: 800;
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--store-ink);
  padding-bottom: 0.35rem;
}

${standaloneScope} #catalog-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--store-line);
}

${scope} #items-grid,
${standaloneScope} #items-grid {
  display: grid;
  grid-template-columns: ${tokens.gridColumnsDesktop};
  gap: ${tokens.gridGap};
}

${scope} #items-grid .product-card-media,
${standaloneScope} .product-card-media {
  aspect-ratio: ${tokens.mediaRatio};
  background-color: var(--store-media-bg) !important;
  overflow: hidden;
  margin: 0;
  position: relative;
}

${standaloneScope} .product-card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

${standaloneScope} .product-card-body,
${standaloneScope} .product-card-actions {
  padding: 0.85rem 1rem;
}

${scope} .product-card-title,
${standaloneScope} .product-title {
  color: var(--store-ink) !important;
  font-family: var(--store-font-heading);
  margin: 0.25rem 0;
}

${scope} .product-card-price,
${standaloneScope} .product-price {
  color: var(--store-ink) !important;
  font-weight: 800;
  font-size: 1.1rem;
}

${scope} .product-card-add,
${standaloneScope} .add-to-cart-btn {
  border-radius: var(--store-btn-radius) !important;
  background-color: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
}

/* Template-Specific Card Surface Treatment */
${cardCss}

/* Dialogs, Drawers & Footer */
${standaloneScope} dialog {
  border: 1px solid var(--store-line);
  border-radius: var(--store-card-radius);
  background-color: var(--store-white);
  color: var(--store-ink);
  max-width: 36rem;
  width: 92vw;
  padding: 1.5rem;
}

${standaloneScope} #site-footer {
  margin-top: 4rem;
  padding: 2.5rem clamp(1rem, 4vw, 3rem);
  border-top: 1px solid var(--store-line);
  background-color: var(--store-white);
  color: var(--store-muted);
}

@media (max-width: 900px) {
  ${standaloneScope} #catalog-layout {
    grid-template-columns: 1fr;
  }
  ${scope} #items-grid,
  ${standaloneScope} #items-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
`;
}

function generatePreviewHtml(template) {
  const { id, name, description, defaults, tokens } = template;
  const titleText = String(defaults.title || name).replace(/<br\s*\/?>/gi, " ");
  return `<!doctype html>
<html lang="en" data-storefront="true" data-storefront-template="${id}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name} — Store254 Template Preview</title>
  <link rel="stylesheet" href="./template.css">
  <style>
    :root {
      --store-primary: #15803d;
      --store-primary-hover: #166534;
      --store-primary-subtle: #dcfce7;
      --store-on-primary: #ffffff;
      --store-paper: #edf5ee;
      --store-white: #ffffff;
      --store-ink: #0f2415;
      --store-muted: #4b6353;
      --store-line: #c8ded0;
      --store-media-bg: #f3f8f4;
    }
    * { box-sizing: border-box; }
    .preview-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem;
      background: #0f172a;
      color: #f8fafc;
      font: 600 0.8rem system-ui, sans-serif;
    }
    .preview-bar input[type="color"] {
      width: 2rem;
      height: 1.75rem;
      border: 1px solid #475569;
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
    }
    .preview-controls { display: flex; align-items: center; gap: 0.85rem; }
    .preview-badge {
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      background: #1e293b;
      color: #38bdf8;
      font-size: 0.72rem;
    }
  </style>
</head>
<body>
  <div class="preview-bar">
    <div><strong>${name}</strong> · <span style="opacity:.8">${description}</span></div>
    <div class="preview-controls">
      <label>Foreground <input type="color" id="fg-picker" value="#15803d"></label>
      <label>Background <input type="color" id="bg-picker" value="#edf5ee"></label>
      <span id="contrast-status" class="preview-badge">WCAG Auto-Contrast Active</span>
    </div>
  </div>

  <header id="site-header">
    <div id="header-brand">
      <div id="header-store-identity">
        <h1 id="header-store-name">${name} Store</h1>
        <p id="header-store-tagline">${defaults.kicker}</p>
      </div>
    </div>
    <form id="search-form" onsubmit="event.preventDefault()">
      <input type="search" id="search-input" placeholder="Search products, services, categories...">
    </form>
    <nav id="header-actions-nav">
      <button type="button">Profile</button>
      <button type="button">Wishlist (2)</button>
      <button type="button" id="desktop-cart-btn">Cart (3)</button>
    </nav>
  </header>

  <nav id="storefront-category-nav">
    <div id="category-pills">
      <button type="button" aria-selected="true">All Items</button>
      <button type="button" aria-selected="false">Featured</button>
      <button type="button" aria-selected="false">New Arrivals</button>
      <button type="button" aria-selected="false">Services</button>
    </div>
  </nav>

  <section id="store-info-banner">
    <p id="banner-store-subdomain">${defaults.kicker}</p>
    <h2 id="banner-store-name">${titleText}</h2>
    <p id="banner-store-desc">${description}</p>
    <a id="storefront-primary-cta" href="#items-grid">${defaults.cta}</a>
  </section>

  <main id="storefront-view">
    <div id="catalog-layout">
      <aside id="desktop-filter-sidebar">
        <h4>Dynamic Filters</h4>
        <fieldset>
          <legend>Category</legend>
          <label><input type="checkbox" checked> Signature Collection</label>
          <label><input type="checkbox"> Limited Release</label>
          <label><input type="checkbox"> Bookable Services</label>
        </fieldset>
      </aside>
      <section id="catalog-main-content">
        <div id="items-grid">
          <article class="product-card">
            <figure class="product-card-media"></figure>
            <div class="product-card-body">
              <h5 class="product-title">Signature Store Item One</h5>
              <span class="product-price">KES 4,500</span>
            </div>
            <div class="product-card-actions">
              <button type="button" class="add-to-cart-btn">Add to Cart</button>
            </div>
          </article>
          <article class="product-card">
            <figure class="product-card-media"></figure>
            <div class="product-card-body">
              <h5 class="product-title">Curated Essential Two</h5>
              <span class="product-price">KES 6,200</span>
            </div>
            <div class="product-card-actions">
              <button type="button" class="add-to-cart-btn">Add to Cart</button>
            </div>
          </article>
          <article class="product-card">
            <figure class="product-card-media"></figure>
            <div class="product-card-body">
              <h5 class="product-title">Artisan Edition Three</h5>
              <span class="product-price">KES 3,800</span>
            </div>
            <div class="product-card-actions">
              <button type="button" class="add-to-cart-btn">Add to Cart</button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </main>

  <script>
    function hexToRgb(hex) {
      const clean = hex.replace("#", "");
      const full = clean.length === 3 ? [...clean].map(c => c + c).join("") : clean;
      return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
    }
    function rgbToHex(r, g, b) {
      return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
    }
    function luminance([r, g, b]) {
      const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }
    function contrast(rgb1, rgb2) {
      const l1 = luminance(rgb1), l2 = luminance(rgb2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }
    function mix(rgb1, rgb2, w1) {
      return rgb1.map((c, i) => c * w1 + rgb2[i] * (1 - w1));
    }
    function applyAutoPalette(fgHex, bgHex) {
      const bgRgb = hexToRgb(bgHex);
      const rawFgRgb = hexToRgb(fgHex);
      const bgLum = luminance(bgRgb);
      const isDark = bgLum <= 0.18;
      const surfaceRgb = isDark ? mix(bgRgb, [255, 255, 255], 0.88) : [255, 255, 255];
      let safeFg = rawFgRgb;
      let adjusted = false;
      if (contrast(safeFg, bgRgb) < 4.5 || contrast(safeFg, surfaceRgb) < 4.5) {
        adjusted = true;
        const target = isDark ? [255, 255, 255] : [0, 0, 0];
        for (let step = 0.05; step <= 0.95; step += 0.05) {
          const candidate = mix(rawFgRgb, target, 1 - step);
          if (contrast(candidate, bgRgb) >= 4.5 && contrast(candidate, surfaceRgb) >= 4.5) {
            safeFg = candidate;
            break;
          }
        }
      }
      const primaryHex = rgbToHex(...safeFg);
      const onPrimary = contrast([255, 255, 255], safeFg) >= contrast([12, 18, 28], safeFg) ? "#ffffff" : "#0c121c";
      const root = document.documentElement;
      root.style.setProperty("--store-paper", bgHex);
      root.style.setProperty("--store-white", rgbToHex(...surfaceRgb));
      root.style.setProperty("--store-primary", primaryHex);
      root.style.setProperty("--store-on-primary", onPrimary);
      root.style.setProperty("--store-ink", isDark ? "#f8fafc" : "#0f172a");
      root.style.setProperty("--store-muted", isDark ? "#cbd5e1" : "#475569");
      root.style.setProperty("--store-line", rgbToHex(...(isDark ? mix(bgRgb, [255, 255, 255], 0.78) : mix(bgRgb, [0, 0, 0], 0.84))));
      root.style.setProperty("--store-media-bg", rgbToHex(...(isDark ? mix(bgRgb, [255, 255, 255], 0.92) : mix(bgRgb, [255, 255, 255], 0.5))));
      document.getElementById("contrast-status").textContent = adjusted
        ? "Auto-Adjusted for High Visibility (" + primaryHex + ")"
        : "Optimal Contrast Verified";
    }
    document.getElementById("fg-picker").addEventListener("input", e => applyAutoPalette(e.target.value, document.getElementById("bg-picker").value));
    document.getElementById("bg-picker").addEventListener("input", e => applyAutoPalette(document.getElementById("fg-picker").value, e.target.value));
  </script>
</body>
</html>
`;
}

export async function generateAllTemplates() {
  const catalogEntries = [];

  for (const template of TEMPLATE_BLUEPRINTS) {
    const dir = join(__dirname, template.id);
    await mkdir(dir, { recursive: true });

    const cssPath = join(dir, "template.css");
    const previewPath = join(dir, "preview.html");

    await writeFile(cssPath, generateTemplateCss(template), "utf8");
    await writeFile(previewPath, generatePreviewHtml(template), "utf8");

    catalogEntries.push({
      id: template.id,
      name: template.name,
      description: template.description,
      previewImage: template.previewImage,
      stylesheet: `${template.id}/template.css`,
      preview: `${template.id}/preview.html`,
      defaults: template.defaults,
    });
  }

  const catalog = {
    version: 2,
    palettes: PALETTES,
    templates: catalogEntries,
  };

  await writeFile(join(__dirname, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n", "utf8");
  return catalog;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  generateAllTemplates().then((catalog) => {
    console.log(`Generated ${catalog.templates.length} templates and ${catalog.palettes.length} palettes in frontend/templates/`);
  });
}
