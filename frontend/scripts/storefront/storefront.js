// Store / Tenant Loading
async function loadStoreProfile() {
  const storeInfoBanner = document.getElementById("store-info-banner");

  if (!state.activeTenantSlug) {
    // Root Platform Mode (store254.co.ke)
    setCatalogPinned(false);
    document.documentElement.removeAttribute("data-storefront");
    document.documentElement.removeAttribute("data-product-image-ratio");
    document.documentElement.removeAttribute("data-card-density");
    document.documentElement.removeAttribute("data-heading-font");
    document.documentElement.removeAttribute("data-hero-style");
    document.documentElement.removeAttribute("data-hero-focal-point");
    document.documentElement.removeAttribute("data-header-variant");
    document.documentElement.removeAttribute("data-product-card-style");
    document.documentElement.removeAttribute("data-storefront-type");
    document.getElementById("active-storefront-styles")?.remove();
    [
      "--store-primary",
      "--store-primary-hover",
      "--store-primary-subtle",
      "--store-primary-soft",
      "--store-primary-glow",
      "--store-on-primary",
      "--store-paper",
      "--store-white",
      "--store-surface-subtle",
      "--store-ink",
      "--store-muted",
      "--store-line",
      "--store-media-bg",
      "--store-green",
      "--store-green-dark",
      "--store-trust-blue",
      "--store-trust-blue-dark",
      "--store-trust-blue-bg",
      "--store-trust-blue-line",
      "--store-clay",
    ].forEach((name) => document.documentElement.style.removeProperty(name));
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
  // Platform onboarding controls do not belong in a merchant storefront.
  document.querySelector(".platform-nav-links")?.remove();
  document.getElementById("platform-mobile-menu")?.remove();
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
    await applyStorefrontSettings(state.activeTenant.settings);
    await loadCategories();
    renderStoreBanner();
    document.getElementById("storefront-view")?.classList.remove("hidden");
    scheduleCatalogPinCheck();
    updateWishlistButton();
  } else {
    const reason = res.data?.error?.message;
    showToast(reason || `We couldn’t load the ${state.activeTenantSlug} storefront. Please try again shortly.`, "error");
    // Fallback to platform mode
    state.activeTenant = null;
    setCatalogPinned(false);
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
  if (typeof syncSearchClearButtons === "function") syncSearchClearButtons();
  debouncedLoadItems();
}

function toggleDesktopFilters(forceOpen) {
  if (typeof toggleDesktopFilterDrawer === "function") {
    toggleDesktopFilterDrawer(forceOpen);
  }
}

let catalogPinCheckScheduled = false;

function setCatalogPinned(pinned) {
  const root = document.documentElement;
  const main = document.getElementById("storefront-view");
  const spacer = document.getElementById("catalog-pin-spacer");
  if (!main) return;

  if (pinned) {
    if (root.dataset.catalogPinned === "true") return;
    const height = main.getBoundingClientRect().height;
    const placeholder = document.createElement("div");
    placeholder.id = "catalog-pin-spacer";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.style.cssText = `display:block;flex:0 0 auto;width:100%;height:${height}px;`;
    main.parentNode?.insertBefore(placeholder, main);

    const header = document.querySelector(".site-header");
    const categoryBar = document.getElementById("storefront-main-category-bar");
    const headerBottom = header?.getBoundingClientRect().bottom || 0;
    const categoryOffset = categoryBar && main.contains(categoryBar)
      ? categoryBar.getBoundingClientRect().top - main.getBoundingClientRect().top
      : 0;
    root.style.setProperty("--catalog-pin-top", `${headerBottom - categoryOffset}px`);
    root.dataset.catalogPinned = "true";
    main.dataset.catalogPinned = "true";
    return;
  }

  delete root.dataset.catalogPinned;
  root.style.removeProperty("--catalog-pin-top");
  delete main.dataset.catalogPinned;
  spacer?.remove();
}

function syncCatalogPin() {
  catalogPinCheckScheduled = false;
  const root = document.documentElement;
  const main = document.getElementById("storefront-view");
  const categoryBar = document.getElementById("storefront-main-category-bar");
  if (root.dataset.catalogPinned === "true") return;

  if (
    root.dataset.storefront !== "true" ||
    window.innerWidth < 1024 ||
    !main ||
    main.classList.contains("hidden") ||
    !categoryBar
  ) return;

  const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom || 0;
  if (categoryBar.getBoundingClientRect().top <= headerBottom + 1) {
    setCatalogPinned(true);
  }
}

function scheduleCatalogPinCheck() {
  if (catalogPinCheckScheduled) return;
  catalogPinCheckScheduled = true;
  window.requestAnimationFrame(syncCatalogPin);
}

function handlePinnedCatalogWheel(event) {
  if (document.documentElement.dataset.catalogPinned !== "true" || event.ctrlKey) return;
  if (event.target.closest?.(".filter-popover-card, #desktop-filter-drawer, input, select, textarea")) return;

  const grid = document.getElementById("items-grid");
  if (!grid) return;
  const multiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 16
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? window.innerHeight
      : 1;
  const delta = event.deltaY * multiplier;
  event.preventDefault();

  if (delta < 0 && grid.scrollTop <= 0) {
    setCatalogPinned(false);
    window.scrollTo(0, Math.max(0, window.scrollY + delta));
    return;
  }

  grid.scrollTop += delta;
}

function toggleMobileFilters(show) {
  const drawer = document.getElementById("mobile-filter-drawer");
  if (!drawer) return;
  if (show === undefined) {
    drawer.classList.toggle("hidden");
  } else if (show) {
    drawer.classList.remove("hidden");
    if (typeof renderDynamicFiltersUI === "function") renderDynamicFiltersUI();
    if (typeof renderCategoryNavigation === "function") renderCategoryNavigation();
    const desktopSort = document.getElementById("sort-selector");
    if (desktopSort && typeof syncSortControls === "function") {
      syncSortControls(desktopSort.value);
    }
    renderIcons(drawer);
  } else {
    drawer.classList.add("hidden");
  }
}

function syncMobilePrice(val) {
  const numeric = Number(val) || 0;
  const maxBound = Number(state.priceRange?.max) || 200000;
  state.selectedPriceRange.max = numeric;
  state.priceFilterActive = numeric < maxBound;
  const maxEl = document.getElementById("price-filter-max");
  const label = document.getElementById("mobile-price-val");
  const pcMaxLabel = document.getElementById("price-label-max");
  if (maxEl) maxEl.value = String(numeric);
  if (label) {
    label.textContent = state.priceFilterActive
      ? `Up to KES ${numeric.toLocaleString()}`
      : `KES ${numeric.toLocaleString()}`;
  }
  if (pcMaxLabel) pcMaxLabel.textContent = `KES ${numeric.toLocaleString()}`;
  if (typeof renderPricePresets === "function") renderPricePresets();
  loadItems();
}

function syncMobileSort(val) {
  if (typeof syncSortControls === "function") {
    syncSortControls(val);
  } else {
    const desktopSort = document.getElementById("sort-selector");
    if (desktopSort) desktopSort.value = val;
  }
  loadItems();
}

window.addEventListener("scroll", scheduleCatalogPinCheck, { passive: true });
window.addEventListener("resize", () => {
  if (window.innerWidth < 1024) setCatalogPinned(false);
  else scheduleCatalogPinCheck();
});
window.addEventListener("wheel", handlePinnedCatalogWheel, { passive: false });
