// Platform Store Showcase & Initialization

const FEATURED_STORE_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1776409933815-3497439f829a?auto=format&fit=crop&w=960&q=80",
  "https://images.unsplash.com/photo-1771759539572-0b94498364b6?auto=format&fit=crop&w=960&q=80",
  "https://images.unsplash.com/photo-1765115070689-43485654f37b?auto=format&fit=crop&w=960&q=80",
];

function safeShowcaseImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim(), window.location.origin);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function renderFeaturedStoreShowcase(stores) {
  const carousel = document.querySelector(".showcase-carousel");
  const controls = document.querySelector(".showcase-carousel-controls");
  if (!carousel || !controls) return;

  const validStores = Array.isArray(stores) ? stores.filter((s) => s && s.name && s.subdomain) : [];
  const hasLiveStores = validStores.length > 0;
  const featured = hasLiveStores
    ? [...validStores]
    : [
        { name: "Everything your business has to offer in one place.", settings: {}, ownerName: "Store owner" },
        { name: "Launch your local online store in minutes", settings: {}, ownerName: "Store owner" },
        { name: "Your store. Your domain. Your customers.", settings: {}, ownerName: "Store owner" },
      ];

  const ownerBadge = document.querySelector(".showcase-float-tag");
  if (ownerBadge) ownerBadge.hidden = !hasLiveStores;
  const ownerLabel = document.getElementById("featured-store-owner");
  if (ownerLabel && featured[0]) {
    ownerLabel.textContent = featured[0].ownerName || `${featured[0].name} team`;
  }

  if (hasLiveStores) {
    for (let i = featured.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [featured[i], featured[j]] = [featured[j], featured[i]];
    }
  }

  featured.splice(3);
  carousel.replaceChildren();
  controls.replaceChildren();

  featured.forEach((store, index) => {
    const settings = store.settings || {};
    const imageUrl = safeShowcaseImageUrl(settings.bannerUrl) || FEATURED_STORE_FALLBACK_IMAGES[index % FEATURED_STORE_FALLBACK_IMAGES.length];
    const name = store.name || "Independent Kenyan store";
    const ownerName = typeof store.ownerName === "string" && store.ownerName.trim() ? store.ownerName.trim() : "Store owner";
    const validSlug = /^[a-z0-9-]+$/i.test(store.subdomain || "");

    const slide = document.createElement("article");
    slide.className = `showcase-main-card${index === 0 ? " is-active" : ""}`;
    slide.dataset.showcaseSlide = "";
    slide.dataset.ownerName = ownerName;
    slide.dataset.stackPosition = String(index);
    slide.setAttribute("aria-hidden", String(index !== 0));

    const image = document.createElement("div");
    image.className = "showcase-main-image has-photo";
    image.style.backgroundImage = `linear-gradient(180deg,rgba(16,30,22,.04),rgba(16,30,22,.34)),url("${imageUrl}")`;
    image.style.backgroundSize = "cover";
    image.style.backgroundPosition = "center";
    const mark = document.createElement("span");
    mark.className = "showcase-image-mark";
    mark.textContent = name.trim().slice(0, 1).toUpperCase();
    const caption = document.createElement("span");
    caption.className = "showcase-image-caption";
    caption.textContent = "FEATURED STORE";
    image.append(mark, caption);

    const details = document.createElement("div");
    details.className = "showcase-main-details";
    const identity = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = name;
    identity.append(title);
    details.append(identity);
    if (validSlug) {
      const link = document.createElement("a");
      link.className = "showcase-arrow";
      link.href = getStoreUrl(store.subdomain);
      link.setAttribute("aria-label", `Visit ${name}`);
      link.innerHTML = '<i data-lucide="arrow-up-right" class="w-4 h-4"></i>';
      link.onclick = (e) => {
        e.preventDefault();
        switchStore(store.subdomain);
      };
      details.append(link);
    }

    const productRow = document.createElement("div");
    productRow.className = "showcase-product-row";
    const domainBadge = document.createElement("span");
    domainBadge.className = "showcase-domain-pill";
    domainBadge.textContent = validSlug ? `${store.subdomain}.store254.co.ke` : "store254.co.ke";
    const label = document.createElement("span");
    label.className = "showcase-product-label";
    label.textContent = "M-Pesa ready";
    productRow.append(domainBadge, label);
    slide.append(image, details, productRow);
    carousel.append(slide);

    const dot = document.createElement("button");
    dot.type = "button";
    dot.dataset.showcaseDot = "";
    dot.setAttribute("aria-label", `Show ${name}`);
    dot.setAttribute("aria-current", String(index === 0));
    controls.append(dot);
  });

  initializeShowcaseCarousel();
  renderIcons();
}

function getStoreUrl(subdomain) {
  const safeSub = /^[a-z0-9-]+$/i.test(subdomain || "") ? subdomain : "invalid";
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) {
    const port = window.location.port ? `:${window.location.port}` : "";
    return `${window.location.protocol}//${safeSub}.localhost${port}/`;
  }
  const platformDomain = "store254.co.ke";
  if (host === platformDomain || host.endsWith(`.${platformDomain}`)) {
    return `${window.location.protocol}//${safeSub}.${platformDomain}/`;
  }
  return `?store=${encodeURIComponent(safeSub)}`;
}

function switchStore(slug) {
  if (slug) {
    window.location.href = getStoreUrl(slug);
  } else {
    const host = window.location.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) {
      const port = window.location.port ? `:${window.location.port}` : "";
      window.location.href = `${window.location.protocol}//localhost${port}/`;
    } else {
      window.location.href = "https://store254.co.ke/";
    }
  }
}

function renderStoreCardMarkup(s, index) {
  let settings = s.settings;
  if (typeof settings === "string") {
    try { settings = JSON.parse(settings); } catch {}
  }
  const rawBanner = settings?.bannerUrl || s.bannerUrl || settings?.heroBannerUrl;
  const bannerUrl = safeShowcaseImageUrl(rawBanner) || FEATURED_STORE_FALLBACK_IMAGES[index % FEATURED_STORE_FALLBACK_IMAGES.length];
  const logoUrl = safeShowcaseImageUrl(settings?.logoUrl || s.logoUrl);
  const coverMap = {
    ELECTRONICS: "tech",
    SERVICES: "studio",
    FURNITURE: "home",
    RETAIL: "market",
    GENERAL: "maker",
  };
  const coverType = coverMap[s.businessType] || "maker";
  const initial = escapeHtml((s.name || "S").trim().slice(0, 1).toUpperCase());
  const badgeLabel = escapeHtml((s.businessType || "Independent store").replace(/_/g, " "));
  const storeUrl = getStoreUrl(s.subdomain);
  const desc = escapeHtml(settings?.description || s.description || "Browse this store’s online catalog and pay the seller directly.");
  const coverStyle = bannerUrl
    ? `style="background-image: linear-gradient(180deg, rgba(16, 30, 22, 0.2), rgba(16, 30, 22, 0.72)), url('${escapeHtml(bannerUrl)}'); background-size: cover; background-position: center;"`
    : "";
  const avatarContent = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(s.name)}" class="w-full h-full object-cover rounded-full" onerror="this.parentElement.textContent='${initial}'">`
    : initial;

  return `
    <a href="${storeUrl}" class="platform-store-card bg-white rounded-xl border border-slate-200 hover:border-emerald-500 hover:shadow-lg transition-all cursor-pointer text-left group flex flex-col justify-between no-underline overflow-hidden">
      <div>
        <div class="platform-store-cover cover-${coverType}${bannerUrl ? " has-hero-photo" : ""}" ${coverStyle}>
          <span class="platform-store-avatar">${avatarContent}</span>
          <small>${badgeLabel}</small>
        </div>
        <div class="platform-store-details">
          <div>
            <h4 class="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors truncate text-sm sm:text-base">${escapeHtml(s.name)}</h4>
            <span class="text-xs text-slate-400 font-mono truncate block mt-0.5">${escapeHtml(s.subdomain)}.store254.co.ke</span>
          </div>
          <p class="text-xs sm:text-[13px] text-slate-600 line-clamp-2 leading-relaxed mt-1.5">${desc}</p>
        </div>
      </div>
      <div class="platform-store-card-footer mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm font-bold text-emerald-600">
        <span class="flex items-center gap-1.5 group-hover:translate-x-1 transition-transform text-xs sm:text-sm">
          <span>Visit Storefront</span>
          <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
        </span>
        <span class="platform-store-live-pill">Open</span>
      </div>
    </a>
  `;
}

let platformLiveStoresCache = [];
let platformActiveTypeFilter = "";

function formatBusinessTypeLabel(type) {
  return String(type || "Store")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderPlatformDirectoryFilters(liveStores) {
  const toolbar = document.getElementById("platform-directory-toolbar");
  const filtersEl = document.getElementById("platform-type-filters");
  if (!toolbar || !filtersEl) return;

  if (!Array.isArray(liveStores) || liveStores.length < 2) {
    toolbar.classList.add("hidden");
    filtersEl.innerHTML = "";
    return;
  }

  toolbar.classList.remove("hidden");
  const types = Array.from(new Set(liveStores.map((s) => String(s.businessType || "GENERAL").toUpperCase())));
  const buttons = [
    `<button type="button" onclick="setPlatformTypeFilter('')" class="platform-type-chip ${platformActiveTypeFilter === "" ? "is-active" : ""}">All (${liveStores.length})</button>`,
    ...types.map((t) => {
      const count = liveStores.filter((s) => String(s.businessType || "GENERAL").toUpperCase() === t).length;
      return `<button type="button" onclick="setPlatformTypeFilter(${inlineJs(t)})" class="platform-type-chip ${platformActiveTypeFilter === t ? "is-active" : ""}">${escapeHtml(formatBusinessTypeLabel(t))} (${count})</button>`;
    }),
  ];
  filtersEl.innerHTML = buttons.join("");
}

function setPlatformTypeFilter(type) {
  platformActiveTypeFilter = type || "";
  renderPlatformDirectoryFilters(platformLiveStoresCache);
  filterPlatformStores();
}
window.setPlatformTypeFilter = setPlatformTypeFilter;

function filterPlatformStores() {
  const liveContainer = document.getElementById("platform-stores-grid");
  if (!liveContainer) return;

  if (platformLiveStoresCache.length === 0) {
    liveContainer.innerHTML = `
      <div class="col-span-full bg-white rounded-2xl p-6 border border-slate-200 text-center shadow-sm">
        <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2.5">
          <i data-lucide="store" class="w-5 h-5"></i>
        </div>
        <h4 class="font-bold text-slate-900 text-sm">Your store could be here</h4>
        <p class="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
          Create a dedicated storefront for your products and services.
        </p>
        <button onclick="toggleDrawer('onboard-modal', true)" class="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all inline-flex items-center gap-1.5">
          <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
          <span>Onboard Your Store</span>
        </button>
      </div>
    `;
    renderIcons();
    return;
  }

  const q = (document.getElementById("platform-store-search")?.value || "").toLowerCase().trim();
  const filtered = platformLiveStoresCache.filter((s) => {
    const typeMatch = !platformActiveTypeFilter || String(s.businessType || "GENERAL").toUpperCase() === platformActiveTypeFilter;
    if (!typeMatch) return false;
    if (!q) return true;
    const haystack = `${s.name || ""} ${s.subdomain || ""} ${s.description || ""} ${s.businessType || ""}`.toLowerCase();
    return haystack.includes(q);
  });

  if (filtered.length === 0) {
    liveContainer.innerHTML = `
      <div class="col-span-full bg-white rounded-2xl p-6 border border-slate-200 text-center shadow-sm">
        <p class="font-bold text-slate-800 text-sm">No matching storefronts found</p>
        <p class="text-xs text-slate-500 mt-1">Try another search term or clear your category filter.</p>
        <button type="button" onclick="document.getElementById('platform-store-search').value=''; setPlatformTypeFilter('');" class="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all">
          Reset filters
        </button>
      </div>
    `;
    return;
  }

  liveContainer.innerHTML = filtered.map(renderStoreCardMarkup).join("");
  renderIcons();
}
window.filterPlatformStores = filterPlatformStores;

async function loadPlatformLocationMetrics() {
  if (!document.getElementById("platform-kenya-metrics")) return;
  try {
    const res = await apiFetch("/api/platform/locations/stats");
    if (!res.ok || !res.data) return;
    const fmt = (n) => Number(n || 0).toLocaleString("en-KE");
    const mapText = [
      ["metric-kenya-counties", res.data.counties],
      ["metric-kenya-constituencies", res.data.constituencies],
      ["metric-kenya-locations", res.data.locations],
      ["metric-kenya-neighbors", res.data.neighbors],
      ["metric-kind-trading", res.data.byKind?.TRADING_CENTRE],
      ["metric-kind-shopping", res.data.byKind?.SHOPPING_CENTRE],
      ["metric-kind-towns", res.data.byKind?.TOWN],
      ["metric-kind-estates", res.data.byKind?.ESTATE],
    ];
    for (const [id, val] of mapText) {
      const el = document.getElementById(id);
      if (el && typeof val === "number" && val > 0) {
        el.textContent = fmt(val);
      }
    }
  } catch (err) {
    console.warn("Failed to refresh Kenya location metrics:", err);
  }
}

async function loadPlatformStores() {
  const liveContainer = document.getElementById("platform-stores-grid");
  const demoContainer = document.getElementById("demo-stores-grid");

  let stores = [];
  try {
    const res = await apiFetch("/api/platform/stores");
    if (res.ok && res.data?.success && Array.isArray(res.data.data)) {
      stores = res.data.data;
    }
  } catch (err) {
    console.warn("Failed to load platform stores:", err);
  }

  // Separate real merchant stores from demo businesses
  const liveStores = stores.filter((s) => s && s.id && !s.id.startsWith("tenant-demo-"));
  let demoStores = stores.filter((s) => s && s.id && s.id.startsWith("tenant-demo-"));
  if (demoStores.length === 0) {
    demoStores = DEMO_STORES_FALLBACK;
  }

  platformLiveStoresCache = liveStores;
  renderFeaturedStoreShowcase(liveStores.length > 0 ? liveStores : demoStores);
  renderPlatformDirectoryFilters(liveStores);
  filterPlatformStores();

  if (demoContainer) {
    demoContainer.innerHTML = demoStores.map(renderStoreCardMarkup).join("");
  }

  renderIcons();
}

// Initialization
window.addEventListener("DOMContentLoaded", () => {
  if (typeof setThemePalette === "function") setThemePalette("trust-forest");
  renderIcons();
  updateCartBadge();
  loadPlatformLocationMetrics();
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
