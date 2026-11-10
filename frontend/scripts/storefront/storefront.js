// Store / Tenant Loading
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
    document.getElementById("active-storefront-template-styles")?.remove();
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
  if (typeof renderSkeletonCards === "function") renderSkeletonCards();
  const [res] = await Promise.all([
    apiFetch("/api/store"),
    loadCategories(),
    loadDynamicFilters(),
    loadItems(),
  ]);
  if (res.ok && res.data.success) {
    state.activeTenant = res.data.data;
    applyStorefrontSettings(state.activeTenant.settings);
    renderStoreBanner();
    updateWishlistButton();
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
      slide.dataset.stackPosition = String((slideIndex - activeIndex + slides.length) % slides.length);
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });
    dots.forEach((dot, dotIndex) => dot.setAttribute("aria-current", String(dotIndex === activeIndex)));
    const ownerLabel = document.getElementById("featured-store-owner");
    if (ownerLabel) ownerLabel.textContent = slides[activeIndex].dataset.ownerName || "Store owner";
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

// Sync mobile search input with main search
function syncMobileSearch(val) {
  const pcInput = document.getElementById("search-input");
  if (pcInput) pcInput.value = val;
  debouncedLoadItems();
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
