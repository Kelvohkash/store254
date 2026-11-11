// Every store shares one storefront design and can customize its accent colour.
async function applyStorefrontSettings(settings = {}) {
  const root = document.documentElement;
  root.dataset.storefrontType = "lifestyle-boutique";
  root.dataset.storefront = "true";
  root.dataset.productImageRatio = "square";
  root.dataset.cardDensity = "comfortable";
  root.dataset.headingFont = "editorial";
  root.dataset.heroStyle = "editorial";
  root.dataset.heroFocalPoint = "center";
  root.dataset.headerVariant = "centered-brand";
  root.dataset.productCardStyle = "grid-card";
  const accent = /^#[0-9a-f]{6}$/i.test(settings?.primaryColor || "") ? settings.primaryColor : "#9a3412";
  root.style.setProperty("--store-primary", accent);
  root.style.setProperty("--store-primary-hover", `color-mix(in srgb, ${accent} 80%, #000)`);
  root.style.setProperty("--store-primary-subtle", `color-mix(in srgb, ${accent} 14%, #fff)`);
  root.style.setProperty("--store-primary-glow", `color-mix(in srgb, ${accent} 26%, transparent)`);
  root.style.setProperty("--store-green", accent);
  root.style.setProperty("--store-green-dark", `color-mix(in srgb, ${accent} 80%, #000)`);
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
