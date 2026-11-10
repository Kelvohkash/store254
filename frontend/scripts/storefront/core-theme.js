// Theme Palette & Layout Engine
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
    || catalog.templates.find((entry) => entry.id === "fashion-and-design")
    || { id: "fashion-and-design", defaults: {} };
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
