// Platform Store Showcase & Initialization

const FEATURED_STORE_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1776409933815-3497439f829a?auto=format&fit=crop&w=960&q=80",
  "https://images.unsplash.com/photo-1771759539572-0b94498364b6?auto=format&fit=crop&w=960&q=80",
  "https://images.unsplash.com/photo-1765115070689-43485654f37b?auto=format&fit=crop&w=960&q=80",
];

function safeShowcaseImageUrl(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("//")) return "";
  try {
    const url = new URL(trimmed, window.location.origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.href.replace(/['"\\()\r\n\s]/g, (ch) =>
      `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`
    );
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
    DIGITAL_TECH: "tech",
    AUTOMOTIVE: "tech",
    SERVICES: "studio",
    BEAUTY: "studio",
    EVENTS_HOSPITALITY: "studio",
    EDUCATION: "studio",
    FURNITURE: "home",
    REAL_ESTATE: "home",
    BUILDING_HARDWARE: "home",
    RETAIL: "market",
    FOOD_BEVERAGE: "market",
    AGRICULTURE: "market",
    WHOLESALE_B2B: "market",
    FASHION: "maker",
    KIDS_BABY: "maker",
    PHARMACY_HEALTH: "maker",
    SPORTS_FITNESS: "maker",
    LOGISTICS_DELIVERY: "tech",
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
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(s.name)}" class="w-full h-full object-cover rounded-full" data-avatar-initial="${initial}">`
    : initial;

  const isFollowed = isStoreFollowed(s.subdomain);
  const storePayload = {
    id: s.id || "",
    subdomain: s.subdomain || "",
    name: s.name || s.subdomain || "Store",
    businessType: s.businessType || "GENERAL",
    logoUrl: logoUrl || "",
    locationLabel: s.locationLabel || s.countyName || "",
  };

  return `
    <a href="${storeUrl}" class="platform-store-card ${isFollowed ? "is-followed-store " : ""}bg-white rounded-xl border border-slate-200 hover:border-emerald-500 hover:shadow-lg transition-all cursor-pointer text-left group flex flex-col justify-between no-underline overflow-hidden">
      <div>
        <div class="platform-store-cover cover-${coverType}${bannerUrl ? " has-hero-photo" : ""}" ${coverStyle}>
          <span class="platform-store-avatar">${avatarContent}</span>
          <small>${badgeLabel}</small>
          <button
            type="button"
            data-platform-action="toggle-follow"
            data-follow-subdomain="${escapeHtml(s.subdomain)}"
            data-follow-store="${escapeHtml(JSON.stringify(storePayload))}"
            aria-pressed="${isFollowed ? "true" : "false"}"
            aria-label="${isFollowed ? `Unsubscribe from ${escapeHtml(s.name)}` : `Subscribe to ${escapeHtml(s.name)}`}"
            class="store-card-follow-btn${isFollowed ? " is-following" : ""}">
            <i data-lucide="${isFollowed ? "star" : "bookmark-plus"}" class="w-3.5 h-3.5"></i>
            <span>${isFollowed ? "Subscribed" : "Subscribe"}</span>
          </button>
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
        <span class="platform-store-live-pill${isFollowed ? " is-pinned" : ""}">${isFollowed ? "★ Pinned" : "Open"}</span>
      </div>
    </a>
  `;
}

let platformLiveStoresCache = [];
let platformActiveTypeFilter = "";

const FOLLOWED_STORES_STORAGE_KEY = "store254_followed_stores_v1";
const FOLLOWED_STORES_META_KEY = "store254_followed_updated_v1";
const FOLLOWED_STORES_COOKIE_KEY = "store254_followed_v1";
const MAX_FOLLOWED_STORES = 30;

function readCookieValue(name) {
  try {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
    return match && match[1] ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
}

function normalizeFollowedStoreRecord(raw) {
  if (!raw || typeof raw !== "object") return null;
  const rawSub = raw.subdomain || raw.sub || "";
  const subdomain = String(rawSub).trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!subdomain) return null;
  return {
    id: String(raw.id || "").trim(),
    subdomain,
    name: String(raw.name || raw.n || subdomain).trim(),
    businessType: String(raw.businessType || raw.t || "GENERAL").trim(),
    logoUrl: safeShowcaseImageUrl(raw.logoUrl || ""),
    locationLabel: String(raw.locationLabel || raw.l || "").trim(),
    pinnedAt: Number(raw.pinnedAt || raw.p || Date.now()),
  };
}

function enrichFollowedStoreRecord(record) {
  if (!record || !Array.isArray(platformLiveStoresCache) || platformLiveStoresCache.length === 0) {
    return record;
  }
  const match = platformLiveStoresCache.find(
    (s) => s && String(s.subdomain || "").toLowerCase() === record.subdomain
  );
  if (!match) return record;
  let settings = match.settings;
  if (typeof settings === "string") {
    try { settings = JSON.parse(settings); } catch {}
  }
  const liveLogo = safeShowcaseImageUrl(settings?.logoUrl || match.logoUrl);
  return {
    ...record,
    id: match.id || record.id,
    name: match.name || record.name,
    businessType: match.businessType || record.businessType,
    logoUrl: liveLogo || record.logoUrl,
    locationLabel: match.locationLabel || match.countyName || record.locationLabel,
  };
}

function writeFollowedCookie(stores, updatedAt) {
  try {
    const compact = stores.slice(0, 20).map((s) => ({
      sub: s.subdomain,
      n: String(s.name || s.subdomain).slice(0, 48),
      t: s.businessType || "GENERAL",
      l: String(s.locationLabel || "").slice(0, 40),
      p: Number(s.pinnedAt || updatedAt),
    }));
    const payload = encodeURIComponent(JSON.stringify({ updatedAt, stores: compact }));
    const host = (window.location.hostname || "").toLowerCase();
    const attrs = ["Path=/", "Max-Age=31536000", "SameSite=Lax"];
    if (host === "store254.co.ke" || host.endsWith(".store254.co.ke")) {
      attrs.push("Domain=.store254.co.ke");
    } else if (host === "localhost" || host.endsWith(".localhost")) {
      attrs.push("Domain=localhost");
    }
    if (window.location.protocol === "https:") {
      attrs.push("Secure");
    }
    document.cookie = `${FOLLOWED_STORES_COOKIE_KEY}=${payload}; ${attrs.join("; ")}`;
  } catch {
    // Ignore cookie errors in restricted contexts.
  }
}

function saveFollowedStoresList(list) {
  const updatedAt = Date.now();
  const deduped = [];
  const seen = new Set();
  for (const item of list) {
    const norm = normalizeFollowedStoreRecord(item);
    if (!norm || seen.has(norm.subdomain)) continue;
    seen.add(norm.subdomain);
    deduped.push(norm);
    if (deduped.length >= MAX_FOLLOWED_STORES) break;
  }
  deduped.sort((a, b) => Number(b.pinnedAt || 0) - Number(a.pinnedAt || 0));
  try {
    localStorage.setItem(FOLLOWED_STORES_STORAGE_KEY, JSON.stringify(deduped));
    localStorage.setItem(FOLLOWED_STORES_META_KEY, String(updatedAt));
  } catch {}
  writeFollowedCookie(deduped, updatedAt);
  return deduped;
}

function getFollowedStores() {
  let lsStores = [];
  let lsUpdatedAt = 0;
  try {
    const raw = localStorage.getItem(FOLLOWED_STORES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        lsStores = parsed.map(normalizeFollowedStoreRecord).filter(Boolean);
      }
    }
    lsUpdatedAt = Number(localStorage.getItem(FOLLOWED_STORES_META_KEY) || 0) || 0;
  } catch {}

  let cookieStores = [];
  let cookieUpdatedAt = 0;
  try {
    const rawCookie = readCookieValue(FOLLOWED_STORES_COOKIE_KEY);
    if (rawCookie) {
      const parsedCookie = JSON.parse(rawCookie);
      if (parsedCookie && Array.isArray(parsedCookie.stores)) {
        cookieStores = parsedCookie.stores.map(normalizeFollowedStoreRecord).filter(Boolean);
        cookieUpdatedAt = Number(parsedCookie.updatedAt || 0) || 0;
      }
    }
  } catch {}

  let activeList = lsStores;
  if (cookieUpdatedAt > lsUpdatedAt) {
    activeList = cookieStores;
    try {
      const enrichedFromLs = cookieStores.map((cs) => {
        const prev = lsStores.find((ls) => ls.subdomain === cs.subdomain);
        return prev?.logoUrl && !cs.logoUrl ? { ...cs, logoUrl: prev.logoUrl } : cs;
      });
      activeList = enrichedFromLs;
      localStorage.setItem(FOLLOWED_STORES_STORAGE_KEY, JSON.stringify(activeList));
      localStorage.setItem(FOLLOWED_STORES_META_KEY, String(cookieUpdatedAt));
    } catch {}
  } else if (lsStores.length > 0 && cookieUpdatedAt === 0) {
    writeFollowedCookie(lsStores, lsUpdatedAt || Date.now());
  }

  return activeList
    .map(enrichFollowedStoreRecord)
    .sort((a, b) => Number(b.pinnedAt || 0) - Number(a.pinnedAt || 0));
}
window.getFollowedStores = getFollowedStores;

function isStoreFollowed(subdomain) {
  const safeSub = String(subdomain || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!safeSub) return false;
  return getFollowedStores().some((s) => s.subdomain === safeSub);
}
window.isStoreFollowed = isStoreFollowed;

function syncStorefrontFollowButton() {
  const btn = document.getElementById("banner-follow-store-btn");
  const label = document.getElementById("banner-follow-store-label");
  const sub = state?.activeTenant?.subdomain;
  if (!btn || !sub) return;
  const following = isStoreFollowed(sub);
  btn.classList.toggle("is-following", following);
  btn.setAttribute("aria-pressed", following ? "true" : "false");
  if (label) {
    label.textContent = following ? "Subscribed · Pinned" : "Subscribe to Store";
  }
  const icon = btn.querySelector("i, svg");
  if (icon && icon.tagName.toLowerCase() === "i") {
    icon.setAttribute("data-lucide", following ? "star" : "bookmark-plus");
  } else if (btn.firstElementChild) {
    const newIcon = document.createElement("i");
    newIcon.setAttribute("data-lucide", following ? "star" : "bookmark-plus");
    newIcon.className = "w-4 h-4";
    btn.replaceChild(newIcon, btn.firstElementChild);
  }
}
window.syncStorefrontFollowButton = syncStorefrontFollowButton;

function syncFollowButtonsInDom() {
  syncStorefrontFollowButton();
  document.querySelectorAll("[data-follow-subdomain]").forEach((btn) => {
    const sub = btn.getAttribute("data-follow-subdomain") || "";
    const followed = isStoreFollowed(sub);
    btn.classList.toggle("is-following", followed);
    btn.setAttribute("aria-pressed", followed ? "true" : "false");
    const span = btn.querySelector("span");
    if (span) {
      span.textContent = followed ? "Subscribed ★" : "Subscribe";
    }
  });
}
window.syncFollowButtonsInDom = syncFollowButtonsInDom;

function renderPinnedStoresSection() {
  const followed = getFollowedStores();
  const containers = [
    document.getElementById("platform-pinned-stores-section"),
    document.getElementById("stores-directory-pinned-section"),
  ].filter(Boolean);

  if (containers.length === 0) return;

  if (followed.length === 0) {
    containers.forEach((el) => {
      el.classList.add("hidden");
      el.innerHTML = "";
    });
    return;
  }

  const cardsHtml = followed
    .map((store) => {
      const storeUrl = getStoreUrl(store.subdomain);
      const initial = escapeHtml((store.name || store.subdomain || "S").trim().slice(0, 1).toUpperCase());
      const avatarHtml = store.logoUrl
        ? `<img src="${escapeHtml(store.logoUrl)}" alt="${escapeHtml(store.name)}" data-avatar-initial="${initial}">`
        : initial;
      const metaParts = [];
      if (store.locationLabel) metaParts.push(store.locationLabel);
      metaParts.push(`${store.subdomain}.store254.co.ke`);
      const unpinPayload = escapeHtml(JSON.stringify({ subdomain: store.subdomain, name: store.name }));
      return `
        <div class="pinned-store-chip">
          <a href="${escapeHtml(storeUrl)}" class="pinned-store-chip-link">
            <span class="pinned-store-avatar">${avatarHtml}</span>
            <span class="pinned-store-copy">
              <strong>${escapeHtml(store.name)}</strong>
              <small>${escapeHtml(metaParts.join(" · "))}</small>
            </span>
          </a>
          <button
            type="button"
            data-platform-action="unpin-store"
            data-unpin-store="${unpinPayload}"
            aria-label="Unpin ${escapeHtml(store.name)}"
            title="Unfollow ${escapeHtml(store.name)}"
            class="pinned-store-remove">
            ×
          </button>
        </div>
      `;
    })
    .join("");

  const markup = `
    <div class="pinned-stores-header">
      <div class="pinned-stores-title-wrap">
        <span class="pinned-stores-badge">
          <i data-lucide="star" class="w-3.5 h-3.5"></i>
          <span>Pinned Stores</span>
        </span>
        <p class="pinned-stores-sub">Your subscribed Kenyan shops stay pinned right here for one-tap shopping</p>
      </div>
      <span class="pinned-stores-count">${followed.length} store${followed.length === 1 ? "" : "s"}</span>
    </div>
    <div class="pinned-stores-rail">${cardsHtml}</div>
  `;

  containers.forEach((el) => {
    el.innerHTML = markup;
    el.classList.remove("hidden");
  });
  renderIcons();
}
window.renderPinnedStoresSection = renderPinnedStoresSection;

function toggleFollowStore(storeInput, event) {
  if (event) {
    if (typeof event.preventDefault === "function") event.preventDefault();
    if (typeof event.stopPropagation === "function") event.stopPropagation();
  }

  let resolvedInput = storeInput;
  if (typeof storeInput === "string") {
    const cleanSub = storeInput.trim().toLowerCase();
    const liveMatch = (platformLiveStoresCache || []).find(
      (s) => s && String(s.subdomain || "").toLowerCase() === cleanSub
    );
    resolvedInput = liveMatch || { subdomain: cleanSub, name: cleanSub };
  }

  const candidate = normalizeFollowedStoreRecord({
    ...resolvedInput,
    pinnedAt: Date.now(),
  });
  if (!candidate) return false;

  const existing = getFollowedStores();
  const alreadyFollowed = existing.some((s) => s.subdomain === candidate.subdomain);
  let nextList;
  if (alreadyFollowed) {
    nextList = existing.filter((s) => s.subdomain !== candidate.subdomain);
    if (platformActiveTypeFilter === "__SUBSCRIBED__" && nextList.length === 0) {
      platformActiveTypeFilter = "";
    }
    showToast(`Unfollowed ${candidate.name}.`, "info");
  } else {
    nextList = [enrichFollowedStoreRecord(candidate), ...existing];
    showToast(`Subscribed! ${candidate.name} is now pinned at the top of Store254.`, "success");
  }

  saveFollowedStoresList(nextList);
  renderPinnedStoresSection();
  syncFollowButtonsInDom();
  if (platformLiveStoresCache.length > 0) {
    renderPlatformDirectoryFilters(platformLiveStoresCache);
    filterPlatformStores();
  }
  renderIcons();
  return !alreadyFollowed;
}
window.toggleFollowStore = toggleFollowStore;

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
  const followedSet = new Set(getFollowedStores().map((s) => s.subdomain));
  const followedCount = liveStores.filter((s) => followedSet.has(String(s.subdomain || "").toLowerCase())).length;
  const types = Array.from(new Set(liveStores.map((s) => String(s.businessType || "GENERAL").toUpperCase())));
  const buttons = [
    `<button type="button" data-platform-action="filter-type" data-type="" class="platform-type-chip ${platformActiveTypeFilter === "" ? "is-active" : ""}">All (${liveStores.length})</button>`,
    ...(followedCount > 0
      ? [
          `<button type="button" data-platform-action="filter-type" data-type="__SUBSCRIBED__" class="platform-type-chip ${platformActiveTypeFilter === "__SUBSCRIBED__" ? "is-active" : ""}">★ Subscribed (${followedCount})</button>`,
        ]
      : []),
    ...types.map((t) => {
      const count = liveStores.filter((s) => String(s.businessType || "GENERAL").toUpperCase() === t).length;
      return `<button type="button" data-platform-action="filter-type" data-type="${escapeHtml(t)}" class="platform-type-chip ${platformActiveTypeFilter === t ? "is-active" : ""}">${escapeHtml(formatBusinessTypeLabel(t))} (${count})</button>`;
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
        <button type="button" data-platform-action="open-onboard" class="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all inline-flex items-center gap-1.5">
          <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
          <span>Onboard Your Store</span>
        </button>
      </div>
    `;
    renderIcons();
    return;
  }

  const q = (document.getElementById("platform-store-search")?.value || "").toLowerCase().trim();
  const buyerLoc = typeof window.getStore254BuyerLocation === "function" ? window.getStore254BuyerLocation() : null;
  const followedOrder = new Map(getFollowedStores().map((s, idx) => [s.subdomain, idx]));

  const filtered = platformLiveStoresCache
    .filter((s) => {
      const slug = String(s.subdomain || "").toLowerCase();
      if (platformActiveTypeFilter === "__SUBSCRIBED__") {
        if (!followedOrder.has(slug)) return false;
      } else if (platformActiveTypeFilter && String(s.businessType || "GENERAL").toUpperCase() !== platformActiveTypeFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = `${s.name || ""} ${s.subdomain || ""} ${s.description || ""} ${s.businessType || ""} ${s.locationLabel || ""}`.toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => {
      const aSlug = String(a.subdomain || "").toLowerCase();
      const bSlug = String(b.subdomain || "").toLowerCase();
      const aPinned = followedOrder.has(aSlug);
      const bPinned = followedOrder.has(bSlug);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      if (aPinned && bPinned) {
        return followedOrder.get(aSlug) - followedOrder.get(bSlug);
      }
      if (!buyerLoc) return 0;
      const score = (store) => {
        if (buyerLoc.locationId && store.locationId === buyerLoc.locationId) return 0;
        if (buyerLoc.countyId && store.countyId === buyerLoc.countyId) return 1;
        return 2;
      };
      return score(a) - score(b);
    });

  if (filtered.length === 0) {
    liveContainer.innerHTML = `
      <div class="col-span-full bg-white rounded-2xl p-6 border border-slate-200 text-center shadow-sm">
        <p class="font-bold text-slate-800 text-sm">No matching storefronts found</p>
        <p class="text-xs text-slate-500 mt-1">Try another search term or clear your category filter.</p>
        <button type="button" data-platform-action="reset-store-filters" class="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all">
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
  if (!document.getElementById("platform-coverage-hero") && !document.getElementById("metric-kenya-locations")) return;
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
      if (typeof val === "number" && val > 0) {
        const formatted = fmt(val);
        const el = document.getElementById(id);
        if (el) el.textContent = formatted;
        document.querySelectorAll(`[data-metric-mirror="${id}"]`).forEach((mirrorEl) => {
          mirrorEl.textContent = formatted;
        });
      }
    }
  } catch (err) {
    console.warn("Failed to refresh Kenya location metrics:", err);
  }
}

async function loadPlatformStores() {
  let stores = [];
  try {
    const res = await apiFetch("/api/platform/stores");
    if (res.ok && res.data?.success && Array.isArray(res.data.data)) {
      stores = res.data.data;
    }
  } catch (err) {
    console.warn("Failed to load platform stores:", err);
  }

  const liveStores = stores.filter((s) => s && s.id && !s.id.startsWith("tenant-demo-"));

  platformLiveStoresCache = liveStores;
  renderFeaturedStoreShowcase(liveStores);
  renderPinnedStoresSection();
  renderPlatformDirectoryFilters(liveStores);
  filterPlatformStores();

  renderIcons();
}

if (typeof document !== "undefined") {
  document.addEventListener("click", (event) => {
    const btn = event.target?.closest?.("[data-platform-action]");
    if (!btn) return;
    const action = btn.dataset.platformAction;
    if (action === "toggle-follow") {
      event.preventDefault();
      event.stopPropagation();
      try {
        const parsed = JSON.parse(btn.dataset.followStore || "null");
        if (parsed) toggleFollowStore(parsed, event);
      } catch {}
    } else if (action === "unpin-store") {
      try {
        const parsed = JSON.parse(btn.dataset.unpinStore || "null");
        if (parsed) toggleFollowStore(parsed, event);
      } catch {}
    } else if (action === "filter-type") {
      setPlatformTypeFilter(btn.dataset.type || "");
    } else if (action === "open-onboard") {
      if (typeof toggleDrawer === "function") toggleDrawer("onboard-modal", true);
    } else if (action === "reset-store-filters") {
      const searchEl = document.getElementById("platform-store-search");
      if (searchEl) searchEl.value = "";
      setPlatformTypeFilter("");
    }
  });

  document.addEventListener(
    "error",
    (event) => {
      const img = event.target;
      if (img instanceof HTMLImageElement && img.dataset.avatarInitial !== undefined && img.parentElement) {
        img.parentElement.textContent = img.dataset.avatarInitial || "S";
      }
    },
    true
  );
}

// Initialization
window.addEventListener("DOMContentLoaded", () => {
  if (typeof setThemePalette === "function") setThemePalette("trust-forest");
  renderIcons();
  updateCartBadge();
  renderPinnedStoresSection();
  loadPlatformLocationMetrics();
  loadStoreProfile().then(() => {
    const url = new URL(window.location.href);
    if (!state.activeTenantSlug && url.hash === "#open-store" && typeof toggleDrawer === "function") {
      toggleDrawer("onboard-modal", true);
    }
    const loginResult = url.searchParams.get("_customer_login");
    if (!loginResult || !state.activeTenantSlug) return;
    url.searchParams.delete("_customer_login");
    window.history.replaceState({}, "", url.toString());
    toggleDrawer("orders-drawer", true);
    if (loginResult === "error") showToast("Google sign-in was cancelled or failed. Please try again.", "error");
  });
});
