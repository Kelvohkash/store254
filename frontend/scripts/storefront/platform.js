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

async function renderPublicTemplateGallery() {
  const gallery = document.getElementById("public-template-gallery");
  if (!gallery) return;
  const catalog = await loadStorefrontTemplateCatalog();
  storefrontTemplateCatalogForOnboarding = catalog;
  gallery.replaceChildren();

  catalog.templates.forEach((template, index) => {
    const card = document.createElement("article");
    card.className = "template-gallery-card";
    card.dataset.template = template.id;

    const visual = document.createElement("div");
    visual.className = "template-gallery-art";
    visual.dataset.template = template.id;
    const imageUrl = safeShowcaseImageUrl(template.previewImage);
    if (imageUrl) {
      visual.style.backgroundImage = `linear-gradient(90deg, rgba(10,30,38,.72), rgba(10,30,38,.08)), url("${imageUrl}")`;
      visual.classList.add("has-preview-image");
    }

    const browserBar = document.createElement("div");
    browserBar.className = "template-gallery-browserbar";
    browserBar.innerHTML = "<i></i><i></i><i></i><span>yourstore.store254.co.ke</span>";
    const hero = document.createElement("div");
    hero.className = "template-gallery-hero-copy";
    const kicker = document.createElement("small");
    kicker.textContent = template.defaults?.kicker || "YOUR NEXT COLLECTION";
    const title = document.createElement("strong");
    title.textContent = String(template.defaults?.title || template.name).replace(/<br\s*\/?>/gi, " ");
    const callout = document.createElement("span");
    callout.textContent = template.defaults?.cta || "Explore the store";
    hero.append(kicker, title, callout);
    const products = document.createElement("div");
    products.className = "template-gallery-products";
    for (let product = 0; product < 3; product += 1) products.append(document.createElement("i"));
    visual.append(browserBar, hero, products);

    const caption = document.createElement("div");
    caption.className = "template-gallery-card-caption";
    const indexLabel = document.createElement("span");
    indexLabel.className = "template-gallery-index";
    indexLabel.textContent = String(index + 1).padStart(2, "0");
    const details = document.createElement("div");
    details.className = "template-gallery-details";
    const name = document.createElement("strong");
    name.textContent = template.name;
    const description = document.createElement("small");
    description.textContent = template.description || "A ready-to-use Store254 storefront design.";
    details.append(name, description);
    caption.append(indexLabel, details);

    const action = document.createElement("button");
    action.type = "button";
    action.className = "template-gallery-start";
    action.textContent = "Start with this theme";
    action.addEventListener("click", () => startWithStorefrontTemplate(template.id));
    card.append(visual, caption, action);
    gallery.append(card);
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
