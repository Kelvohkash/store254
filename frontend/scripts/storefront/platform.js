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

let activeTemplateVibeFilter = "all";

function getTemplateVibeCategory(templateId) {
  if (templateId === "cute-boutique") return "cute";
  if (templateId === "food-local") return "food";
  if (["editorial-boutique", "fashion-beauty-cosmetics"].includes(templateId)) return "fashion";
  if (["tech-home", "market-modern"].includes(templateId)) return "tech";
  if (["luxury-atelier", "premium-maker", "service-studio"].includes(templateId)) return "luxury";
  if (["brutalist-studio", "bazaar-vibrant"].includes(templateId)) return "bold";
  return "all";
}

function buildMiniPreviewHtml(template) {
  const id = template.id;
  const subdomain = id.replace(/[^a-z0-9]/g, "");

  if (id === "cute-boutique") {
    return `
      <div class="mini-browserbar mini-cute-bar">
        <span class="mini-dots"><i class="dot-pink"></i><i class="dot-purple"></i><i class="dot-peach"></i></span>
        <span class="mini-domain">${subdomain}.store254.co.ke</span>
        <span class="mini-status-pill pill-cute">Sweet Finds 💕</span>
      </div>
      <div class="mini-hero cute-hero">
        <span class="mini-badge-pill">✨ SWEET FINDS &amp; GIFTS</span>
        <strong class="mini-title">Little treasures that make you smile</strong>
        <span class="mini-btn-pill">Shop cute finds 🌸</span>
      </div>
      <div class="mini-products-grid cute-grid">
        <div class="mini-card-bubbly"><span class="mini-card-img img-pastel-pink"></span><strong class="mini-card-name">Teddy Plush</strong><span class="mini-card-price">KES 1,200</span></div>
        <div class="mini-card-bubbly"><span class="mini-card-img img-pastel-purple"></span><strong class="mini-card-name">Candy Mug</strong><span class="mini-card-price">KES 650</span></div>
        <div class="mini-card-bubbly"><span class="mini-card-img img-pastel-peach"></span><strong class="mini-card-name">Pastel Journal</strong><span class="mini-card-price">KES 480</span></div>
      </div>
    `;
  }

  if (id === "food-local") {
    return `
      <div class="mini-canopy-stripe"></div>
      <div class="mini-browserbar mini-food-bar">
        <span class="mini-dots"><i class="dot-amber"></i><i class="dot-amber"></i><i class="dot-green"></i></span>
        <span class="mini-domain">${subdomain}.store254.co.ke</span>
        <span class="mini-status-pill pill-food">Kitchen Live 🍲</span>
      </div>
      <div class="mini-hero food-hero">
        <span class="mini-badge-warm">🔥 FRESH DAILY SPECIALS</span>
        <strong class="mini-title">Taste the heart of local cooking</strong>
        <span class="mini-btn-warm">Order takeaway 🥘</span>
      </div>
      <div class="mini-menu-list">
        <div class="mini-menu-row"><span>Swahili Beef Biryani</span><i class="menu-divider-dots"></i><b class="menu-price-pill">KES 650</b></div>
        <div class="mini-menu-row"><span>Coconut Fish Curry</span><i class="menu-divider-dots"></i><b class="menu-price-pill">KES 800</b></div>
        <div class="mini-menu-row"><span>Fresh Hibiscus Zobo</span><i class="menu-divider-dots"></i><b class="menu-price-pill">KES 200</b></div>
      </div>
    `;
  }

  if (id === "luxury-atelier") {
    return `
      <div class="mini-browserbar mini-luxury-bar">
        <span class="mini-dots"><i class="dot-gold"></i><i></i><i></i></span>
        <span class="mini-domain">${subdomain}.store254.co.ke</span>
        <span class="mini-status-pill pill-luxury">HAUTE ATELIER</span>
      </div>
      <div class="mini-hero luxury-hero">
        <span class="mini-badge-gold">COLLECTION 2026</span>
        <strong class="mini-title-serif">Timeless elegance, handcrafted in Nairobi.</strong>
        <span class="mini-btn-hairline">Explore collection</span>
      </div>
      <div class="mini-products-grid luxury-grid">
        <div class="mini-card-hairline"><span class="mini-card-img img-obsidian"></span><strong class="mini-card-name">Silk Kimono</strong><span class="mini-card-price">KES 14,500</span></div>
        <div class="mini-card-hairline"><span class="mini-card-img img-brass"></span><strong class="mini-card-name">Onyx Pendant</strong><span class="mini-card-price">KES 8,900</span></div>
        <div class="mini-card-hairline"><span class="mini-card-img img-taupe"></span><strong class="mini-card-name">Structured Tote</strong><span class="mini-card-price">KES 22,000</span></div>
      </div>
    `;
  }

  if (id === "brutalist-studio") {
    return `
      <div class="mini-browserbar brutalist-bar">
        <span class="mini-dots"><i class="dot-black"></i><i class="dot-black"></i><i class="dot-red"></i></span>
        <span class="mini-domain">${subdomain}.store254.co.ke</span>
        <span class="mini-status-pill brutalist-tag">DROP 04</span>
      </div>
      <div class="mini-hero brutalist-hero">
        <span class="mini-badge-mono">NO COMPROMISE // NAIROBI</span>
        <strong class="mini-title-heavy">STREETWEAR FOR THE UNAPOLOGETIC</strong>
        <span class="mini-btn-brutal">GRAB DROP &rarr;</span>
      </div>
      <div class="mini-products-grid brutalist-grid">
        <div class="mini-card-brutal"><span class="mini-card-img img-scarlet"></span><strong class="mini-card-name">HEAVY TEE</strong><span class="mini-card-price">KES 3,200</span></div>
        <div class="mini-card-brutal"><span class="mini-card-img img-mono"></span><strong class="mini-card-name">CARGO V2</strong><span class="mini-card-price">KES 5,800</span></div>
        <div class="mini-card-brutal"><span class="mini-card-img img-ink"></span><strong class="mini-card-name">CAP RAW</strong><span class="mini-card-price">KES 1,900</span></div>
      </div>
    `;
  }

  if (id === "tech-home") {
    return `
      <div class="mini-browserbar mini-tech-bar">
        <span class="mini-dots"><i class="dot-blue"></i><i></i><i></i></span>
        <span class="mini-domain">${subdomain}.store254.co.ke</span>
        <span class="mini-status-pill pill-tech">Bento Spec</span>
      </div>
      <div class="mini-hero tech-hero">
        <span class="mini-badge-tech">SPEC-FIRST HARDWARE</span>
        <strong class="mini-title">Next-Gen Audio &amp; Smart Living</strong>
        <span class="mini-btn-tech">Compare specs</span>
      </div>
      <div class="mini-products-grid tech-grid">
        <div class="mini-card-bento"><span class="mini-card-img img-slate"></span><span class="mini-spec-chip">4K &bull; 120Hz</span><strong class="mini-card-name">Monitor 27"</strong><span class="mini-card-price">KES 38,000</span></div>
        <div class="mini-card-bento"><span class="mini-card-img img-cyan"></span><span class="mini-spec-chip">ANC &bull; 40H</span><strong class="mini-card-name">Studio Pro</strong><span class="mini-card-price">KES 12,500</span></div>
        <div class="mini-card-bento"><span class="mini-card-img img-steel"></span><span class="mini-spec-chip">100W GaN</span><strong class="mini-card-name">Fast Hub</strong><span class="mini-card-price">KES 4,500</span></div>
      </div>
    `;
  }

  if (id === "service-studio") {
    return `
      <div class="mini-browserbar mini-service-bar">
        <span class="mini-dots"><i class="dot-clay"></i><i></i><i></i></span>
        <span class="mini-domain">${subdomain}.store254.co.ke</span>
        <span class="mini-status-pill pill-service">Appointments</span>
      </div>
      <div class="mini-hero service-hero">
        <span class="mini-badge-service">CREATIVE &amp; CONSULTING</span>
        <strong class="mini-title-serif">Space to create, expertise to guide.</strong>
        <span class="mini-btn-service">Book session</span>
      </div>
      <div class="mini-products-grid service-grid">
        <div class="mini-card-service"><div class="mini-accent-bar"></div><strong class="mini-card-name">Brand Audit</strong><small class="mini-meta">60 min video</small><span class="mini-card-price">KES 7,500</span></div>
        <div class="mini-card-service"><div class="mini-accent-bar"></div><strong class="mini-card-name">Photo Studio</strong><small class="mini-meta">Half-day hire</small><span class="mini-card-price">KES 18,000</span></div>
        <div class="mini-card-service"><div class="mini-accent-bar"></div><strong class="mini-card-name">Design Sprint</strong><small class="mini-meta">Full package</small><span class="mini-card-price">KES 45,000</span></div>
      </div>
    `;
  }

  if (id === "editorial-boutique") {
    return `
      <div class="mini-browserbar mini-editorial-bar">
        <span class="mini-dots"><i class="dot-oat"></i><i></i><i></i></span>
        <span class="mini-domain">${subdomain}.store254.co.ke</span>
        <span class="mini-status-pill pill-editorial">Lookbook</span>
      </div>
      <div class="mini-hero editorial-hero">
        <span class="mini-badge-editorial">A CONSIDERED EDIT</span>
        <strong class="mini-title-serif">A little more beautiful, every day.</strong>
        <span class="mini-btn-editorial">Discover the edit</span>
      </div>
      <div class="mini-products-grid editorial-grid">
        <div class="mini-card-editorial"><span class="mini-card-img img-oat"></span><strong class="mini-card-name">Linen Wrap</strong><span class="mini-card-price">KES 6,200</span></div>
        <div class="mini-card-editorial"><span class="mini-card-img img-mocha"></span><strong class="mini-card-name">Amber Vessel</strong><span class="mini-card-price">KES 3,800</span></div>
        <div class="mini-card-editorial"><span class="mini-card-img img-sage"></span><strong class="mini-card-name">Ceramic Cup</strong><span class="mini-card-price">KES 1,950</span></div>
      </div>
    `;
  }

  if (id === "fashion-beauty-cosmetics") {
    return `
      <div class="mini-browserbar mini-fashion-bar">
        <span class="mini-dots"><i class="dot-teal"></i><i></i><i></i></span>
        <span class="mini-domain">${subdomain}.store254.co.ke</span>
        <span class="mini-status-pill pill-fashion">Runway</span>
      </div>
      <div class="mini-hero fashion-hero">
        <span class="mini-badge-fashion">THE NEW SEASON</span>
        <strong class="mini-title-serif">Glow, radiance and editorial elegance.</strong>
        <span class="mini-btn-fashion">Shop Beauty Edit</span>
      </div>
      <div class="mini-products-grid fashion-grid">
        <div class="mini-card-fashion"><span class="mini-card-img img-blush"></span><strong class="mini-card-name">Glow Serum</strong><span class="mini-card-price">KES 3,400</span></div>
        <div class="mini-card-fashion"><span class="mini-card-img img-rose"></span><strong class="mini-card-name">Velvet Lip</strong><span class="mini-card-price">KES 1,850</span></div>
        <div class="mini-card-fashion"><span class="mini-card-img img-gold"></span><strong class="mini-card-name">Flora EDP</strong><span class="mini-card-price">KES 7,900</span></div>
      </div>
    `;
  }

  if (id === "premium-maker") {
    return `
      <div class="mini-browserbar mini-maker-bar">
        <span class="mini-dots"><i class="dot-bronze"></i><i></i><i></i></span>
        <span class="mini-domain">${subdomain}.store254.co.ke</span>
        <span class="mini-status-pill pill-maker">Artisan</span>
      </div>
      <div class="mini-hero maker-hero">
        <span class="mini-badge-bronze">HANDCRAFTED IN KENYA</span>
        <strong class="mini-title-serif">Form, weight, and lasting patience.</strong>
        <span class="mini-btn-bronze">Explore workshop</span>
      </div>
      <div class="mini-products-grid maker-grid">
        <div class="mini-card-maker"><span class="mini-card-img img-leather"></span><strong class="mini-card-name">Weekender Bag</strong><span class="mini-card-price">KES 16,500</span></div>
        <div class="mini-card-maker"><span class="mini-card-img img-brass"></span><strong class="mini-card-name">Brass Compass</strong><span class="mini-card-price">KES 4,200</span></div>
        <div class="mini-card-maker"><span class="mini-card-img img-wood"></span><strong class="mini-card-name">Olive Board</strong><span class="mini-card-price">KES 3,600</span></div>
      </div>
    `;
  }

  if (id === "bazaar-vibrant") {
    return `
      <div class="mini-browserbar mini-bazaar-bar">
        <span class="mini-dots"><i class="dot-orange"></i><i></i><i></i></span>
        <span class="mini-domain">${subdomain}.store254.co.ke</span>
        <span class="mini-status-pill pill-bazaar">Lively</span>
      </div>
      <div class="mini-hero bazaar-hero">
        <span class="mini-badge-orange">🔥 KENYAN MARKET DEALS</span>
        <strong class="mini-title-bold">Vibrant finds, fast dispatch everywhere</strong>
        <span class="mini-btn-orange">Shop the Bazaar</span>
      </div>
      <div class="mini-products-grid bazaar-grid">
        <div class="mini-card-bazaar"><span class="mini-card-img img-tangerine"></span><strong class="mini-card-name">Kiondo Tote</strong><span class="mini-card-price">KES 2,400</span></div>
        <div class="mini-card-bazaar"><span class="mini-card-img img-yellow"></span><strong class="mini-card-name">Beaded Wrap</strong><span class="mini-card-price">KES 1,500</span></div>
        <div class="mini-card-bazaar"><span class="mini-card-img img-spice"></span><strong class="mini-card-name">Safari Sandals</strong><span class="mini-card-price">KES 2,800</span></div>
      </div>
    `;
  }

  // Default: market-modern
  return `
    <div class="mini-browserbar mini-market-bar">
      <span class="mini-dots"><i class="dot-green"></i><i></i><i></i></span>
      <span class="mini-domain">${subdomain}.store254.co.ke</span>
      <span class="mini-status-pill pill-market">Verified</span>
    </div>
    <div class="mini-hero market-hero">
      <span class="mini-badge-green">EVERYDAY SHOPPING</span>
      <strong class="mini-title">Good things, chosen well.</strong>
      <span class="mini-btn-green">Explore collection</span>
    </div>
    <div class="mini-products-grid market-grid">
      <div class="mini-card-market"><span class="mini-card-img img-green"></span><strong class="mini-card-name">Canvas Tote</strong><span class="mini-card-price">KES 1,800</span></div>
      <div class="mini-card-market"><span class="mini-card-img img-leaf"></span><strong class="mini-card-name">Ceramic Mug</strong><span class="mini-card-price">KES 950</span></div>
      <div class="mini-card-market"><span class="mini-card-img img-earth"></span><strong class="mini-card-name">Soy Candle</strong><span class="mini-card-price">KES 1,400</span></div>
    </div>
  `;
}

async function renderPublicTemplateGallery() {
  const gallery = document.getElementById("public-template-gallery");
  if (!gallery) return;
  const catalog = await loadStorefrontTemplateCatalog();
  storefrontTemplateCatalogForOnboarding = catalog;
  gallery.replaceChildren();

  // Setup vibe filter tabs
  document.querySelectorAll(".template-filter-tab").forEach((tab) => {
    tab.onclick = () => {
      activeTemplateVibeFilter = tab.dataset.vibeFilter || "all";
      document.querySelectorAll(".template-filter-tab").forEach((t) => t.classList.toggle("is-active", t === tab));
      filterGalleryCards();
    };
  });

  catalog.templates.forEach((template, index) => {
    const card = document.createElement("article");
    card.className = "template-gallery-card";
    card.dataset.template = template.id;
    card.dataset.vibe = getTemplateVibeCategory(template.id);

    const visual = document.createElement("div");
    visual.className = "template-gallery-art";
    visual.dataset.template = template.id;
    visual.innerHTML = buildMiniPreviewHtml(template);

    const caption = document.createElement("div");
    caption.className = "template-gallery-card-caption";
    const indexLabel = document.createElement("span");
    indexLabel.className = "template-gallery-index";
    indexLabel.textContent = String(index + 1).padStart(2, "0");

    const details = document.createElement("div");
    details.className = "template-gallery-details";

    const headerRow = document.createElement("div");
    headerRow.className = "template-gallery-header-row";
    const name = document.createElement("strong");
    name.textContent = template.name;
    headerRow.append(name);

    if (template.mood) {
      const moodBadge = document.createElement("span");
      moodBadge.className = "template-gallery-mood-badge";
      moodBadge.textContent = template.mood;
      headerRow.append(moodBadge);
    }

    const description = document.createElement("small");
    description.textContent = template.description || "A ready-to-use Store254 storefront design.";
    details.append(headerRow, description);
    caption.append(indexLabel, details);

    const actionRow = document.createElement("div");
    actionRow.className = "template-gallery-action-row";

    const action = document.createElement("button");
    action.type = "button";
    action.className = "template-gallery-start";
    action.textContent = "Start with this theme";
    action.addEventListener("click", () => startWithStorefrontTemplate(template.id));

    const previewLink = document.createElement("a");
    previewLink.className = "template-gallery-preview-link";
    previewLink.href = `/templates/${template.preview || `${template.id}/preview.html`}`;
    previewLink.target = "_blank";
    previewLink.rel = "noopener noreferrer";
    previewLink.title = `Open interactive ${template.name} preview with color test controls`;
    previewLink.innerHTML = "<span>Live preview</span> ↗";

    actionRow.append(action, previewLink);
    card.append(visual, caption, actionRow);
    gallery.append(card);
  });

  filterGalleryCards();
}

function filterGalleryCards() {
  document.querySelectorAll(".template-gallery-card").forEach((card) => {
    const cardVibe = card.dataset.vibe || "all";
    const show = activeTemplateVibeFilter === "all" || cardVibe === activeTemplateVibeFilter;
    card.style.display = show ? "" : "none";
  });
}

function startWithStorefrontTemplate(templateId) {
  const catalog = storefrontTemplateCatalogForOnboarding;
  const template = catalog.templates.find((entry) => entry.id === templateId)
    || catalog.templates.find((entry) => entry.id === "market-modern");
  if (!template) return;
  const selectedTemplate = document.getElementById("onboard-storefront-template");
  const selectedLabel = document.getElementById("onboard-selected-theme");
  if (selectedTemplate) selectedTemplate.value = template.id;
  if (selectedLabel) selectedLabel.textContent = `Starting theme: ${template.name}`;
  toggleDrawer("onboard-modal", true);
}

let storefrontTemplateCatalogForOnboarding = { templates: [] };

function togglePlatformMobileMenu(show) {
  const menu = document.getElementById("platform-mobile-menu");
  const button = document.getElementById("mobile-menu-toggle");
  const icon = document.getElementById("mobile-menu-icon");
  if (!menu || !button) return;

  const open = typeof show === "boolean" ? show : menu.hidden;
  menu.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
  button.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
  icon?.setAttribute("data-lucide", open ? "x" : "menu");
  renderIcons();
}

function toggleStorefrontMenu() {
  if (document.documentElement.dataset.storefrontTemplate !== "fashion-beauty-cosmetics") {
    togglePlatformMobileMenu();
    return;
  }
  const menu = document.getElementById("fashion-mobile-menu");
  const button = document.getElementById("mobile-menu-toggle");
  const icon = document.getElementById("mobile-menu-icon");
  if (!menu || !button) return;
  menu.hidden = !menu.hidden;
  button.setAttribute("aria-expanded", String(!menu.hidden));
  button.setAttribute("aria-label", menu.hidden ? "Open store menu" : "Close store menu");
  icon?.setAttribute("data-lucide", menu.hidden ? "menu" : "x");
  renderIcons();
}

function renderFeaturedStoreShowcase(stores) {
  const carousel = document.querySelector(".showcase-carousel");
  const controls = document.querySelector(".showcase-carousel-controls");
  if (!carousel || !controls) return;

  // Keep the hero card deck visible even before any stores are active or when the directory is offline.
  const hasLiveStores = stores.length > 0;
  const featured = hasLiveStores ? [...stores] : [
    { name: "Launch your local online store in minutes", settings: {} },
    { name: "Your store. Your domain. Your customers.", settings: {} },
    { name: "Everything your business has to offer in one place.", settings: {} },
  ];
  const ownerBadge = document.querySelector(".showcase-float-tag");
  if (ownerBadge) ownerBadge.hidden = !hasLiveStores;
  for (let i = featured.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [featured[i], featured[j]] = [featured[j], featured[i]];
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
      link.href = `https://${store.subdomain}.store254.co.ke/`;
      link.setAttribute("aria-label", `Visit ${name}`);
      link.innerHTML = '<i data-lucide="arrow-up-right" class="w-4 h-4"></i>';
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
  return `https://${safeSub}.store254.co.ke/`;
}

// 17. Platform Mode: Load All Stores
async function loadPlatformStores() {
  const container = document.getElementById("platform-stores-grid");
  await renderPublicTemplateGallery();

  const res = await apiFetch("/api/platform/stores");
  const stores = (res.ok && res.data.success && Array.isArray(res.data.data)) ? res.data.data : [];
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
        <span class="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded text-[10px] font-mono uppercase">${escapeHtml(s.businessType)}</span>
      </div>
    </a>
  `).join("");

  renderIcons();
}

// 18. Store Switcher — navigate to the proper subdomain
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

// 19. UI Drawer Toggles
function toggleDrawer(id, show) {
  const el = document.getElementById(id);
  if (!el) return;

  if (show) {
    el.classList.remove("hidden");
    if (id === "cart-drawer") {
      renderCartDrawer();
      void refreshCheckoutCustomerProfile();
      void maybePromptGuestSignIn("cart");
    }
    if (id === "orders-drawer") loadMyOrders();
  } else {
    el.classList.add("hidden");
    if (id === "mpesa-pin-modal") stopPaymentStatusPolling();
  }
  renderIcons();
}

async function confirmOrderDelivered(orderId, orderNumber, phoneNumber) {
  if (!window.confirm(`Confirm that order #${orderNumber} has been delivered to you?`)) return;

  const result = await apiFetch(`/api/orders/${orderId}/confirm-delivery`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!result.ok || !result.data?.success) {
    showToast(result.data?.error?.message || "Could not confirm delivery. Please try again.", "error");
    return;
  }

  await loadMyOrders();
  const payment = result.data.data;
  if (payment?.checkoutRequestId) {
    toggleDrawer("orders-drawer", false);
    openMpesaPinModal(
      payment.checkoutRequestId,
      payment.orderNumber || orderNumber,
      payment.totalAmount,
      payment.phoneNumber || phoneNumber,
      payment.paymentStatusToken
    );
    return;
  }
  showToast(result.data.message || "Delivery confirmed.");
}

// 20. Customer Order Tracking (My Orders)
async function loadMyOrders() {
  const container = document.getElementById("my-orders-container");
  if (!container) return;
  renderCustomerAuth();

  let profileRes = await apiFetch("/api/auth/me");
  if (state.customerToken && profileRes.status === 401) {
    clearCustomerSession();
    profileRes = await apiFetch("/api/auth/me");
  }
  if (!profileRes.ok || !profileRes.data?.success || profileRes.data.data?.role !== "CUSTOMER") {
    const invalidSession = [401, 404].includes(profileRes.status) ||
      (profileRes.ok && profileRes.data?.success && profileRes.data.data?.role !== "CUSTOMER");
    if (invalidSession) {
      clearCustomerSession();
      state.myOrders = [];
      renderCustomerAuth();
      void initializeGoogleSignIn();
      container.innerHTML = `
        <p class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Sign in with Google to view your order history.
        </p>
      `;
    } else {
      container.innerHTML = `
        <p class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          We couldn't verify your profile right now. Check your connection and try again.
        </p>
      `;
    }
    return;
  }

  const profile = profileRes.data.data;
  if (!profile || profile.role !== "CUSTOMER") {
    container.innerHTML = `
      <p class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
        The customer profile response was invalid. Please try again.
      </p>
    `;
    return;
  }
  persistCustomerSession(profile, state.customerToken || null);
  renderCustomerAuth();

  const res = await apiFetch("/api/orders/my-orders");
  if (res.ok && res.data.success) {
    state.myOrders = res.data.data;
    renderCustomerAuth();
    if (state.myOrders.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center text-slate-400">
          <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-300">
            <i data-lucide="package-check" class="w-6 h-6"></i>
          </div>
          <p class="text-xs font-semibold text-slate-600">No past orders found.</p>
        </div>
      `;
      renderIcons();
      return;
    }

    let html = "";
    for (const order of state.myOrders) {
      html += `
        <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-2.5 text-xs">
          <div class="flex justify-between items-center mb-1.5">
            <span class="font-bold font-mono text-slate-900">#${escapeHtml(order.orderNumber)}</span>
            <span class="px-2 py-0.5 rounded font-bold text-[10px] ${
              order.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
            }">${order.status === "COMPLETED" ? "DELIVERED" : escapeHtml(order.status)}</span>
          </div>
          <p class="text-slate-600">Total: <strong>KES ${Number(order.totalAmount).toLocaleString()}</strong></p>
          <p class="text-slate-600 mt-1">
            Payment: <strong>${order.paymentMethod === "CASH_ON_DELIVERY" ? "Cash on delivery" : "M-Pesa"} · ${order.paymentStatus === "PAID" ? "Paid" : "Payment due"}</strong>
          </p>
          ${
            order.status === "SHIPPED"
              ? `<button type="button" onclick="confirmOrderDelivered('${escapeHtml(order.id)}', '${escapeHtml(order.orderNumber)}', '${escapeHtml(order.customerPhone || "")}')" class="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-700">
                  <i data-lucide="package-check" class="mr-1 inline h-4 w-4 align-text-bottom"></i>
                  I received this order · Confirm delivery
                </button>`
              : ""
          }
          ${
            order.paymentInstructions
              ? `<div class="mt-3 p-3 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900">
                  <p class="font-bold">M-Pesa payment instructions</p>
                  <p class="mt-1">${order.paymentInstructions.method === "PAYBILL" ? "Paybill" : "Till"}: <strong>${escapeHtml(order.paymentInstructions.shortcode)}</strong></p>
                  ${
                    order.paymentInstructions.accountReference
                      ? `<p>Account number: <strong>${escapeHtml(order.paymentInstructions.accountReference)}</strong></p>`
                      : ""
                  }
                  <p>Amount: <strong>${escapeHtml(order.paymentInstructions.currency)} ${Number(order.paymentInstructions.amount).toLocaleString()}</strong></p>
                </div>`
              : ""
          }
          ${
            order.fulfillmentDetails?.trackingNumber
              ? `<p class="text-emerald-700 mt-2 flex items-center gap-1.5">
                  <i data-lucide="truck" class="w-3.5 h-3.5"></i>
                  <span>Tracking: <strong>${escapeHtml(order.fulfillmentDetails.trackingNumber)}</strong> (${escapeHtml(order.fulfillmentDetails.courierName || "Courier")})</span>
                </p>`
              : ""
          }
        </div>
      `;
    }
    container.innerHTML = html;
    renderIcons();
  } else {
    if (res.status === 401) {
      clearCustomerSession();
      state.myOrders = [];
      renderCustomerAuth();
      void initializeGoogleSignIn();
    }
    container.innerHTML = `
      <p class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
        ${res.data?.error?.message || "Could not load your orders. Please try again."}
      </p>
    `;
  }
}

// 22. Initialization
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
