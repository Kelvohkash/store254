// Platform Store Showcase & Initialization

function renderFeaturedStoreShowcase(stores) {
  const carousel = document.getElementById("featured-store-showcase");
  const dotsContainer = document.getElementById("showcase-dots");
  const ownerLabel = document.getElementById("featured-store-owner");
  if (!carousel || !dotsContainer || !Array.isArray(stores)) return;

  const validStores = stores.filter((s) => s.subdomain);
  if (validStores.length === 0) return;

  carousel.replaceChildren();
  dotsContainer.replaceChildren();

  validStores.forEach((store, index) => {
    const settings = store.settings || {};
    const heroImage = safeShowcaseImageUrl(settings.bannerUrl) ||
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80";
    const logoImage = safeShowcaseImageUrl(settings.logoUrl) || DEFAULT_STORE_LOGO;
    const storeUrl = getStoreUrl(store.subdomain);
    const ownerName = store.ownerName || `${store.name} team`;
    const isActive = index === 0;

    const slide = document.createElement("article");
    slide.className = `showcase-card ${isActive ? "is-active" : ""}`;
    slide.dataset.showcaseSlide = "";
    slide.dataset.ownerName = ownerName;
    slide.dataset.stackPosition = String(index);
    slide.setAttribute("aria-hidden", String(!isActive));

    slide.innerHTML = `
      <div class="showcase-card-media">
        <img src="${escapeHtml(heroImage)}" alt="${escapeHtml(store.name)} storefront preview" loading="lazy">
        <div class="showcase-card-gradient"></div>
        <div class="showcase-card-badge">
          <span class="pulse-dot"></span>
          <span>Live Store</span>
        </div>
      </div>
      <div class="showcase-card-body">
        <div class="showcase-card-identity">
          <img src="${escapeHtml(logoImage)}" alt="${escapeHtml(store.name)} logo" class="showcase-card-logo" onerror="this.src='${DEFAULT_STORE_LOGO}'">
          <div>
            <h4 class="showcase-card-title">${escapeHtml(store.name)}</h4>
            <p class="showcase-card-subdomain">${escapeHtml(store.subdomain)}.store254.co.ke</p>
          </div>
        </div>
        <p class="showcase-card-tagline">${escapeHtml(settings.tagline || settings.description || "Browse curated products and fast delivery in Kenya.")}</p>
        <div class="showcase-card-meta">
          <span class="showcase-pill"><i data-lucide="shield-check" class="w-3.5 h-3.5"></i> M-Pesa verified</span>
          <span class="showcase-pill"><i data-lucide="truck" class="w-3.5 h-3.5"></i> Direct dispatch</span>
        </div>
        <a href="${escapeHtml(storeUrl)}" onclick="switchStore('${escapeHtml(store.subdomain)}'); return false;" class="showcase-card-cta">
          <span>Visit storefront</span>
          <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
        </a>
      </div>
    `;

    carousel.appendChild(slide);

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "showcase-dot";
    dot.dataset.showcaseDot = "";
    dot.setAttribute("aria-label", `Show store ${index + 1} of ${validStores.length}: ${store.name}`);
    dot.setAttribute("aria-current", String(isActive));
    dotsContainer.appendChild(dot);
  });

  if (ownerLabel && validStores[0]) {
    ownerLabel.textContent = validStores[0].ownerName || `${validStores[0].name} team`;
  }

  renderIcons();
  initializeShowcaseCarousel();
}

function getStoreUrl(subdomain) {
  const host = window.location.hostname.toLowerCase();
  const platformDomain = "store254.co.ke";
  if (host === platformDomain || host.endsWith(`.${platformDomain}`)) {
    return `${window.location.protocol}//${subdomain}.${platformDomain}`;
  }
  return `?store=${encodeURIComponent(subdomain)}`;
}

async function loadPlatformStores() {
  const container = document.getElementById("platform-stores-list");
  if (!container) return;

  const res = await apiFetch("/api/platform/stores");
  if (res.ok && res.data.success) {
    const stores = res.data.data;
    renderFeaturedStoreShowcase(stores);
    await renderPublicTemplateGallery();

    if (stores.length === 0) {
      container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 text-xs font-semibold">No active stores registered yet. Be the first to open a store!</div>`;
      return;
    }

    container.innerHTML = stores.map((s) => {
      const bannerBg = s.settings?.bannerUrl
        ? `background-image: url('${escapeHtml(s.settings.bannerUrl)}');`
        : "";
      const logoUrl = s.settings?.logoUrl || DEFAULT_STORE_LOGO;
      const storeUrl = getStoreUrl(s.subdomain);

      return `
        <div class="store-card group">
          <div class="store-card-cover" style="${bannerBg}">
            <div class="store-card-overlay"></div>
            <div class="store-card-badge">
              <span class="store-card-pulse"></span>
              <span>Verified Store</span>
            </div>
          </div>
          <div class="store-card-body">
            <div class="store-card-header">
              <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(s.name)}" class="store-card-logo" onerror="this.src='${DEFAULT_STORE_LOGO}'">
              <div class="store-card-heading">
                <h4 class="store-card-name">${escapeHtml(s.name)}</h4>
                <p class="store-card-subdomain">${escapeHtml(s.subdomain)}.store254.co.ke</p>
              </div>
            </div>
            <p class="store-card-desc">${escapeHtml(s.settings?.description || "Browse catalog, order online, and pay securely via M-Pesa.")}</p>
            <div class="store-card-footer">
              <div class="store-card-perks">
                <span class="store-card-perk"><i data-lucide="shield-check" class="w-3.5 h-3.5"></i> M-Pesa</span>
                <span class="store-card-perk"><i data-lucide="truck" class="w-3.5 h-3.5"></i> Delivery</span>
              </div>
              <a href="${escapeHtml(storeUrl)}" onclick="switchStore('${escapeHtml(s.subdomain)}'); return false;" class="store-card-cta">
                <span>Shop</span>
                <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
              </a>
            </div>
          </div>
        </div>
      `;
    }).join("");

    renderIcons();
  }
}

function switchStore(slug) {
  const currentHost = window.location.hostname.toLowerCase();
  const platformDomain = "store254.co.ke";
  if (currentHost === platformDomain || currentHost.endsWith(`.${platformDomain}`)) {
    window.location.href = `${window.location.protocol}//${slug}.${platformDomain}`;
    return;
  }
  const url = new URL(window.location);
  url.searchParams.set("store", slug);
  window.location.href = url.toString();
}

// Initialization
window.addEventListener("DOMContentLoaded", () => {
  setThemePalette("trust-forest");
  renderIcons();
  updateCartBadge();
  loadStoreProfile().then(() => {
    const url = new URL(window.location.href);
    const loginResult = url.searchParams.get("_customer_login");
    if (!loginResult) return;
    url.searchParams.delete("_customer_login");
    window.history.replaceState({}, "", url.toString());
    toggleDrawer("orders-drawer", true);
    if (loginResult === "error") showToast("Google sign-in was cancelled or failed. Please try again.", "error");
  });
});
