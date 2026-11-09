// 6. Store / Tenant Loading
async function loadStoreProfile() {
  const storeInfoBanner = document.getElementById("store-info-banner");

  if (!state.activeTenantSlug) {
    // Root Platform Mode (store254.co.ke)
    document.documentElement.removeAttribute("data-storefront");
    document.documentElement.removeAttribute("data-storefront-type");
    document.documentElement.removeAttribute("data-storefront-template");
    document.documentElement.removeAttribute("data-product-image-ratio");
    document.documentElement.removeAttribute("data-card-density");
    document.documentElement.removeAttribute("data-heading-font");
    document.documentElement.removeAttribute("data-hero-style");
    document.documentElement.removeAttribute("data-hero-focal-point");
    document.documentElement.removeAttribute("data-header-variant");
    document.documentElement.removeAttribute("data-product-card-style");
    document.documentElement.style.removeProperty("--store-primary");
    setThemePalette("trust-forest");
    state.activeTenant = null;
    if (storeInfoBanner) storeInfoBanner.classList.add("hidden");
    document.getElementById("platform-hero")?.classList.remove("hidden");
    document.getElementById("storefront-view")?.classList.add("hidden");
    setHeaderLogo();
    document.getElementById("header-platform-logo")?.classList.remove("hidden");
    const headerStoreIdentity = document.getElementById("header-store-identity");
    const headerStoreName = document.getElementById("header-store-name");
    if (headerStoreName) headerStoreName.textContent = "";
    headerStoreIdentity?.classList.add("hidden");
    renderFooterBrand();
    // The platform admin is kept on its own private entry point.
    document.getElementById("store-admin-footer-btn")?.classList.add("hidden");
    await loadPlatformStores();
    renderIcons();
    return;
  }

  // Subdomain Storefront Mode (e.g. alicebabycare.store254.co.ke)
  document.documentElement.setAttribute("data-storefront", "true");
  document.getElementById("platform-hero")?.classList.add("hidden");
  document.getElementById("storefront-view")?.classList.remove("hidden");
  // Show Store Admin button on store subdomains, NEVER show Super Admin
  document.getElementById("store-admin-footer-btn")?.classList.remove("hidden");
  const res = await apiFetch("/api/store");
  if (res.ok && res.data.success) {
    state.activeTenant = res.data.data;
    // Apply the store owner's configured theme palette for every visitor
    setThemePalette(state.activeTenant.settings?.themePalette);
    applyStorefrontSettings(state.activeTenant.settings);
    renderStoreBanner();
    updateWishlistButton();
    await Promise.all([loadCategories(), loadDynamicFilters()]);
    await loadItems();
  } else {
    const reason = res.data?.error?.message;
    showToast(reason || `We couldn’t load the ${state.activeTenantSlug} storefront. Please try again shortly.`, "error");
    // Fallback to platform mode
    state.activeTenant = null;
    setHeaderLogo();
    document.getElementById("header-platform-logo")?.classList.remove("hidden");
    document.getElementById("header-store-identity")?.classList.add("hidden");
    document.documentElement.removeAttribute("data-storefront");
    document.getElementById("store-admin-footer-btn")?.classList.add("hidden");
    document.getElementById("platform-hero")?.classList.remove("hidden");
    document.getElementById("storefront-view")?.classList.add("hidden");
    await loadPlatformStores();
  }

  renderIcons();
}

function initializeShowcaseCarousel() {
  const carousel = document.querySelector(".showcase-carousel");
  if (!carousel) return;
  const slides = [...carousel.querySelectorAll("[data-showcase-slide]")];
  const dots = [...document.querySelectorAll("[data-showcase-dot]")];
  if (slides.length < 2 || dots.length !== slides.length) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeIndex = slides.findIndex((slide) => slide.classList.contains("is-active"));
  let timer;

  const showSlide = (index) => {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === activeIndex;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });
    dots.forEach((dot, dotIndex) => dot.setAttribute("aria-current", String(dotIndex === activeIndex)));
  };
  const stop = () => {
    window.clearInterval(timer);
    timer = undefined;
  };
  const start = () => {
    stop();
    if (reducedMotion.matches || document.hidden) return;
    timer = window.setInterval(() => showSlide(activeIndex + 1), 5200);
  };

  dots.forEach((dot, index) => dot.addEventListener("click", () => {
    showSlide(index);
    start();
  }));
  carousel.addEventListener("mouseenter", stop);
  carousel.addEventListener("mouseleave", start);
  carousel.addEventListener("focusin", stop);
  carousel.addEventListener("focusout", (event) => {
    if (!carousel.contains(event.relatedTarget)) start();
  });
  document.addEventListener("visibilitychange", start);
  reducedMotion.addEventListener?.("change", start);
  showSlide(Math.max(activeIndex, 0));
  start();
}

// 7. Render Store Banner
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

  setHeaderLogo(settings.logoUrl || DEFAULT_STORE_LOGO, state.activeTenant.name);
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

  const details = {
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

  const cta = document.getElementById("storefront-primary-cta");
  const ctaLabel = document.getElementById("storefront-primary-cta-label");
  const labels = {
    "lifestyle-boutique": "Explore the collection",
    "single-product-maker": "Discover the product",
    "service-portfolio": "Book an appointment",
  };
  ctaLabel.textContent = labels[archetype] || "";
  cta.classList.remove("hidden");
}

function renderStorefrontContact(settings) {
  const contact = document.getElementById("whatsapp-quick-contact");
  const value = settings.socialLinks?.whatsapp;
  const href = getSocialLinkUrl("whatsapp", value);
  if (!contact) return;

  if (!href || settings.sectionVisibility?.contactActions === false) {
    contact.classList.add("hidden");
    contact.removeAttribute("href");
    return;
  }

  const url = new URL(href);
  url.searchParams.set("text", `Hi ${state.activeTenant.name}, I found your store on Store254.`);
  contact.href = url.href;
  contact.classList.remove("hidden");
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
    const url = new URL(imageUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Store banner image URL must use HTTP or HTTPS.");
    }
    banner.style.setProperty("--store-banner-image", `url("${url.href}")`);
    banner.classList.add("has-banner-image");
  } catch (error) {
    console.error("[Store branding] Invalid banner image URL:", error);
  }
}

function renderStoreSocialLinks(socialLinks = {}) {
  const container = document.getElementById("banner-social-links");
  if (!container) return;
  const links = socialLinks || {};

  if (state.activeTenant?.settings?.sectionVisibility?.socialLinks === false) {
    container.classList.add("hidden");
    container.replaceChildren();
    return;
  }

  const platforms = [
    ["instagram", "Instagram"],
    ["facebook", "Facebook"],
    ["tiktok", "TikTok"],
    ["twitter", "X"],
    ["whatsapp", "WhatsApp"],
  ];

  container.replaceChildren();
  for (const [platform, label] of platforms) {
    const href = getSocialLinkUrl(platform, links[platform]);
    if (!href) continue;

    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    container.appendChild(link);
  }

  container.classList.toggle("hidden", container.childElementCount === 0);
}

function getSocialLinkUrl(platform, value) {
  const input = String(value || "").trim();
  if (!input) return "";

  if (/^https?:\/\//i.test(input)) {
    try {
      const url = new URL(input);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch {
      return "";
    }
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(input)) return "";

  if (platform === "whatsapp") {
    const phone = input.replace(/\D/g, "");
    return phone ? `https://wa.me/${phone}` : "";
  }

  const handle = input.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
  const profiles = {
    instagram: "https://www.instagram.com/",
    facebook: "https://www.facebook.com/",
    tiktok: "https://www.tiktok.com/@",
    twitter: "https://x.com/",
  };
  const baseUrl = profiles[platform];
  return baseUrl && handle ? `${baseUrl}${encodeURIComponent(handle)}` : "";
}

// Sync mobile search input with main search
function syncMobileSearch(val) {
  const pcInput = document.getElementById("search-input");
  if (pcInput) pcInput.value = val;
  loadItems();
}

function toggleMobileFilters(show) {
  const drawer = document.getElementById("mobile-filter-drawer");
  if (!drawer) return;
  if (show === undefined) {
    drawer.classList.toggle("hidden");
  } else if (show) {
    drawer.classList.remove("hidden");
    // Clone facets into mobile view if not yet cloned
    const src = document.getElementById("dynamic-facets-container");
    const dest = document.getElementById("mobile-dynamic-facets");
    if (src && dest) {
      dest.innerHTML = src.innerHTML;
    }
  } else {
    drawer.classList.add("hidden");
  }
}

function syncMobilePrice(val) {
  const maxEl = document.getElementById("price-filter-max");
  const label = document.getElementById("mobile-price-val");
  const pcMaxLabel = document.getElementById("price-label-max");
  if (maxEl) maxEl.value = val;
  if (label) label.textContent = `KES ${Number(val).toLocaleString()}`;
  if (pcMaxLabel) pcMaxLabel.textContent = `KES ${Number(val).toLocaleString()}`;
}
