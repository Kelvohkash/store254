// Store / Tenant Loading
async function loadStoreProfile() {
  const storeInfoBanner = document.getElementById("store-info-banner");

  if (!state.activeTenantSlug) {
    // Root Platform Mode (store254.co.ke)
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
    document.getElementById("storefront-loading-screen")?.classList.add("hidden");
    document.documentElement.removeAttribute("data-storefront-pending");
    document.getElementById("storefront-view")?.classList.remove("hidden");
    syncStorefrontStickyOffset();
    updateWishlistButton();
  } else {
    const reason = res.data?.error?.message;
    const isSuspended = res.data?.error?.code === "TENANT_SUSPENDED";
    // Keep tenant hosts in storefront mode even when the store is unavailable.
    // Falling back to the platform homepage makes a store URL appear to change
    // websites during refreshes or temporary API failures.
    state.activeTenant = null;
    document.documentElement.setAttribute("data-storefront", "true");
    document.getElementById("platform-hero")?.classList.add("hidden");
    document.getElementById("storefront-loading-screen")?.classList.add("hidden");
    document.documentElement.removeAttribute("data-storefront-pending");
    document.getElementById("storefront-view")?.classList.remove("hidden");
    document.getElementById("store-admin-footer-btn")?.classList.remove("hidden");
    if (isSuspended) {
      document.documentElement.setAttribute("data-storefront-suspended", "true");
      setHeaderLogo(DEFAULT_STORE_LOGO, "Store254");
      document.getElementById("store-admin-footer-btn")?.classList.add("hidden");
      document.getElementById("whatsapp-quick-contact")?.classList.add("hidden");
      const storefront = document.getElementById("storefront-view");
      if (storefront) {
        storefront.innerHTML = `
          <section class="storefront-maintenance" aria-labelledby="maintenance-title" role="status">
            <div class="storefront-maintenance-art" aria-hidden="true">
              <span class="maintenance-orbit maintenance-orbit-one"></span>
              <span class="maintenance-orbit maintenance-orbit-two"></span>
              <span class="maintenance-spark maintenance-spark-one">✦</span>
              <span class="maintenance-spark maintenance-spark-two">✦</span>
              <div class="maintenance-toolbox"><i data-lucide="wrench"></i></div>
            </div>
            <p class="storefront-maintenance-eyebrow">A little pause while we fix things</p>
            <h1 id="maintenance-title">We’re having technical difficulties</h1>
            <p class="storefront-maintenance-copy">This store is taking a short break while we work behind the scenes. We’ll be back soon, so please check in again shortly.</p>
            <div class="storefront-maintenance-status"><span></span> Our team is on it</div>
            <button type="button" class="storefront-maintenance-retry" onclick="window.location.reload()"><i data-lucide="refresh-cw"></i> Check again</button>
            <p class="storefront-maintenance-signoff">Thanks for your patience <span aria-hidden="true">♥</span></p>
          </section>`;
      }
    } else {
      showToast(reason || `We couldn’t load the ${state.activeTenantSlug} storefront. Please try again shortly.`, "error");
    }
    const catalog = document.getElementById("items-grid");
    if (!isSuspended && catalog) {
      catalog.innerHTML = `
        <div class="col-span-full rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
          <h2 class="text-lg font-bold text-slate-900">This storefront is temporarily unavailable</h2>
          <p class="mt-2 text-sm text-slate-500">Please try again in a moment.</p>
          <button type="button" onclick="window.location.reload()" class="mt-5 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Try again</button>
        </div>`;
    }
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

function syncStorefrontStickyOffset() {
  const header = document.querySelector(".site-header, #site-header");
  const height = header?.getBoundingClientRect().height || 72;
  document.documentElement.style.setProperty("--storefront-sticky-offset", `${Math.ceil(height)}px`);
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

window.addEventListener("resize", syncStorefrontStickyOffset, { passive: true });
