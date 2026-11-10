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
    ["", "mini-rose", "mini-olive"].forEach((tone) => {
      const swatch = document.createElement("span");
      swatch.className = `showcase-mini-product ${tone}`.trim();
      productRow.append(swatch);
    });
    const label = document.createElement("span");
    label.className = "showcase-product-label";
    label.textContent = "Shop this store";
    productRow.append(label);
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

async function loadPlatformStores() {
  const container = document.getElementById("platform-stores-grid");
  if (typeof renderPublicTemplateGallery === "function") {
    await renderPublicTemplateGallery();
  }

  let stores = [];
  try {
    const res = await apiFetch("/api/platform/stores");
    if (res.ok && res.data?.success && Array.isArray(res.data.data)) {
      stores = res.data.data;
    }
  } catch (err) {
    console.warn("Failed to load platform stores:", err);
  }

  renderFeaturedStoreShowcase(stores);

  if (!container) return;

  if (stores.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white rounded-3xl p-8 border border-slate-200 text-center shadow-sm">
        <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
          <i data-lucide="store" class="w-6 h-6"></i>
        </div>
        <h4 class="font-bold text-slate-900 text-base">Your store could be here</h4>
        <p class="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
          Create a dedicated storefront for your products and services.
        </p>
        <button onclick="toggleDrawer('onboard-modal', true)" class="mt-4 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all inline-flex items-center gap-1.5">
          <i data-lucide="plus-circle" class="w-4 h-4"></i>
          <span>Onboard Your Store</span>
        </button>
      </div>
    `;
    renderIcons();
    return;
  }

  const coverMap = {
    ELECTRONICS: "tech",
    SERVICES: "studio",
    FURNITURE: "home",
    RETAIL: "market",
    GENERAL: "maker",
  };

  container.innerHTML = stores.map((s) => `
    <a href="${getStoreUrl(s.subdomain)}" class="bg-white rounded-2xl p-6 border border-slate-200 hover:border-emerald-500 hover:shadow-xl transition-all cursor-pointer text-left group flex flex-col justify-between no-underline">
      <div>
        <div class="platform-store-cover cover-${coverMap[s.businessType] || "maker"}">
          <span>${escapeHtml((s.name || "S").trim().slice(0, 1).toUpperCase())}</span>
          <small>${escapeHtml((s.businessType || "Independent store").replace(/_/g, " "))}</small>
        </div>
        <div class="platform-store-details">
          <div>
            <h4 class="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">${escapeHtml(s.name)}</h4>
            <span class="text-xs text-slate-400 font-mono">${escapeHtml(s.subdomain)}.store254.co.ke</span>
          </div>
          <p class="text-xs text-slate-600 line-clamp-2 leading-relaxed">${escapeHtml(s.settings?.description || "Browse this store’s online catalog and pay the seller directly.")}</p>
        </div>
      </div>
      <div class="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600">
        <span class="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
          <span>Visit Storefront</span>
          <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
        </span>
        <span class="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded text-[10px] font-mono uppercase">${escapeHtml(s.businessType || "Store")}</span>
      </div>
    </a>
  `).join("");

  renderIcons();
}

// Initialization
window.addEventListener("DOMContentLoaded", () => {
  if (typeof setThemePalette === "function") setThemePalette("trust-forest");
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
