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

  // Separate real merchant stores from demo businesses
  const liveStores = stores.filter((s) => s && s.id && !s.id.startsWith("tenant-demo-"));

  if (liveStores.length === 0) {
    container.innerHTML = `
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

  const coverMap = {
    ELECTRONICS: "tech",
    SERVICES: "studio",
    FURNITURE: "home",
    RETAIL: "market",
    GENERAL: "maker",
  };

  container.innerHTML = liveStores.map((s, index) => {
    const rawBanner = s.settings?.bannerUrl || s.bannerUrl || s.settings?.heroBannerUrl;
    const bannerUrl = safeShowcaseImageUrl(rawBanner) || FEATURED_STORE_FALLBACK_IMAGES[index % FEATURED_STORE_FALLBACK_IMAGES.length];
    const logoUrl = safeShowcaseImageUrl(s.settings?.logoUrl || s.logoUrl);
    const coverType = coverMap[s.businessType] || "maker";
    const initial = escapeHtml((s.name || "S").trim().slice(0, 1).toUpperCase());
    const badgeLabel = escapeHtml((s.businessType || "Independent store").replace(/_/g, " "));
    const storeUrl = getStoreUrl(s.subdomain);
    const desc = escapeHtml(s.settings?.description || "Browse this store’s online catalog and pay the seller directly.");
    const coverStyle = bannerUrl
      ? `style="background-image: linear-gradient(180deg, rgba(16, 30, 22, 0.2), rgba(16, 30, 22, 0.72)), url('${escapeHtml(bannerUrl)}'); background-size: cover; background-position: center;"`
      : "";
    const avatarContent = logoUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(s.name)}" class="w-full h-full object-cover rounded-full" onerror="this.parentElement.textContent='${initial}'">`
      : initial;

    return `
      <a href="${storeUrl}" class="platform-store-card bg-white rounded-xl border border-slate-200 hover:border-emerald-500 hover:shadow-lg transition-all cursor-pointer text-left group flex flex-col justify-between no-underline">
        <div>
          <div class="platform-store-cover cover-${coverType}${bannerUrl ? " has-hero-photo" : ""}" ${coverStyle}>
            <span class="platform-store-avatar">${avatarContent}</span>
            <small>${badgeLabel}</small>
          </div>
          <div class="platform-store-details">
            <div>
              <h4 class="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors truncate text-sm">${escapeHtml(s.name)}</h4>
              <span class="text-[11px] text-slate-400 font-mono truncate block">${escapeHtml(s.subdomain)}.store254.co.ke</span>
            </div>
            <p class="text-[11px] text-slate-600 line-clamp-2 leading-relaxed mt-1">${desc}</p>
          </div>
        </div>
        <div class="platform-store-card-footer mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600">
          <span class="flex items-center gap-1 group-hover:translate-x-1 transition-transform text-[11px]">
            <span>Visit Storefront</span>
            <i data-lucide="arrow-right" class="w-3 h-3"></i>
          </span>
          <span class="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase">${escapeHtml(s.businessType || "Store")}</span>
        </div>
      </a>
    `;
  }).join("");

  renderIcons();
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 Interactive Demo Stores Catalog & Showcase
// ═══════════════════════════════════════════════════════════════════════════
const DEMO_STORES_CATALOG = [
  {
    id: "tenant-demo-fashion-01",
    subdomain: "zuritrends",
    name: "Zuri Trends Kenya",
    categoryGroup: "RETAIL",
    businessTypeLabel: "Fashion Boutique",
    icon: "shirt",
    accentColor: "#e11d48",
    tagline: "Contemporary Nairobi Boutique",
    description: "Curated Nairobi contemporary fashion boutique with quality clothes, designer shoes, and premium accessories.",
    categories: ["Clothes (Men's & Women's)", "Shoes (Sneakers & Loafers)", "Accessories"],
    itemsCount: 8,
  },
  {
    id: "tenant-demo-electronics-02",
    subdomain: "nexustech",
    name: "Nexus Tech Hub",
    categoryGroup: "ELECTRONICS",
    businessTypeLabel: "Electronics & Tech",
    icon: "smartphone",
    accentColor: "#2563eb",
    tagline: "Gadgets & Everyday Tech",
    description: "Smartphones, Apple iPads, noise-canceling audio gear, and 65W GaN fast chargers with official warranties.",
    categories: ["Smartphones & Tablets", "Audio & Sound", "Computing & Power"],
    itemsCount: 9,
  },
  {
    id: "tenant-demo-salon-03",
    subdomain: "lushsalon",
    name: "Lush & Glow Hair Salon",
    categoryGroup: "BEAUTY",
    businessTypeLabel: "Hair Salon & Spa",
    icon: "sparkles",
    accentColor: "#db2777",
    tagline: "Luxury Hair & Nail Bar",
    description: "Bespoke hair styling, knotless braids, HD lace wig installation, and Russian BIAB gel manicures in Kilimani.",
    categories: ["Hair Styling & Braids", "Nails & Spa", "Facials & Skin"],
    itemsCount: 8,
  },
  {
    id: "tenant-demo-barbershop-04",
    subdomain: "executivecuts",
    name: "The Executive Barber Club",
    categoryGroup: "BEAUTY",
    businessTypeLabel: "Barber Lounge",
    icon: "scissors",
    accentColor: "#d97706",
    tagline: "Gentlemen's Premium Grooming",
    description: "Premier gentleman's grooming lounge offering precision skin fades, hot towel razor shaves, and dreadlocks care.",
    categories: ["Precision Haircuts", "Beard & Facial Grooming", "VIP Packages"],
    itemsCount: 8,
  },
  {
    id: "tenant-demo-massage-05",
    subdomain: "serenityspa",
    name: "Serenity Holistic Wellness Spa",
    categoryGroup: "WELLNESS",
    businessTypeLabel: "Massage & Wellness",
    icon: "heart-pulse",
    accentColor: "#059669",
    tagline: "Holistic Health & Spa",
    description: "Tranquil sanctuary in Westlands providing holistic therapeutic body massages, deep tissue relief, and aromatherapy.",
    categories: ["Full Body Massages", "Specialized Therapies", "Couples Packages"],
    itemsCount: 8,
  },
  {
    id: "tenant-demo-photographer-06",
    subdomain: "lenscraft",
    name: "Lenscraft Visuals & Studios",
    categoryGroup: "CREATIVE",
    businessTypeLabel: "Photography & Media",
    icon: "camera",
    accentColor: "#4f46e5",
    tagline: "Cinematic Visuals & Studio",
    description: "Award-winning commercial photography, cinematic wedding visuals, executive studio portraits, and product shoots.",
    categories: ["Portrait & Studio", "Events & Weddings", "Commercial & Brand"],
    itemsCount: 8,
  },
  {
    id: "tenant-demo-vacanthouse-07",
    subdomain: "nairobihomes",
    name: "UrbanNest Vacant Homes & Letting",
    categoryGroup: "PROPERTY",
    businessTypeLabel: "Rental Properties",
    icon: "home",
    accentColor: "#0284c7",
    tagline: "Verified Rentals & Letting",
    description: "Verified residential rental listings, vacant apartments, modern Kilimani studios, and Karen family townhouses.",
    categories: ["Studios & Bedsitters", "1 & 2 Bedroom Apts", "Townhouses & Villas"],
    itemsCount: 8,
  },
  {
    id: "tenant-demo-realestate-08",
    subdomain: "primeacres",
    name: "PrimeAcres Properties & Land",
    categoryGroup: "PROPERTY",
    businessTypeLabel: "Land & Real Estate",
    icon: "map-pin",
    accentColor: "#15803d",
    tagline: "Titled Land & Developments",
    description: "Trusted Kenyan real estate consultancy offering titled residential 50x100 plots, commercial land, and villas.",
    categories: ["Titled Land & Plots", "Properties For Sale", "Commercial Spaces"],
    itemsCount: 8,
  },
  {
    id: "tenant-demo-portfolio-09",
    subdomain: "alexkimani",
    name: "Alex Kimani | Cloud & Web Engineer",
    categoryGroup: "CREATIVE",
    businessTypeLabel: "Personal Portfolio",
    icon: "code",
    accentColor: "#7c3aed",
    tagline: "Full-Stack Software Consultant",
    description: "Independent Full-Stack Software Engineer & Cloud Architect specializing in scalable web apps, mobile solutions, and UX.",
    categories: ["Full-Stack Development", "UI/UX & Product Design", "Cloud Audits"],
    itemsCount: 8,
  },
  {
    id: "tenant-demo-drivingschool-10",
    subdomain: "safedrive",
    name: "Apex SafeDrive Driving Academy",
    categoryGroup: "EDUCATION",
    businessTypeLabel: "Driving School",
    icon: "gauge",
    accentColor: "#ea580c",
    tagline: "NTSA Certified Academy",
    description: "NTSA-certified driving school in Nairobi providing comprehensive manual & automatic driving courses and bodaboda licensing.",
    categories: ["Light Vehicles (Class B)", "Motorcycle & TukTuk", "Defensive Driving"],
    itemsCount: 8,
  },
];

let activeDemoFilter = "ALL";

function renderDemoStoresShowcase(filter = "ALL") {
  const container = document.getElementById("demo-stores-grid");
  if (!container) return;

  activeDemoFilter = filter;
  const filtered = filter === "ALL"
    ? DEMO_STORES_CATALOG
    : DEMO_STORES_CATALOG.filter((s) => s.categoryGroup === filter);

  container.innerHTML = filtered.map((store) => {
    const storeUrl = getStoreUrl(store.subdomain);
    const adminUrl = `/admin.html?store=${encodeURIComponent(store.subdomain)}`;
    const isProduct = store.categoryGroup === "RETAIL" || store.categoryGroup === "ELECTRONICS";
    const countBadge = `${store.itemsCount} ${isProduct ? "Items" : "Services"}`;

    return `
      <article class="demo-card bg-white rounded-xl border border-slate-200 hover:border-emerald-500 p-3 sm:p-3.5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
        <div>
          <div class="flex items-center justify-between gap-1.5 mb-2">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
              <i data-lucide="${escapeHtml(store.icon)}" class="w-3 h-3" style="color: ${escapeHtml(store.accentColor)}"></i>
              <span>${escapeHtml(store.businessTypeLabel)}</span>
            </span>
            <span class="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full font-bold border border-emerald-100">
              ${escapeHtml(countBadge)}
            </span>
          </div>

          <h3 class="font-bold text-slate-900 text-sm group-hover:text-emerald-600 transition-colors leading-snug">
            ${escapeHtml(store.name)}
          </h3>
          <span class="text-[10px] text-slate-400 font-mono block mt-0.5">${escapeHtml(store.subdomain)}.store254.co.ke</span>
          
          <p class="text-[11px] text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
            ${escapeHtml(store.description)}
          </p>

          <div class="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
            ${store.categories.slice(0, 2).map((cat) => `
              <span class="text-[9px] font-medium bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/70">
                ${escapeHtml(cat)}
              </span>
            `).join("")}
          </div>
        </div>

        <div class="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-1.5">
          <div class="flex items-center gap-1.5">
            <a href="${storeUrl}" class="flex-1 py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold text-center transition-all flex items-center justify-center gap-1 no-underline shadow-sm">
              <span>Shop Store</span>
              <i data-lucide="arrow-right" class="w-3 h-3"></i>
            </a>
            <a href="${adminUrl}" class="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg text-[11px] font-semibold text-center transition-all flex items-center justify-center gap-1 no-underline border border-slate-200 shrink-0" title="Manage Store (Admin pass: 1234)">
              <i data-lucide="shield" class="w-3 h-3 text-slate-400"></i>
              <span>Admin</span>
            </a>
          </div>
          <div class="flex items-center justify-between text-[9px] text-slate-400 px-0.5 font-mono">
            <span>admin: <strong class="text-emerald-700">1234</strong></span>
            <span>demo: <strong class="text-amber-700">demo</strong></span>
          </div>
        </div>
      </article>
    `;
  }).join("");

  renderIcons();
}

function filterDemoStores(category, btnElement) {
  const tabs = document.querySelectorAll("#demo-filter-tabs .demo-tab");
  tabs.forEach((tab) => {
    tab.classList.remove("active", "bg-emerald-500", "text-white", "shadow-sm");
    tab.classList.add("text-slate-300");
  });

  if (btnElement) {
    btnElement.classList.add("active", "bg-emerald-500", "text-white", "shadow-sm");
    btnElement.classList.remove("text-slate-300");
  }

  renderDemoStoresShowcase(category);
}

// Initialization
window.addEventListener("DOMContentLoaded", () => {
  if (typeof setThemePalette === "function") setThemePalette("trust-forest");
  renderIcons();
  updateCartBadge();
  renderDemoStoresShowcase("ALL");
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
