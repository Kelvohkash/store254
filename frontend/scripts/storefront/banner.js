// Storefront Banner & Branding

function renderStoreBanner() {
  const banner = document.getElementById("store-info-banner");
  if (!banner || !state.activeTenant) return;

  banner.classList.remove("hidden");
  const settings = state.activeTenant.settings || {};

  document.getElementById("banner-store-name").textContent = state.activeTenant.name;
  document.getElementById("banner-store-subdomain").textContent = `${state.activeTenant.subdomain}.store254.co.ke`;
  const tagline = document.getElementById("banner-store-tagline");
  if (tagline) {
    tagline.textContent = settings.tagline || "";
    tagline.classList.toggle("hidden", !settings.tagline);
  }
  document.getElementById("banner-store-desc").textContent =
    settings.description || `Welcome to ${state.activeTenant.name} on Store254`;

  setStoreBannerBackground(banner, settings.bannerUrl);
  renderArchetypeContent(settings);

  const callBtn = document.getElementById("banner-store-call-btn");
  const phoneText = document.getElementById("banner-store-phone-text");
  const phone = settings.contactPhone || settings.phone;
  if (phone && callBtn && phoneText && settings.sectionVisibility?.contactActions !== false) {
    callBtn.href = `tel:${phone}`;
    phoneText.textContent = `Call ${phone}`;
    callBtn.classList.remove("hidden");
  } else if (callBtn) {
    callBtn.classList.add("hidden");
  }

  setHeaderLogo(settings.logoUrl || DEFAULT_STOREFRONT_LOGO, state.activeTenant.name, DEFAULT_STOREFRONT_LOGO);
  const headerStoreIdentity = document.getElementById("header-store-identity");
  const headerStoreName = document.getElementById("header-store-name");
  if (headerStoreName) {
    headerStoreName.textContent = state.activeTenant.name;
  }
  headerStoreIdentity?.classList.remove("hidden");
  renderFooterBrand(state.activeTenant.name);

  renderStoreSocialLinks(settings.socialLinks);
  renderStorefrontContact(settings);

  // Update browser tab title
  document.title = `${state.activeTenant.name} • Store254`;

  renderIcons();
}

function renderFooterBrand(storeName) {
  const platformCopy = document.getElementById("footer-platform-copy");
  const storeNameElement = document.getElementById("footer-store-name");
  const poweredBy = document.getElementById("footer-powered-by");
  const isStorefront = Boolean(storeName);

  if (platformCopy) platformCopy.classList.toggle("hidden", isStorefront);
  if (storeNameElement) {
    storeNameElement.textContent = storeName || "";
    storeNameElement.classList.toggle("hidden", !isStorefront);
  }
  poweredBy?.classList.toggle("hidden", !isStorefront);
}

function renderArchetypeContent(settings) {
  const archetype = document.documentElement.dataset.storefrontType;
  const content = document.getElementById("storefront-content-intro");
  if (!content) return;

  const cta = document.getElementById("storefront-primary-cta");
  const ctaLabel = document.getElementById("storefront-primary-cta-label");
  const labels = {
    "modern-retailer": "Explore collection",
    "lifestyle-boutique": "Explore the collection",
    "single-product-maker": "Discover the product",
    "service-portfolio": "Book an appointment",
  };
  if (cta && ctaLabel) {
    ctaLabel.textContent = settings.ctaText || labels[archetype] || "Explore collection";
    cta.classList.remove("hidden");
  }

  const details = {
    "modern-retailer": {
      eyebrow: "Featured catalog",
      title: settings.tagline || "Everyday essentials, thoughtfully curated",
      copy: settings.description || `Browse verified products and services from ${state.activeTenant.name}.`,
    },
    "lifestyle-boutique": {
      eyebrow: "Curated collection",
      title: "Find your next favourite",
      copy: "Explore a considered edit of pieces from this collection.",
    },
    "single-product-maker": {
      eyebrow: "Made with purpose",
      title: settings.tagline || "The product, thoughtfully made",
      copy: settings.description || `Discover what makes ${state.activeTenant.name} different.`,
    },
    "service-portfolio": {
      eyebrow: "Services & packages",
      title: settings.tagline || "A service shaped around you",
      copy: settings.description || "Browse available services and choose a package that fits.",
    },
  }[archetype];

  content.classList.toggle("hidden", !details || settings.sectionVisibility?.collectionIntro === false);
  if (!details) return;

  document.getElementById("storefront-content-eyebrow").textContent = details.eyebrow;
  document.getElementById("storefront-content-title").textContent = details.title;
  document.getElementById("storefront-content-copy").textContent = details.copy;
}

function updateMakerBuyBar() {
  const bar = document.getElementById("maker-buy-bar");
  const item = state.items.find((product) => product.itemType !== "SERVICE");
  if (!bar) return;

  bar.classList.toggle(
    "hidden",
    document.documentElement.dataset.storefrontType !== "single-product-maker" || !item
  );
  if (!item) return;

  document.getElementById("maker-buy-title").textContent = item.title;
  document.getElementById("maker-buy-price").textContent = `KES ${Number(item.basePrice).toLocaleString()}`;
}

function buyFeaturedProduct() {
  const item = state.items.find((product) => product.itemType !== "SERVICE");
  if (!item) return;

  const image = item.images?.[0] || "";
  addToCart(item.id, item.title, item.basePrice, image, item.itemType);
  toggleDrawer("cart-drawer", true);
}

function setStoreBannerBackground(banner, imageUrl) {
  banner.style.removeProperty("--store-banner-image");
  banner.style.setProperty("--store-banner-position", ({ left: "28% center", right: "72% center", top: "center 28%", center: "center" })[state.activeTenant?.settings?.heroFocalPoint] || "center");
  banner.classList.remove("has-banner-image");
  if (!imageUrl) return;

  try {
    const url = new URL(imageUrl, window.location.origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Store banner image URL must use HTTP or HTTPS.");
    }
    banner.style.setProperty("--store-banner-image", `url("${url.href}")`);
    banner.classList.add("has-banner-image");
  } catch (error) {
    console.error("[Store branding] Invalid banner image URL:", error);
  }
}
