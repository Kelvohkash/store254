// Storefront Banner & Branding

function renderBannerStoreAvatar(settings = {}) {
  const avatarEl = document.getElementById("banner-store-avatar");
  if (!avatarEl || !state.activeTenant) return;

  const storeName = String(state.activeTenant.name || state.activeTenant.subdomain || "Store").trim();
  const initial = (storeName.slice(0, 1) || "S").toUpperCase();
  const rawLogo = String(settings.logoUrl || "").trim();

  avatarEl.replaceChildren();
  avatarEl.classList.remove("has-logo");

  if (rawLogo) {
    try {
      const url = new URL(rawLogo, window.location.origin);
      if (url.protocol === "https:" || url.protocol === "http:") {
        const img = document.createElement("img");
        img.src = url.href;
        img.alt = storeName;
        img.className = "store-hero-avatar-img";
        img.loading = "eager";
        img.decoding = "async";
        img.onerror = () => {
          avatarEl.classList.remove("has-logo");
          avatarEl.textContent = initial;
        };
        avatarEl.classList.add("has-logo");
        avatarEl.appendChild(img);
        return;
      }
    } catch {
      // Fall back to monogram initial if logoUrl is malformed.
    }
  }

  avatarEl.textContent = initial;
}

function renderStoreBanner() {
  const banner = document.getElementById("store-info-banner");
  if (!banner || !state.activeTenant) return;

  banner.classList.remove("hidden");
  const settings = state.activeTenant.settings || {};

  document.getElementById("banner-store-name").textContent = state.activeTenant.name;
  document.getElementById("banner-store-subdomain").textContent = `${state.activeTenant.subdomain}.store254.co.ke`;
  renderBannerStoreAvatar(settings);

  const rawTagline = String(settings.tagline || "").trim();
  const rawDesc = String(settings.description || "").trim();
  const tagline = document.getElementById("banner-store-tagline");
  if (tagline) {
    tagline.textContent = rawTagline;
    tagline.classList.toggle("hidden", !rawTagline);
  }

  const isDuplicateDesc =
    Boolean(rawTagline) && rawDesc.toLowerCase() === rawTagline.toLowerCase();
  const locationParts = [
    state.activeTenant.locationName || settings.locationName || "",
    state.activeTenant.countyName || settings.countyName || "",
  ].filter(Boolean);
  const uniqueLocation = [...new Set(locationParts)].join(", ");
  const fallbackDesc = uniqueLocation
    ? `Serving ${uniqueLocation} — shop verified products & services with instant M-Pesa checkout.`
    : `Explore authentic products & services from ${state.activeTenant.name} with instant M-Pesa checkout.`;
  document.getElementById("banner-store-desc").textContent =
    rawDesc && !isDuplicateDesc ? rawDesc : fallbackDesc;

  setStoreBannerBackground(banner, settings.bannerUrl, settings.logoUrl);
  renderArchetypeContent(settings);

  const callBtn = document.getElementById("banner-store-call-btn");
  const phoneText = document.getElementById("banner-store-phone-text");
  const actionsWrap = banner.querySelector(".store-banner-actions");
  const rawPhone = String(settings.contactPhone || settings.phone || "").trim();
  const showCallBtn = Boolean(rawPhone && callBtn && phoneText && settings.sectionVisibility?.contactActions !== false);
  if (showCallBtn) {
    callBtn.href = `tel:${rawPhone}`;
    phoneText.textContent = `Call ${rawPhone}`;
    callBtn.setAttribute("title", `Call ${rawPhone}`);
    callBtn.setAttribute("aria-label", `Call ${state.activeTenant.name} at ${rawPhone}`);
    callBtn.classList.remove("hidden");
  } else if (callBtn) {
    callBtn.classList.add("hidden");
  }
  if (actionsWrap) {
    actionsWrap.classList.toggle("has-call-btn", showCallBtn);
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

  // Update browser tab title unless viewing an individual product/service route
  if (!state.currentItemSlug && !state.initialItemSlug) {
    document.title = `${state.activeTenant.name} • Store254`;
  }

  if (typeof window.syncStorefrontFollowButton === "function") {
    window.syncStorefrontFollowButton();
  }

  renderIcons();
}

function toggleActiveStoreFollow(event) {
  if (!state?.activeTenant || typeof window.toggleFollowStore !== "function") return;
  const settings = state.activeTenant.settings || {};
  const loc = [state.activeTenant.locationName || settings.locationName, state.activeTenant.countyName || settings.countyName]
    .filter(Boolean)
    .join(", ");
  window.toggleFollowStore(
    {
      id: state.activeTenant.id || "",
      subdomain: state.activeTenant.subdomain || "",
      name: state.activeTenant.name || state.activeTenant.subdomain || "Store",
      businessType: state.activeTenant.businessType || "GENERAL",
      logoUrl: settings.logoUrl || "",
      locationLabel: loc,
    },
    event
  );
}
window.toggleActiveStoreFollow = toggleActiveStoreFollow;

function renderFooterBrand(storeName) {
  const platformCopy = document.getElementById("footer-platform-copy");
  const storeNameElement = document.getElementById("footer-store-name");
  const poweredBy = document.getElementById("footer-powered-by");
  const directoryLink = document.getElementById("footer-directory-link");
  const aboutLink = document.getElementById("footer-about-link");
  const isStorefront = Boolean(storeName);

  if (platformCopy) platformCopy.classList.toggle("hidden", isStorefront);
  if (aboutLink) aboutLink.classList.toggle("hidden", isStorefront);
  if (storeNameElement) {
    storeNameElement.textContent = storeName || "";
    storeNameElement.classList.toggle("hidden", !isStorefront);
  }
  poweredBy?.classList.toggle("hidden", !isStorefront);
  if (directoryLink) {
    directoryLink.classList.toggle("hidden", !isStorefront);
    const bizType = String(state.activeTenant?.businessType || "").toLowerCase();
    const validTypes = ["retail", "electronics", "furniture", "services", "general"];
    if (isStorefront && validTypes.includes(bizType)) {
      directoryLink.href = `https://store254.co.ke/directory/${bizType}`;
      const label = bizType.charAt(0).toUpperCase() + bizType.slice(1);
      directoryLink.textContent = `More ${label} Stores`;
    } else if (isStorefront) {
      directoryLink.href = "https://store254.co.ke/directory";
      directoryLink.textContent = "Store254 Directory";
    }
  }
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

function setStoreBannerBackground(banner, imageUrl, fallbackLogoUrl = "") {
  const requestToken = String((Number(banner.dataset.bannerToken || 0)) + 1);
  banner.dataset.bannerToken = requestToken;
  banner.style.removeProperty("--store-banner-image");
  banner.style.setProperty("--store-banner-position", ({ left: "28% center", right: "72% center", top: "center 28%", center: "center" })[state.activeTenant?.settings?.heroFocalPoint] || "center");
  banner.classList.remove("has-banner-image");

  const primaryUrl = String(imageUrl || "").trim();
  const fallbackUrl = String(fallbackLogoUrl || "").trim();
  const heroImageUrl = primaryUrl || fallbackUrl;
  if (!heroImageUrl) return;

  const applyUrl = (candidateUrl, onFailure) => {
    try {
      const url = new URL(candidateUrl, window.location.origin);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("Store banner image URL must use HTTP or HTTPS.");
      }
      const safeCssUrl = url.href.replace(/["\\()\r\n]/g, encodeURIComponent);
      banner.style.setProperty("--store-banner-image", `url("${safeCssUrl}")`);
      banner.classList.add("has-banner-image");

      const probe = new Image();
      probe.onload = () => {
        if (banner.dataset.bannerToken !== requestToken) return;
        banner.classList.add("has-banner-image");
      };
      probe.onerror = () => {
        if (banner.dataset.bannerToken !== requestToken) return;
        if (typeof onFailure === "function") {
          onFailure();
        } else {
          banner.style.removeProperty("--store-banner-image");
          banner.classList.remove("has-banner-image");
        }
      };
      probe.src = url.href;
    } catch (error) {
      console.error("[Store branding] Invalid banner image URL:", error);
      if (typeof onFailure === "function") onFailure();
    }
  };

  applyUrl(heroImageUrl, () => {
    if (primaryUrl && fallbackUrl && fallbackUrl !== primaryUrl) {
      applyUrl(fallbackUrl);
    } else {
      banner.style.removeProperty("--store-banner-image");
      banner.classList.remove("has-banner-image");
    }
  });
}
