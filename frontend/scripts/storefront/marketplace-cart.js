(function () {
  "use strict";

  const PLATFORM_CART_KEY = "store254_platform_cart_v1";
  const WELCOME_DISMISSED_KEY = "store254_welcome_dismissed_v1";
  const PHONE_STORAGE_KEY = "store254_buyer_phone_v1";

  let platformUser = null;
  let platformGoogleEnabled = false;
  let platformGoogleLoginPath = "/auth/google/login";
  let welcomeCounties = [];
  let welcomeSelectedCounty = null;
  let welcomeTownTimer = null;
  let activeQuickViewData = null;
  let selectedVariantId = null;
  let quickViewQty = 1;
  let quickViewImageIndex = 0;
  let activeCheckoutQueue = [];
  let activeCheckoutIndex = 0;
  let activePollTimer = null;

  function isPlatformRootMode() {
    return document.documentElement.dataset.storefront !== "true";
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatKes(amount, currency = "KES") {
    return `${currency || "KES"} ${Number(amount || 0).toLocaleString("en-KE")}`;
  }

  function showToast(msg, type = "info") {
    if (typeof window.showToast === "function") {
      window.showToast(msg, type);
      return;
    }
    const toast = document.createElement("div");
    toast.className =
      "fixed bottom-5 left-1/2 -translate-x-1/2 z-[120] px-4 py-2.5 rounded-xl text-xs font-bold shadow-xl border " +
      (type === "error"
        ? "bg-rose-950 text-white border-rose-800"
        : type === "success"
        ? "bg-emerald-900 text-white border-emerald-700"
        : "bg-slate-900 text-white border-slate-700");
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function readCart() {
    try {
      const raw = localStorage.getItem(PLATFORM_CART_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeCart(cart) {
    try {
      localStorage.setItem(PLATFORM_CART_KEY, JSON.stringify(cart));
    } catch {}
    syncMarketplaceHeaderState();
  }

  function getCartTotalCount() {
    return readCart().reduce((sum, entry) => sum + Number(entry.quantity || 1), 0);
  }

  function syncMarketplaceHeaderState() {
    if (!isPlatformRootMode()) return;

    const totalCount = getCartTotalCount();
    ["platform-cart-badge", "platform-mobile-cart-badge", "platform-bottom-cart-badge"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = String(totalCount);
      el.classList.toggle("hidden", totalCount <= 0);
    });

    const loc = typeof window.getStore254BuyerLocation === "function" ? window.getStore254BuyerLocation() : null;
    const locLabel = loc?.locationName
      ? `${loc.locationName}${loc.countyName ? `, ${loc.countyName}` : ""}`
      : loc?.countyName
      ? `${loc.countyName} County`
      : loc?.lat
      ? "Near GPS Location"
      : "Pick Your Town";

    const navLocText = document.getElementById("platform-nav-location-label");
    if (navLocText) navLocText.textContent = locLabel;

    const mobileLocText = document.getElementById("platform-mobile-location-label");
    if (mobileLocText) mobileLocText.textContent = locLabel;

    const heroTitle = document.getElementById("buyer-hero-status-text");
    if (heroTitle) {
      heroTitle.textContent = loc?.locationName
        ? `Showing products near ${locLabel} first — rippling outward if nearby centres lack stock.`
        : "Pick your town once to see locally available stock first, then buy from any shop without hopping tabs.";
    }

    const navAccountEl = document.getElementById("platform-nav-account-label");
    const heroSigninBtn = document.getElementById("buyer-hero-signin-btn");
    const mobileAuthLabel = document.getElementById("platform-mobile-account-label");
    const bottomAuthLabel = document.getElementById("platform-bottom-account-label");
    if (platformUser) {
      const firstName = (platformUser.fullName || platformUser.email || "Account").split(" ")[0];
      if (navAccountEl) navAccountEl.textContent = firstName;
      if (mobileAuthLabel) mobileAuthLabel.textContent = `Signed in as ${firstName}`;
      if (bottomAuthLabel) bottomAuthLabel.textContent = firstName;
      if (heroSigninBtn) {
        heroSigninBtn.innerHTML = `<i data-lucide="user-check" class="w-3.5 h-3.5"></i><span>${escapeHtml(firstName)} · My Orders</span>`;
        heroSigninBtn.onclick = () => window.openMarketplaceOrdersModal();
      }
    } else {
      if (navAccountEl) navAccountEl.textContent = "Sign in";
      if (mobileAuthLabel) mobileAuthLabel.textContent = "Sign in with Google";
      if (bottomAuthLabel) bottomAuthLabel.textContent = "Account";
      if (heroSigninBtn) {
        heroSigninBtn.innerHTML = `<i data-lucide="log-in" class="w-3.5 h-3.5"></i><span>Sign in with Google</span>`;
        heroSigninBtn.onclick = () => window.openBuyerWelcomeModal(1);
      }
    }

    if (typeof window.renderIcons === "function") window.renderIcons();
  }

  window.getStore254PlatformUser = function getStore254PlatformUser() {
    return platformUser;
  };

  window.syncMarketplaceHeaderState = syncMarketplaceHeaderState;
  window.refreshStore254PlatformSession = refreshPlatformSession;

  async function refreshPlatformSession() {
    try {
      const [meRes, cfgRes] = await Promise.all([
        fetch("/api/platform/me", { credentials: "include", cache: "no-store" }),
        fetch("/api/platform/google-config", { credentials: "include", cache: "no-store" }),
      ]);
      const meJson = await meRes.json().catch(() => null);
      const cfgJson = await cfgRes.json().catch(() => null);

      platformUser = meJson?.data?.authenticated ? meJson.data.user : null;
      platformGoogleEnabled = Boolean(cfgJson?.data?.enabled);
      if (cfgJson?.data?.loginPath) {
        platformGoogleLoginPath = cfgJson.data.loginPath;
      }
    } catch {
      platformUser = null;
    }
    syncMarketplaceHeaderState();
    if (typeof window.syncOnboardModalAuthState === "function") {
      window.syncOnboardModalAuthState();
    }
    if (platformUser) {
      const s1 = document.getElementById("buyer-welcome-step-1");
      if (s1 && !s1.classList.contains("hidden")) {
        const savedLoc = typeof window.getStore254BuyerLocation === "function" ? window.getStore254BuyerLocation() : null;
        if (savedLoc?.countyId && savedLoc?.constituencyId) {
          window.closeBuyerWelcomeModal(false);
        } else {
          await window.goToBuyerWelcomeStep(2);
        }
      }
    }
  }

  window.startPlatformGoogleSignIn = function startPlatformGoogleSignIn() {
    if (!platformGoogleEnabled && window.location.protocol !== "https:") {
      showToast(
        "Google Sign-In requires store254.co.ke HTTPS. You can continue as Guest to test local shopping right now!",
        "info"
      );
      window.goToBuyerWelcomeStep(2);
      return;
    }
    const cleanUrlObj = new URL(window.location.href);
    cleanUrlObj.searchParams.delete("_customer_login");
    const target = `${platformGoogleLoginPath}?return_to=${encodeURIComponent(cleanUrlObj.toString())}`;
    window.location.href = target;
  };

  window.handlePlatformAccountClick = function handlePlatformAccountClick() {
    if (platformUser) {
      window.openMarketplaceOrdersModal();
      return;
    }
    window.openBuyerWelcomeModal(1);
  };

  window.signOutPlatformBuyer = async function signOutPlatformBuyer() {
    try {
      await fetch("/api/platform/logout", { method: "POST", credentials: "include" });
    } catch {}
    platformUser = null;
    syncMarketplaceHeaderState();
    window.closeMarketplaceOrdersModal();
    showToast("Signed out cleanly.", "info");
  };

  // --- Buyer Welcome Modal (Step 1: Google Sign-In Invite -> Step 2: Location Selector) ---
  window.openBuyerWelcomeModal = async function openBuyerWelcomeModal(step = 1) {
    const modal = document.getElementById("buyer-welcome-modal");
    if (!modal) return;
    let nextStep = step;
    if (nextStep === 1 && platformUser) {
      const savedLoc = typeof window.getStore254BuyerLocation === "function" ? window.getStore254BuyerLocation() : null;
      if (savedLoc?.countyId && savedLoc?.constituencyId) {
        window.closeBuyerWelcomeModal(false);
        return;
      }
      nextStep = 2;
    }
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    await window.goToBuyerWelcomeStep(nextStep);
    if (nextStep === 2) {
      await ensureWelcomeCountiesLoaded();
    }
    if (typeof window.renderIcons === "function") window.renderIcons();
  };

  function resetWelcomeGpsUi() {
    const btn = document.getElementById("welcome-auto-detect-btn");
    const statusEl = document.getElementById("welcome-gps-status");
    if (btn) {
      btn.disabled = false;
      const span = btn.querySelector("span");
      if (span) span.textContent = "Click to auto detect location";
    }
    if (statusEl) {
      statusEl.textContent = "";
      statusEl.className = "hidden text-[11px] font-semibold px-3 py-2 rounded-xl border";
    }
  }

  window.closeBuyerWelcomeModal = function closeBuyerWelcomeModal(markDismissed = false) {
    resetWelcomeGpsUi();
    const modal = document.getElementById("buyer-welcome-modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
    if (markDismissed) {
      try {
        localStorage.setItem(WELCOME_DISMISSED_KEY, "1");
      } catch {}
    }
  };

  window.dismissBuyerWelcomeModal = function dismissBuyerWelcomeModal() {
    window.closeBuyerWelcomeModal(true);
  };

  window.goToBuyerWelcomeStep = async function goToBuyerWelcomeStep(step) {
    const effectiveStep = step === 1 && platformUser ? 2 : step;
    const s1 = document.getElementById("buyer-welcome-step-1");
    const s2 = document.getElementById("buyer-welcome-step-2");
    if (s1) s1.classList.toggle("hidden", effectiveStep !== 1);
    if (s2) s2.classList.toggle("hidden", effectiveStep !== 2);

    const welcomeGreeting = document.getElementById("welcome-step2-greeting");
    if (welcomeGreeting) {
      if (platformUser) {
        const firstName = (platformUser.fullName || "there").split(" ")[0];
        welcomeGreeting.textContent = `Karibu ${firstName}! Pick your County & town so we prioritize local shops near you.`;
      } else {
        welcomeGreeting.textContent =
          "Pick your County and town/shopping centre. Everything on Store254 loads locally from there first — without account clutter.";
      }
    }

    const backBtn = document.getElementById("welcome-step2-back-btn");
    if (backBtn) backBtn.classList.toggle("hidden", Boolean(platformUser));

    if (effectiveStep === 2) {
      resetWelcomeGpsUi();
      window.backToWelcomeCountyStep();
      await ensureWelcomeCountiesLoaded();
    }
  };

  window.backToWelcomeCountyStep = function backToWelcomeCountyStep() {
    const countyStep = document.getElementById("welcome-county-step");
    const townWrap = document.getElementById("welcome-town-search-wrap");
    const countyInput = document.getElementById("welcome-county-filter");
    if (townWrap) townWrap.classList.add("hidden");
    if (countyStep) countyStep.classList.remove("hidden");
    if (countyInput) {
      countyInput.value = "";
      if (welcomeCounties.length > 0) {
        renderWelcomeCountyChips("");
      }
      countyInput.focus();
    }
  };

  window.retryWelcomeCounties = function retryWelcomeCounties() {
    ensureWelcomeCountiesLoaded();
  };

  async function ensureWelcomeCountiesLoaded() {
    const listEl = document.getElementById("welcome-county-list");
    if (welcomeCounties.length === 0 && Array.isArray(window.__store254CountiesCache) && window.__store254CountiesCache.length > 0) {
      welcomeCounties = window.__store254CountiesCache;
    }
    if (welcomeCounties.length > 0) {
      renderWelcomeCountyChips(document.getElementById("welcome-county-filter")?.value || "");
      return;
    }
    if (listEl) {
      listEl.innerHTML = `<span class="text-xs text-slate-400 px-1 py-1">Loading Kenyan counties…</span>`;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("/api/platform/locations/counties");
        const json = await res.json();
        const loaded = Array.isArray(json?.counties)
          ? json.counties
          : Array.isArray(json?.data?.counties)
          ? json.data.counties
          : Array.isArray(json?.data)
          ? json.data
          : [];
        if (res.ok && loaded.length > 0) {
          welcomeCounties = loaded;
          window.__store254CountiesCache = loaded;
          renderWelcomeCountyChips(document.getElementById("welcome-county-filter")?.value || "");
          return;
        }
      } catch {}
    }
    if (listEl) {
      listEl.innerHTML = `<button type="button" onclick="retryWelcomeCounties()" class="text-xs font-semibold text-emerald-700 underline px-1 py-1">Could not load counties — tap to retry</button>`;
    }
  }

  function renderWelcomeCountyChips(filterText) {
    const listEl = document.getElementById("welcome-county-list");
    if (!listEl) return;
    if (welcomeCounties.length === 0) {
      ensureWelcomeCountiesLoaded();
      return;
    }
    const norm = (s) => String(s || "").toLowerCase().replace(/['’-]/g, "").trim();
    const q = norm(filterText);
    const matches = welcomeCounties
      .filter((c) => !q || norm(c.name).includes(q) || c.name.toLowerCase().includes((filterText || "").trim().toLowerCase()))
      .slice(0, q ? 16 : 12);

    if (matches.length === 0) {
      listEl.innerHTML = `<span class="text-xs text-slate-500 px-1 py-1">No county matched "${escapeHtml(filterText)}"</span>`;
      return;
    }

    listEl.innerHTML = matches
      .map((c) => {
        const active = welcomeSelectedCounty?.id === c.id;
        return `<button type="button" onclick="selectWelcomeCounty('${escapeHtml(c.id)}')" class="px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
          active
            ? "bg-emerald-700 text-white border-emerald-700"
            : "bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50"
        }">${escapeHtml(c.name)}</button>`;
      })
      .join("");
  }

  window.onWelcomeCountyInput = function onWelcomeCountyInput(val) {
    ensureWelcomeCountiesLoaded().then(() => renderWelcomeCountyChips(val));
  };

  window.selectWelcomeCounty = function selectWelcomeCounty(countyId) {
    const county = welcomeCounties.find((c) => c.id === countyId);
    if (!county) return;
    welcomeSelectedCounty = county;
    renderWelcomeCountyChips(document.getElementById("welcome-county-filter")?.value || "");

    const countyStep = document.getElementById("welcome-county-step");
    const wrap = document.getElementById("welcome-town-search-wrap");
    const lbl = document.getElementById("welcome-town-county-label");
    const input = document.getElementById("welcome-town-search");
    if (countyStep) countyStep.classList.add("hidden");
    if (wrap) wrap.classList.remove("hidden");
    if (lbl) lbl.textContent = county.name;
    if (input) {
      input.value = "";
      input.focus();
    }
    loadWelcomeTowns(county.id, "");
  };

  window.onWelcomeTownInput = function onWelcomeTownInput(val) {
    if (!welcomeSelectedCounty) return;
    clearTimeout(welcomeTownTimer);
    welcomeTownTimer = setTimeout(() => {
      loadWelcomeTowns(welcomeSelectedCounty.id, val);
    }, 180);
  };

  async function loadWelcomeTowns(countyId, q) {
    const resEl = document.getElementById("welcome-town-results");
    if (!resEl) return;
    resEl.innerHTML = `<div class="p-3 text-xs text-slate-500">Searching towns in ${escapeHtml(welcomeSelectedCounty?.name || "")}…</div>`;
    try {
      const params = new URLSearchParams({ countyId, q: (q || "").trim(), limit: "25" });
      const res = await fetch(`/api/platform/locations/towns?${params.toString()}`);
      const json = await res.json();
      const rows = Array.isArray(json?.locations)
        ? json.locations
        : Array.isArray(json?.data?.locations)
        ? json.data.locations
        : Array.isArray(json?.data)
        ? json.data
        : [];
      if (rows.length === 0) {
        resEl.innerHTML = `<div class="p-3 text-xs text-slate-500">No centre matched "${escapeHtml(q)}". Try fewer letters or tap "Use whole county".</div>`;
        return;
      }
      resEl.innerHTML = rows
        .map((loc) => {
          const payload = escapeHtml(
            JSON.stringify({
              countyId: loc.countyId,
              countyName: loc.countyName || welcomeSelectedCounty?.name || "",
              constituencyName: loc.constituencyName || "",
              locationId: loc.id,
              locationName: loc.name,
            })
          );
          const kindLabel = (loc.kind || loc.locationType || "centre").replace(/_/g, " ");
          return `<button type="button" onclick="chooseWelcomeLocation(JSON.parse(this.dataset.loc))" data-loc="${payload}" class="w-full text-left px-3.5 py-2.5 hover:bg-emerald-50 border-b border-slate-100 last:border-b-0 flex items-center justify-between gap-2 transition-colors">
            <div class="min-w-0">
              <div class="text-xs font-extrabold text-slate-900 truncate">${escapeHtml(loc.name)}</div>
              <div class="text-[11px] text-emerald-700 truncate">${escapeHtml(loc.constituencyName ? `${loc.constituencyName} Constituency · ${loc.countyName || ""}` : loc.countyName || "")}</div>
            </div>
            <span class="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">${escapeHtml(kindLabel)}</span>
          </button>`;
        })
        .join("");
    } catch {
      resEl.innerHTML = `<div class="p-3 text-xs text-rose-600">Could not load towns. Please retry.</div>`;
    }
  }

  window.chooseWelcomeCountyOnly = function chooseWelcomeCountyOnly() {
    if (!welcomeSelectedCounty) return;
    window.chooseWelcomeLocation({
      countyId: welcomeSelectedCounty.id,
      countyName: welcomeSelectedCounty.name,
      locationId: null,
      locationName: `${welcomeSelectedCounty.name} County`,
      constituencyName: "",
    });
  };

  window.chooseWelcomeLocation = function chooseWelcomeLocation(loc) {
    if (typeof window.selectMarketplaceBuyerLocation === "function") {
      window.selectMarketplaceBuyerLocation(loc);
    }
    window.closeBuyerWelcomeModal(true);
    syncMarketplaceHeaderState();
    showToast(`Showing local products near ${loc.locationName} first`, "success");
    const searchSec = document.getElementById("platform-ripple-search-section");
    if (searchSec && window.getComputedStyle(searchSec).display !== "none") {
      searchSec.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (typeof window.filterPlatformStores === "function") {
      window.filterPlatformStores();
    }
  };

  window.useWelcomeGpsLocation = function useWelcomeGpsLocation() {
    const btn = document.getElementById("welcome-auto-detect-btn");
    const statusEl = document.getElementById("welcome-gps-status");
    const setStatus = (text, tone) => {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.className =
        "text-[11px] font-semibold px-3 py-2 rounded-xl border " +
        (tone === "error"
          ? "bg-rose-50 border-rose-200 text-rose-700"
          : "bg-emerald-50 border-emerald-200 text-emerald-800");
    };

    if (btn) {
      btn.disabled = true;
      const span = btn.querySelector("span");
      if (span) span.textContent = "Detecting location…";
    }
    setStatus("Checking your GPS / network location…", "info");

    if (typeof window.useBrowserGpsLocation !== "function") {
      resetWelcomeGpsUi();
      setStatus("Auto-detect is unavailable right now. Please choose your County below.", "error");
      return;
    }

    window.useBrowserGpsLocation((result) => {
      if (result && result.ok && result.location) {
        resetWelcomeGpsUi();
        window.closeBuyerWelcomeModal(true);
        syncMarketplaceHeaderState();
        const detectedName = [result.location.locationName, result.location.countyName]
          .filter(Boolean)
          .join(", ");
        const suffix =
          result.source === "network"
            ? " (detected via network — you can refine anytime)"
            : "";
        showToast(`Location set to ${detectedName}${suffix}`, "success");
      } else {
        resetWelcomeGpsUi();
        setStatus(
          result?.message ||
            "Could not auto-detect your town. Please choose your County below.",
          "error"
        );
      }
    });
  };

  // --- Universal Cart Actions ---
  window.quickAddMarketplaceItem = function quickAddMarketplaceItem(itemPayload) {
    if (!itemPayload || !itemPayload.itemId || !itemPayload.storeId) return;
    const cart = readCart();
    const idx = cart.findIndex(
      (c) =>
        c.itemId === itemPayload.itemId &&
        String(c.variantId || "") === String(itemPayload.variantId || "")
    );
    if (idx >= 0) {
      cart[idx].quantity = Math.min(99, Number(cart[idx].quantity || 1) + Number(itemPayload.quantity || 1));
    } else {
      cart.push({
        itemId: itemPayload.itemId,
        variantId: itemPayload.variantId || null,
        variantTitle: itemPayload.variantTitle || null,
        storeId: itemPayload.storeId,
        storeName: itemPayload.storeName,
        storeSubdomain: itemPayload.storeSubdomain,
        storeLocationLabel: itemPayload.storeLocationLabel || "",
        title: itemPayload.title,
        unitPrice: Number(itemPayload.unitPrice || 0),
        currency: itemPayload.currency || "KES",
        image: itemPayload.image || "",
        quantity: Number(itemPayload.quantity || 1),
        itemType: itemPayload.itemType || "PHYSICAL",
      });
    }
    writeCart(cart);
    showToast(`Added "${itemPayload.title}" to your Store254 cart`, "success");
  };

  window.openMarketplaceCartDrawer = function openMarketplaceCartDrawer() {
    renderMarketplaceCartDrawer();
    const drawer = document.getElementById("marketplace-cart-drawer");
    if (drawer) {
      drawer.classList.remove("hidden");
      drawer.setAttribute("aria-hidden", "false");
    }
    if (typeof window.renderIcons === "function") window.renderIcons();
  };

  window.closeMarketplaceCartDrawer = function closeMarketplaceCartDrawer() {
    const drawer = document.getElementById("marketplace-cart-drawer");
    if (drawer) {
      drawer.classList.add("hidden");
      drawer.setAttribute("aria-hidden", "true");
    }
  };

  window.updateMarketplaceCartQty = function updateMarketplaceCartQty(itemId, variantId, delta) {
    const cart = readCart();
    const idx = cart.findIndex(
      (c) => c.itemId === itemId && String(c.variantId || "") === String(variantId || "")
    );
    if (idx < 0) return;
    const nextQty = Number(cart[idx].quantity || 1) + delta;
    if (nextQty <= 0) {
      cart.splice(idx, 1);
    } else {
      cart[idx].quantity = Math.min(99, nextQty);
    }
    writeCart(cart);
    renderMarketplaceCartDrawer();
  };

  window.removeMarketplaceCartItem = function removeMarketplaceCartItem(itemId, variantId) {
    const cart = readCart().filter(
      (c) => !(c.itemId === itemId && String(c.variantId || "") === String(variantId || ""))
    );
    writeCart(cart);
    renderMarketplaceCartDrawer();
  };

  function groupCartByStore(cart) {
    const map = new Map();
    for (const item of cart) {
      const existing = map.get(item.storeId) || {
        storeId: item.storeId,
        storeName: item.storeName,
        storeSubdomain: item.storeSubdomain,
        storeLocationLabel: item.storeLocationLabel || "",
        currency: item.currency || "KES",
        subtotal: 0,
        items: [],
      };
      existing.items.push(item);
      existing.subtotal += Number(item.unitPrice || 0) * Number(item.quantity || 1);
      map.set(item.storeId, existing);
    }
    return Array.from(map.values());
  }

  function renderMarketplaceCartDrawer() {
    const bodyEl = document.getElementById("marketplace-cart-body");
    const footerEl = document.getElementById("marketplace-cart-footer");
    if (!bodyEl || !footerEl) return;

    const cart = readCart();
    if (cart.length === 0) {
      bodyEl.innerHTML = `<div class="py-16 text-center px-4">
        <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center mb-3">
          <i data-lucide="shopping-bag" class="w-6 h-6"></i>
        </div>
        <p class="text-sm font-extrabold text-slate-900">Your Store254 cart is empty</p>
        <p class="text-xs text-slate-500 mt-1">Browse nearby products & services below and add from any shop in one unified cart.</p>
      </div>`;
      footerEl.classList.add("hidden");
      return;
    }

    const groups = groupCartByStore(cart);
    const grandTotal = groups.reduce((sum, g) => sum + g.subtotal, 0);

    bodyEl.innerHTML = groups
      .map((group) => {
        const itemsHtml = group.items
          .map(
            (item) => {
              const isSvc = item.itemType === "SERVICE";
              const artUri = item.image || (typeof window !== "undefined" && window.Store254ItemArtwork ? window.Store254ItemArtwork.buildDataUri(item, {}) : "/assets/store254Icon.webp");
              return `
          <div class="flex gap-3 py-3 border-t border-slate-100 first:border-t-0">
            <img src="${escapeHtml(artUri)}" alt="${escapeHtml(item.title)}" class="w-14 h-14 rounded-xl object-cover bg-slate-100 shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <p class="text-xs font-bold text-slate-900 line-clamp-2">${escapeHtml(item.title)}</p>
                <span class="shrink-0 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${isSvc ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"}">${isSvc ? "Service" : "Product"}</span>
              </div>
              ${item.variantTitle ? `<p class="text-[11px] text-slate-500">${escapeHtml(item.variantTitle)}</p>` : ""}
              <p class="text-xs font-extrabold text-emerald-700 mt-1">${formatKes(item.unitPrice, item.currency)}${isSvc ? " / session" : ""}</p>
              <div class="flex items-center justify-between mt-2">
                <div class="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50">
                  <button type="button" onclick="updateMarketplaceCartQty('${escapeHtml(item.itemId)}', '${escapeHtml(item.variantId || "")}', -1)" class="px-2 py-0.5 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-l-lg">-</button>
                  <span class="px-2.5 text-xs font-bold text-slate-900">${item.quantity}</span>
                  <button type="button" onclick="updateMarketplaceCartQty('${escapeHtml(item.itemId)}', '${escapeHtml(item.variantId || "")}', 1)" class="px-2 py-0.5 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-r-lg">+</button>
                </div>
                <button type="button" onclick="removeMarketplaceCartItem('${escapeHtml(item.itemId)}', '${escapeHtml(item.variantId || "")}')" class="text-[11px] font-semibold text-rose-600 hover:underline">Remove</button>
              </div>
            </div>
          </div>`;
            }
          )
          .join("");

        return `
        <div class="rounded-2xl border border-slate-200 bg-white p-3.5 mb-3 shadow-sm">
          <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div class="min-w-0">
              <p class="text-xs font-extrabold text-slate-900 truncate">${escapeHtml(group.storeName)}</p>
              <p class="text-[11px] text-slate-500 truncate">${escapeHtml(group.storeLocationLabel || `${group.storeSubdomain}.store254.co.ke`)}</p>
            </div>
            <button type="button" onclick="startMarketplaceCheckoutForStore('${escapeHtml(group.storeId)}')" class="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-extrabold">
              Pay ${formatKes(group.subtotal, group.currency)}
            </button>
          </div>
          <div class="mt-1">${itemsHtml}</div>
        </div>`;
      })
      .join("");

    const totalEl = document.getElementById("marketplace-cart-grand-total");
    if (totalEl) totalEl.textContent = formatKes(grandTotal, "KES");

    const allBtn = document.getElementById("marketplace-checkout-all-btn");
    if (allBtn) {
      allBtn.textContent =
        groups.length > 1
          ? `Checkout All (${groups.length} Shops · ${formatKes(grandTotal, "KES")})`
          : `Proceed to Checkout (${formatKes(grandTotal, "KES")})`;
    }
    footerEl.classList.remove("hidden");
    if (typeof window.renderIcons === "function") window.renderIcons();
  }

  // --- In-Page Product Quick-View Modal ---
  window.openMarketplaceQuickView = async function openMarketplaceQuickView(itemId, rippleLabel) {
    const modal = document.getElementById("marketplace-item-modal");
    const bodyEl = document.getElementById("marketplace-item-modal-body");
    if (!modal || !bodyEl) return;

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    bodyEl.innerHTML = `<div class="p-10 text-center text-xs font-semibold text-slate-500">Loading product details…</div>`;

    try {
      const res = await fetch(`/api/platform/marketplace/items/${encodeURIComponent(itemId)}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error?.message || "Product could not be loaded.");
      }

      activeQuickViewData = json.data;
      activeQuickViewData.rippleLabel = rippleLabel || "";
      const variants = Array.isArray(json.data.variants) ? json.data.variants : [];
      selectedVariantId = variants.length > 0 ? variants[0].id : null;
      quickViewQty = 1;
      quickViewImageIndex = 0;
      renderQuickViewModal();
    } catch (err) {
      bodyEl.innerHTML = `<div class="p-8 text-center">
        <p class="text-sm font-bold text-slate-900">Unable to load this item right now</p>
        <p class="text-xs text-slate-500 mt-1">${escapeHtml(err?.message || "Please try again.")}</p>
      </div>`;
    }
  };

  window.closeMarketplaceQuickView = function closeMarketplaceQuickView() {
    const modal = document.getElementById("marketplace-item-modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
    activeQuickViewData = null;
    quickViewImageIndex = 0;
  };

  function getQuickViewImages(item, fallbackImg) {
    const raw = Array.isArray(item?.images) ? item.images.filter(Boolean).slice(0, 5) : [];
    return raw.length > 0 ? raw : [fallbackImg];
  }

  window.selectQuickViewImage = function selectQuickViewImage(index, event) {
    if (event && typeof event.stopPropagation === "function") event.stopPropagation();
    const sel = getActiveQuickViewSelection();
    if (!sel || !sel.images.length) return;
    const total = sel.images.length;
    quickViewImageIndex = ((Number(index) || 0) % total + total) % total;
    const mainImg = document.getElementById("qv-main-image");
    if (mainImg) {
      mainImg.src = sel.images[quickViewImageIndex];
      mainImg.alt = `${sel.item.title || "Product"} photo ${quickViewImageIndex + 1}`;
    }
    const countEl = document.getElementById("qv-image-count");
    if (countEl) {
      countEl.textContent = `${quickViewImageIndex + 1} / ${total}`;
    }
    document.querySelectorAll("#qv-image-thumbnails .qv-thumb-btn").forEach((btn, idx) => {
      const active = idx === quickViewImageIndex;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.classList.toggle("border-emerald-600", active);
      btn.classList.toggle("ring-2", active);
      btn.classList.toggle("ring-emerald-200", active);
      btn.classList.toggle("opacity-100", active);
      btn.classList.toggle("border-slate-200", !active);
      btn.classList.toggle("opacity-75", !active);
    });
    if (total > 1) {
      const nextUrl = sel.images[(quickViewImageIndex + 1) % total];
      if (nextUrl) {
        const preload = new Image();
        preload.decoding = "async";
        preload.src = nextUrl;
      }
    }
  };

  window.stepQuickViewImage = function stepQuickViewImage(delta, event) {
    window.selectQuickViewImage(quickViewImageIndex + delta, event);
  };

  window.selectQuickViewVariant = function selectQuickViewVariant(variantId) {
    selectedVariantId = variantId;
    renderQuickViewModal();
  };

  window.changeQuickViewQty = function changeQuickViewQty(delta) {
    quickViewQty = Math.max(1, Math.min(99, quickViewQty + delta));
    const el = document.getElementById("qv-qty-val");
    if (el) el.textContent = String(quickViewQty);
  };

  function getActiveQuickViewSelection() {
    if (!activeQuickViewData) return null;
    const { item, variants, store } = activeQuickViewData;
    const safeVariants = Array.isArray(variants) ? variants : [];
    const variant = safeVariants.find((v) => v.id === selectedVariantId) || null;
    const isService = item.itemType === "SERVICE";
    const isDigital = item.itemType === "DIGITAL";
    const serviceConfig = item.metadata?.serviceConfig || {};
    const serviceAvailable = !isService || serviceConfig.available !== false;
    const unitPrice = variant ? variant.price : item.basePrice;
    const stock = variant ? variant.stockQuantity : item.stockQuantity;
    const inStock = isService ? serviceAvailable : isDigital ? true : !item.trackInventory || Number(stock || 0) > 0;
    const storeLoc = [store.locationLabel, store.countyName].filter(Boolean).join(", ");
    const artCtx = {
      categoryName: item.categoryName,
      businessType: store?.businessType,
      storeName: store?.name,
    };
    const fallbackImg =
      typeof window !== "undefined" && window.Store254ItemArtwork
        ? window.Store254ItemArtwork.buildDataUri(item, artCtx)
        : "/assets/store254Icon.webp";
    const fallbackStageHtml =
      typeof window !== "undefined" && window.Store254ItemArtwork
        ? window.Store254ItemArtwork.renderStageHtml(item, artCtx)
        : "";
    const hasRealPhotos = Array.isArray(item.images) && item.images.filter(Boolean).length > 0;
    const images = hasRealPhotos ? getQuickViewImages(item, fallbackImg) : [];
    if (quickViewImageIndex >= images.length || quickViewImageIndex < 0) {
      quickViewImageIndex = 0;
    }
    const imgUrl = hasRealPhotos ? images[quickViewImageIndex] : fallbackImg;

    return {
      item,
      variant,
      variants: safeVariants,
      store,
      isService,
      isDigital,
      serviceConfig,
      unitPrice,
      stock,
      inStock,
      storeLoc,
      hasRealPhotos,
      images,
      imgUrl,
      fallbackImg,
      fallbackStageHtml,
    };
  }

  window.addQuickViewToCart = function addQuickViewToCart() {
    const sel = getActiveQuickViewSelection();
    if (!sel) return;
    if (!sel.inStock) {
      showToast("This option is currently out of stock.", "error");
      return;
    }
    window.quickAddMarketplaceItem({
      itemId: sel.item.id,
      variantId: sel.variant?.id || null,
      variantTitle: sel.variant?.title || null,
      storeId: sel.store.id,
      storeName: sel.store.name,
      storeSubdomain: sel.store.subdomain,
      storeLocationLabel: sel.storeLoc,
      title: sel.item.title,
      unitPrice: sel.unitPrice,
      currency: sel.store.currency,
      image: sel.imgUrl,
      quantity: quickViewQty,
      itemType: sel.item.itemType,
    });
  };

  window.reportQuickViewCopyright = function reportQuickViewCopyright() {
    const sel = getActiveQuickViewSelection();
    if (!sel || typeof window.openCopyrightReportModal !== "function") return;
    window.openCopyrightReportModal({
      itemId: sel.item.id,
      itemTitle: sel.item.title,
      storeSubdomain: sel.store.subdomain,
      images: sel.hasRealPhotos ? sel.images : [],
      imageUrl: sel.hasRealPhotos ? sel.imgUrl : "",
      pageUrl: `https://${sel.store.subdomain}.store254.co.ke/item/${encodeURIComponent(sel.item.slug || sel.item.id)}`,
      targetType: "ITEM_IMAGE",
    });
  };

  window.buyQuickViewNow = function buyQuickViewNow() {
    const sel = getActiveQuickViewSelection();
    if (!sel) return;
    if (!sel.inStock) {
      showToast("This option is currently out of stock.", "error");
      return;
    }
    const storeGroup = {
      storeId: sel.store.id,
      storeName: sel.store.name,
      storeSubdomain: sel.store.subdomain,
      storeLocationLabel: sel.storeLoc,
      mpesaEnabled: sel.store.mpesaEnabled,
      currency: sel.store.currency || "KES",
      subtotal: Number(sel.unitPrice) * Number(quickViewQty),
      items: [
        {
          itemId: sel.item.id,
          variantId: sel.variant?.id || null,
          variantTitle: sel.variant?.title || null,
          storeId: sel.store.id,
          storeName: sel.store.name,
          storeSubdomain: sel.store.subdomain,
          title: sel.variant ? `${sel.item.title} - ${sel.variant.title}` : sel.item.title,
          unitPrice: sel.unitPrice,
          currency: sel.store.currency || "KES",
          image: sel.imgUrl,
          quantity: quickViewQty,
          itemType: sel.item.itemType,
        },
      ],
    };
    window.closeMarketplaceQuickView();
    openCheckoutQueue([storeGroup], false);
  };

  function renderQuickViewModal() {
    const bodyEl = document.getElementById("marketplace-item-modal-body");
    const sel = getActiveQuickViewSelection();
    if (!bodyEl || !sel) return;
    const { item, variants, store, isService, isDigital, serviceConfig, unitPrice, inStock, stock, storeLoc, hasRealPhotos, images, imgUrl, fallbackImg, fallbackStageHtml } = sel;
    const hasMultipleImages = hasRealPhotos && images.length > 1;
    const modeMap = { IN_PERSON_SHOP: "At Provider Location", ON_SITE_CLIENT: "Mobile / On-Site Visit", VIRTUAL_ONLINE: "Online / Remote Session", FLEXIBLE: "Flexible Venue" };
    const serviceModeLabel = modeMap[String(serviceConfig?.deliveryMode || "").toUpperCase()] || "";
    const statusPillHtml = isService
      ? `<span class="ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full ${inStock ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-800"}">${inStock ? "Bookable Service" : "Bookings Paused"}</span>`
      : isDigital
      ? `<span class="ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700">Digital Delivery</span>`
      : `<span class="ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full ${inStock ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}">${inStock ? (item.trackInventory ? `${stock} in stock` : "Available") : "Out of stock"}</span>`;
    const ratingSummary = activeQuickViewData.ratingSummary || { count: 0, average: 0 };
    const reviewsList = Array.isArray(activeQuickViewData.reviews) ? activeQuickViewData.reviews : [];
    const attrs = item.attributes && typeof item.attributes === "object" ? Object.entries(item.attributes).slice(0, 6) : [];
    const storefrontHref = `https://${store.subdomain}.store254.co.ke/item/${encodeURIComponent(item.slug || item.id)}`;
    const isStoreFollowedNow = typeof window.isStoreFollowed === "function" && window.isStoreFollowed(store.subdomain);
    const followStorePayload = {
      id: store.id || "",
      subdomain: store.subdomain || "",
      name: store.name || store.subdomain || "Store",
      businessType: store.businessType || "GENERAL",
      locationLabel: storeLoc || "",
    };

    const qvMediaHtml = hasRealPhotos
      ? `<img id="qv-main-image" src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.title)}" class="w-full h-full object-cover" onerror="this.src='${escapeHtml(fallbackImg)}'" />`
      : (fallbackStageHtml || `<img id="qv-main-image" src="${escapeHtml(fallbackImg)}" alt="${escapeHtml(item.title)}" class="w-full h-full object-cover" />`);

    bodyEl.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 sm:p-6">
        <div>
          <div id="qv-gallery-stage" class="relative rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 aspect-square select-none">
            ${qvMediaHtml}
            ${
              hasMultipleImages
                ? `<button type="button" onclick="stepQuickViewImage(-1, event)" aria-label="Previous product photo" class="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-emerald-600 text-slate-900 hover:text-white border border-white/80 shadow-md flex items-center justify-center cursor-pointer transition-colors">
                    <svg class="w-5 h-5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <button type="button" onclick="stepQuickViewImage(1, event)" aria-label="Next product photo" class="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-emerald-600 text-slate-900 hover:text-white border border-white/80 shadow-md flex items-center justify-center cursor-pointer transition-colors">
                    <svg class="w-5 h-5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                  <span id="qv-image-count" class="absolute right-3 bottom-3 z-10 px-2.5 py-0.5 rounded-full bg-slate-900/75 text-white text-[11px] font-bold">${quickViewImageIndex + 1} / ${images.length}</span>`
                : ""
            }
            ${
              activeQuickViewData.rippleLabel
                ? `<span class="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-900/80 text-white text-[11px] font-bold backdrop-blur">${escapeHtml(activeQuickViewData.rippleLabel)}</span>`
                : ""
            }
          </div>
          ${
            hasMultipleImages
              ? `<div id="qv-image-thumbnails" class="flex gap-2 mt-2.5 overflow-x-auto pb-1">${images
                  .map(
                    (src, idx) =>
                      `<button type="button" onclick="selectQuickViewImage(${idx}, event)" aria-label="View photo ${idx + 1}" aria-pressed="${idx === quickViewImageIndex ? "true" : "false"}" class="qv-thumb-btn w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer transition-all ${
                        idx === quickViewImageIndex
                          ? "border-emerald-600 ring-2 ring-emerald-200 opacity-100"
                          : "border-slate-200 opacity-75 hover:opacity-100"
                      }"><img src="${escapeHtml(src)}" alt="" class="w-full h-full object-cover pointer-events-none" /></button>`
                  )
                  .join("")}</div>`
              : ""
          }
        </div>
        <div class="flex flex-col justify-between gap-4">
          <div>
            <div class="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                <i data-lucide="store" class="w-3.5 h-3.5 text-emerald-700"></i>
                <span class="text-xs font-extrabold text-emerald-900">${escapeHtml(store.name)}</span>
                ${storeLoc ? `<span class="text-[11px] text-emerald-700">· ${escapeHtml(storeLoc)}</span>` : ""}
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  data-follow-subdomain="${escapeHtml(store.subdomain)}"
                  data-follow-store="${escapeHtml(JSON.stringify(followStorePayload))}"
                  onclick="window.toggleFollowStore?.(JSON.parse(this.dataset.followStore), event)"
                  aria-pressed="${isStoreFollowedNow ? "true" : "false"}"
                  class="qv-follow-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors${isStoreFollowedNow ? " is-following" : ""}">
                  <span>${isStoreFollowedNow ? "Subscribed ★" : "+ Subscribe"}</span>
                </button>
                <a href="${escapeHtml(storefrontHref)}" target="_blank" rel="noopener" class="text-[11px] font-bold text-slate-500 hover:text-emerald-700 inline-flex items-center gap-1">
                  <span>Visit Storefront</span>
                  <i data-lucide="external-link" class="w-3 h-3"></i>
                </a>
              </div>
            </div>
            <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">${escapeHtml(item.categoryName || (isService ? "Service" : item.itemType))}</p>
            <h3 class="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">${escapeHtml(item.title)}</h3>
            <div class="flex items-baseline gap-2.5 mt-2 flex-wrap">
              <span class="text-2xl font-black text-emerald-700">${formatKes(unitPrice, store.currency)}</span>
              ${
                item.compareAtPrice && item.compareAtPrice > unitPrice
                  ? `<del class="text-sm text-slate-400">${formatKes(item.compareAtPrice, store.currency)}</del>`
                  : ""
              }
              ${statusPillHtml}
            </div>
            ${
              isService && (serviceConfig?.duration || serviceModeLabel)
                ? `<div class="mt-2 flex flex-wrap gap-1.5">
                    ${serviceConfig.duration ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">${escapeHtml(serviceConfig.duration)}</span>` : ""}
                    ${serviceModeLabel ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700">${escapeHtml(serviceModeLabel)}</span>` : ""}
                  </div>`
                : ""
            }
            ${
              ratingSummary.count > 0
                ? `<div class="mt-2 text-xs text-amber-600 font-bold">★ ${ratingSummary.average} (${ratingSummary.count} verified review${ratingSummary.count === 1 ? "" : "s"})</div>`
                : ""
            }
            ${
              item.description
                ? `<p class="text-xs sm:text-sm text-slate-600 leading-relaxed mt-3">${escapeHtml(item.description)}</p>`
                : ""
            }
            ${
              Array.isArray(variants) && variants.length > 0
                ? `<div class="mt-4">
                    <p class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">${isService ? "Choose Service Package" : "Choose Option"}</p>
                    <div class="flex flex-wrap gap-2">${variants
                      .map((v) => {
                        const isSelected = v.id === selectedVariantId;
                        return `<button type="button" onclick="selectQuickViewVariant('${escapeHtml(v.id)}')" class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                          isSelected
                            ? "bg-emerald-700 text-white border-emerald-700"
                            : "bg-white text-slate-700 border-slate-200 hover:border-emerald-400"
                        }">${escapeHtml(v.title)} · ${formatKes(v.price, store.currency)}</button>`;
                      })
                      .join("")}</div>
                  </div>`
                : ""
            }
            ${
              attrs.length > 0
                ? `<div class="mt-4 grid grid-cols-2 gap-1.5 bg-slate-50 rounded-xl p-2.5 border border-slate-100">${attrs
                    .map(
                      ([k, v]) =>
                        `<div class="text-[11px]"><span class="text-slate-400 capitalize">${escapeHtml(k.replace(/_/g, " "))}:</span> <strong class="text-slate-700">${escapeHtml(String(v))}</strong></div>`
                    )
                    .join("")}</div>`
                : ""
            }
          </div>

          <div class="pt-3 border-t border-slate-100 space-y-2.5">
            <div class="flex items-center gap-3">
              <div class="inline-flex items-center border border-slate-200 rounded-xl bg-slate-50">
                <button type="button" onclick="changeQuickViewQty(-1)" class="px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 rounded-l-xl">-</button>
                <span id="qv-qty-val" class="px-3.5 text-sm font-extrabold text-slate-900">${quickViewQty}</span>
                <button type="button" onclick="changeQuickViewQty(1)" class="px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 rounded-r-xl">+</button>
              </div>
              <button type="button" onclick="addQuickViewToCart()" ${!inStock ? "disabled" : ""} class="flex-1 py-2.5 px-4 rounded-xl ${isService ? "border-indigo-700 text-indigo-800 bg-indigo-50 hover:bg-indigo-100" : "border-emerald-700 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"} border font-extrabold text-xs sm:text-sm disabled:opacity-50">
                ${isService ? "Add to Booking" : "Add to Cart"}
              </button>
            </div>
            <button type="button" onclick="buyQuickViewNow()" ${!inStock ? "disabled" : ""} class="w-full py-3 px-4 rounded-xl ${isService ? "bg-indigo-700 hover:bg-indigo-800 shadow-indigo-700/20" : "bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/20"} text-white font-extrabold text-sm shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
              <i data-lucide="${isService ? "calendar" : "smartphone"}" class="w-4 h-4"></i>
              <span>${isService ? `Book Service Now (${store.mpesaEnabled ? "M-Pesa / Pay at Visit" : "Pay at Appointment"})` : `Buy Now Directly on Store254 (${store.mpesaEnabled ? "M-Pesa / COD" : "Cash on Delivery"})`}</span>
            </button>
            <div class="flex justify-end">
              <button type="button" onclick="reportQuickViewCopyright()" class="text-[11px] font-semibold text-slate-400 hover:text-rose-600 inline-flex items-center gap-1 transition-colors">
                <i data-lucide="flag" class="w-3 h-3"></i>
                <span>Report copyrighted image</span>
              </button>
            </div>
          </div>
          ${
            reviewsList.length > 0
              ? `<div class="pt-3 border-t border-slate-100 space-y-2 max-h-36 overflow-y-auto">
                  <p class="text-[11px] font-extrabold uppercase text-slate-500">Recent Reviews</p>
                  ${reviewsList
                    .slice(0, 3)
                    .map(
                      (r) =>
                        `<div class="text-xs bg-slate-50 rounded-xl p-2 border border-slate-100"><strong class="text-slate-800">${escapeHtml(r.customerName)}</strong> <span class="text-amber-600">★${r.rating}</span>${r.comment ? `<p class="text-slate-600 mt-0.5">${escapeHtml(r.comment)}</p>` : ""}</div>`
                    )
                    .join("")}
                </div>`
              : ""
          }
        </div>
      </div>`;

    if (hasMultipleImages) {
      const stageEl = document.getElementById("qv-gallery-stage");
      if (stageEl) {
        let touchStartX = null;
        stageEl.addEventListener(
          "touchstart",
          (e) => {
            touchStartX = e.touches?.[0]?.clientX ?? null;
          },
          { passive: true }
        );
        stageEl.addEventListener(
          "touchend",
          (e) => {
            if (touchStartX === null) return;
            const touchEndX = e.changedTouches?.[0]?.clientX ?? touchStartX;
            const dx = touchEndX - touchStartX;
            touchStartX = null;
            if (Math.abs(dx) >= 40) {
              window.stepQuickViewImage(dx < 0 ? 1 : -1);
            }
          },
          { passive: true }
        );
      }
    }

    if (typeof window.renderIcons === "function") window.renderIcons();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const modal = document.getElementById("marketplace-item-modal");
      if (!modal || modal.classList.contains("hidden")) return;
      const sel = getActiveQuickViewSelection();
      if (!sel || !Array.isArray(sel.images) || sel.images.length <= 1) return;
      window.stepQuickViewImage(e.key === "ArrowRight" ? 1 : -1);
    });
  }

  // --- Unified Direct Platform Checkout (M-Pesa STK Push & COD, No Subdomain Hop) ---
  window.startMarketplaceCheckoutForStore = function startMarketplaceCheckoutForStore(storeId) {
    const groups = groupCartByStore(readCart());
    const target = groups.find((g) => g.storeId === storeId);
    if (!target) return;
    window.closeMarketplaceCartDrawer();
    openCheckoutQueue([target], true);
  };

  window.startMarketplaceCheckoutAll = function startMarketplaceCheckoutAll() {
    const groups = groupCartByStore(readCart());
    if (groups.length === 0) return;
    window.closeMarketplaceCartDrawer();
    openCheckoutQueue(groups, true);
  };

  function openCheckoutQueue(groups, removeFromCartOnSubmit) {
    activeCheckoutQueue = groups.map((g) => ({ ...g, removeFromCartOnSubmit }));
    activeCheckoutIndex = 0;
    clearInterval(activePollTimer);

    const modal = document.getElementById("marketplace-checkout-modal");
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    renderCurrentCheckoutStep();
  }

  window.closeMarketplaceCheckoutModal = function closeMarketplaceCheckoutModal() {
    clearInterval(activePollTimer);
    const modal = document.getElementById("marketplace-checkout-modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  };

  function renderCurrentCheckoutStep() {
    const bodyEl = document.getElementById("marketplace-checkout-body");
    const group = activeCheckoutQueue[activeCheckoutIndex];
    if (!bodyEl || !group) return;

    const hasService = group.items.some((i) => i.itemType === "SERVICE");
    const hasPhysical = group.items.some((i) => i.itemType === "PHYSICAL" || !i.itemType);
    const isServiceOnly = hasService && !hasPhysical;

    const loc = typeof window.getStore254BuyerLocation === "function" ? window.getStore254BuyerLocation() : null;
    const savedPhone = localStorage.getItem(PHONE_STORAGE_KEY) || "";
    const defaultName = platformUser?.fullName || "";
    const defaultEmail = platformUser?.email || "";
    const defaultAddr = loc?.locationName
      ? `${loc.locationName}${loc.countyName ? `, ${loc.countyName}` : ""}`
      : "";
    const todayIso = new Date().toISOString().split("T")[0];

    const queuePill =
      activeCheckoutQueue.length > 1
        ? `<span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">Shop ${activeCheckoutIndex + 1} of ${activeCheckoutQueue.length}</span>`
        : "";

    bodyEl.innerHTML = `
      <div class="p-5 sm:p-6 space-y-4">
        <div class="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            ${queuePill}
            <h3 class="text-lg font-extrabold text-slate-900 mt-1">${isServiceOnly ? `Book Service with ${escapeHtml(group.storeName)}` : `Checkout with ${escapeHtml(group.storeName)}`}</h3>
            <p class="text-xs text-slate-500">${isServiceOnly ? `Booking goes straight to ${escapeHtml(group.storeName)}.` : `Order goes straight to ${escapeHtml(group.storeName)} without leaving Store254.`}</p>
          </div>
          <div class="text-right">
            <span class="text-[11px] text-slate-400 font-semibold">Total</span>
            <p class="text-lg font-black text-emerald-700">${formatKes(group.subtotal, group.currency)}</p>
          </div>
        </div>

        <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1.5 max-h-32 overflow-y-auto">
          ${group.items
            .map(
              (i) =>
                `<div class="flex items-center justify-between text-xs"><span class="text-slate-700 font-semibold truncate">${i.quantity}x ${escapeHtml(i.title)}</span><strong class="text-slate-900 shrink-0">${formatKes(Number(i.unitPrice) * Number(i.quantity), group.currency)}</strong></div>`
            )
            .join("")}
        </div>

        <form id="mp-checkout-form" onsubmit="event.preventDefault(); submitMarketplaceCheckout();" class="space-y-3">
          ${
            hasService
              ? `<div class="rounded-xl bg-indigo-50/70 border border-indigo-100 p-3 space-y-2.5">
                  <p class="text-[11px] font-extrabold uppercase tracking-wider text-indigo-900">Service Appointment Schedule</p>
                  <div class="grid grid-cols-2 gap-2.5">
                    <div>
                      <label class="block text-[11px] font-bold text-slate-600 mb-1">Preferred Date</label>
                      <input id="mp-co-booking-date" type="date" value="${todayIso}" class="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white" />
                    </div>
                    <div>
                      <label class="block text-[11px] font-bold text-slate-600 mb-1">Time Slot</label>
                      <select id="mp-co-booking-time" class="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
                        <option value="Morning (9am - 12pm)">Morning (9am - 12pm)</option>
                        <option value="Afternoon (2pm - 5pm)">Afternoon (2pm - 5pm)</option>
                        <option value="Evening (5pm - 8pm)">Evening (5pm - 8pm)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-slate-600 mb-1">Service Location Mode</label>
                    <select id="mp-co-booking-mode" onchange="var g=document.getElementById('mp-co-address-group'); if(g && ${isServiceOnly ? "true" : "false"}){ g.classList.toggle('hidden', this.value !== 'ON_SITE_CLIENT'); }" class="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
                      <option value="IN_PERSON_SHOP">At Provider Location / Studio</option>
                      <option value="ON_SITE_CLIENT">Come to My Location (On-Site)</option>
                      <option value="VIRTUAL_ONLINE">Online / Remote Session</option>
                    </select>
                  </div>
                </div>`
              : ""
          }
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] font-bold text-slate-600 mb-1">Full Name</label>
              <input id="mp-co-name" type="text" required value="${escapeHtml(defaultName)}" placeholder="Jane Wanjiku" class="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 outline-none" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-600 mb-1">M-Pesa / Contact Phone</label>
              <input id="mp-co-phone" type="tel" required value="${escapeHtml(savedPhone)}" placeholder="0712 345 678" class="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 outline-none" />
            </div>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">Receipt Email</label>
            <input id="mp-co-email" type="email" required value="${escapeHtml(defaultEmail)}" placeholder="you@example.com" class="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 outline-none" />
          </div>
          <div id="mp-co-address-group" class="${isServiceOnly ? "hidden" : ""}">
            <label class="block text-[11px] font-bold text-slate-600 mb-1">${isServiceOnly ? "Service Visit Location / Estate / Landmark" : "Delivery Area / Estate / Landmark"}</label>
            <input id="mp-co-address" type="text" value="${escapeHtml(defaultAddr)}" placeholder="e.g. Kenol Stage, opposite TotalEnergies" class="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 outline-none" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">Payment Method</label>
            <div class="grid grid-cols-2 gap-2">
              <label class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:border-emerald-500 bg-white">
                <input type="radio" name="mp_pay_method" value="MPESA" ${group.mpesaEnabled !== false ? "checked" : ""} />
                <span class="text-xs font-extrabold text-slate-800">M-Pesa STK Push</span>
              </label>
              <label class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:border-emerald-500 bg-white">
                <input type="radio" name="mp_pay_method" value="CASH_ON_DELIVERY" ${group.mpesaEnabled === false ? "checked" : ""} />
                <span class="text-xs font-extrabold text-slate-800">${isServiceOnly ? "Pay at Appointment" : "Cash on Delivery"}</span>
              </label>
            </div>
          </div>
          <p id="mp-co-error" class="hidden text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"></p>
          <button id="mp-co-submit-btn" type="submit" class="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-lg shadow-emerald-700/20">
            ${isServiceOnly ? `Confirm Booking · ${formatKes(group.subtotal, group.currency)}` : `Confirm & Pay ${formatKes(group.subtotal, group.currency)}`}
          </button>
        </form>
      </div>`;
  }

  window.submitMarketplaceCheckout = async function submitMarketplaceCheckout() {
    const group = activeCheckoutQueue[activeCheckoutIndex];
    if (!group) return;

    const btn = document.getElementById("mp-co-submit-btn");
    const errEl = document.getElementById("mp-co-error");
    const name = document.getElementById("mp-co-name")?.value?.trim() || "";
    const phone = document.getElementById("mp-co-phone")?.value?.trim() || "";
    const email = document.getElementById("mp-co-email")?.value?.trim() || "";
    const address = document.getElementById("mp-co-address")?.value?.trim() || "";
    const payMethod =
      document.querySelector('input[name="mp_pay_method"]:checked')?.value || "MPESA";
    const loc = typeof window.getStore254BuyerLocation === "function" ? window.getStore254BuyerLocation() : null;

    const hasService = group.items.some((i) => i.itemType === "SERVICE");
    const hasPhysical = group.items.some((i) => i.itemType === "PHYSICAL" || !i.itemType);
    const isServiceOnly = hasService && !hasPhysical;
    const bookingMode = document.getElementById("mp-co-booking-mode")?.value || "IN_PERSON_SHOP";

    if (hasPhysical && payMethod === "CASH_ON_DELIVERY" && address.length < 5) {
      if (errEl) {
        errEl.textContent = "Please enter a clear delivery address for Cash on Delivery.";
        errEl.classList.remove("hidden");
      }
      return;
    }

    if (isServiceOnly && bookingMode === "ON_SITE_CLIENT" && address.length < 5) {
      if (errEl) {
        errEl.textContent = "Please enter the location where your on-site service should happen.";
        errEl.classList.remove("hidden");
      }
      return;
    }

    const bookingDetails = hasService
      ? {
          bookingDate: document.getElementById("mp-co-booking-date")?.value || new Date().toISOString().split("T")[0],
          timeSlot: document.getElementById("mp-co-booking-time")?.value || "Morning (9am - 12pm)",
          serviceMode: bookingMode,
          serviceLocation: bookingMode === "ON_SITE_CLIENT" ? address : undefined,
        }
      : undefined;

    try {
      localStorage.setItem(PHONE_STORAGE_KEY, phone);
    } catch {}

    if (btn) {
      btn.disabled = true;
      btn.textContent = isServiceOnly ? "Confirming booking…" : "Placing order…";
    }
    if (errEl) errEl.classList.add("hidden");

    try {
      const res = await fetch("/api/platform/marketplace/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: group.storeId,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          paymentMethod: payMethod,
          deliveryAddress: !isServiceOnly && address ? address : undefined,
          shippingAddress: isServiceOnly
            ? {}
            : {
                county: loc?.countyName || "",
                subCounty: loc?.constituencyName || "",
                town: loc?.locationName || "",
                address,
              },
          bookingDetails,
          items: group.items.map((i) => ({
            itemId: i.itemId,
            variantId: i.variantId || undefined,
            quantity: Number(i.quantity || 1),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Could not place order.");
      }

      if (group.removeFromCartOnSubmit) {
        const remaining = readCart().filter((c) => c.storeId !== group.storeId);
        writeCart(remaining);
      }

      renderCheckoutConfirmation(group, json.data, payMethod);
    } catch (err) {
      if (errEl) {
        errEl.textContent = err?.message || "Checkout failed. Please check details and try again.";
        errEl.classList.remove("hidden");
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = `Confirm & Pay ${formatKes(group.subtotal, group.currency)}`;
      }
    }
  };

  function renderCheckoutConfirmation(group, data, payMethod) {
    const bodyEl = document.getElementById("marketplace-checkout-body");
    if (!bodyEl) return;
    const hasMoreShops = activeCheckoutIndex + 1 < activeCheckoutQueue.length;

    bodyEl.innerHTML = `
      <div class="p-6 text-center space-y-4">
        <div id="mp-status-icon" class="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${
          payMethod === "CASH_ON_DELIVERY"
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-700"
        }">
          <i data-lucide="${payMethod === "CASH_ON_DELIVERY" ? "check-circle-2" : "smartphone"}" class="w-7 h-7"></i>
        </div>
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Order #${escapeHtml(data.orderNumber)} · ${escapeHtml(group.storeName)}</p>
          <h3 id="mp-status-title" class="text-xl font-extrabold text-slate-900 mt-1">${
            payMethod === "CASH_ON_DELIVERY" ? "Order Confirmed!" : "Enter M-Pesa PIN on your phone"
          }</h3>
          <p id="mp-status-desc" class="text-xs sm:text-sm text-slate-600 mt-1">${escapeHtml(data.customerMessage || "")}</p>
        </div>
        <div id="mp-receipt-box" class="hidden rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-900"></div>
        <div class="flex flex-col sm:flex-row gap-2 pt-2">
          ${
            hasMoreShops
              ? `<button type="button" onclick="advanceMarketplaceCheckoutQueue()" class="flex-1 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs">Next Shop Checkout (${activeCheckoutIndex + 2}/${activeCheckoutQueue.length}) →</button>`
              : `<button type="button" onclick="closeMarketplaceCheckoutModal()" class="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs">Keep Shopping on Store254</button>`
          }
          <button type="button" onclick="closeMarketplaceCheckoutModal(); openMarketplaceOrdersModal();" class="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs">
            View My Orders
          </button>
        </div>
      </div>`;

    if (typeof window.renderIcons === "function") window.renderIcons();

    if (payMethod === "MPESA" && data.orderId && data.paymentStatusToken) {
      let attempts = 0;
      clearInterval(activePollTimer);
      activePollTimer = setInterval(async () => {
        attempts += 1;
        if (attempts > 30) {
          clearInterval(activePollTimer);
          return;
        }
        try {
          const stRes = await fetch(
            `/api/platform/marketplace/orders/${encodeURIComponent(data.orderId)}/status?token=${encodeURIComponent(data.paymentStatusToken)}`,
            { credentials: "include" }
          );
          const stJson = await stRes.json();
          const st = stJson?.data;
          if (!st) return;

          if (st.paymentStatus === "PAID" || st.mpesaStatus === "COMPLETED") {
            clearInterval(activePollTimer);
            const titleEl = document.getElementById("mp-status-title");
            const descEl = document.getElementById("mp-status-desc");
            const receiptEl = document.getElementById("mp-receipt-box");
            const iconEl = document.getElementById("mp-status-icon");
            if (iconEl) iconEl.className = "w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-emerald-100 text-emerald-700";
            if (titleEl) titleEl.textContent = "M-Pesa Payment Received!";
            if (descEl) descEl.textContent = `${group.storeName} has received your payment and will process your order.`;
            if (receiptEl) {
              receiptEl.textContent = st.mpesaReceiptNumber
                ? `M-Pesa Receipt: ${st.mpesaReceiptNumber}`
                : "Payment confirmed.";
              receiptEl.classList.remove("hidden");
            }
          } else if (st.mpesaStatus === "FAILED") {
            clearInterval(activePollTimer);
            const titleEl = document.getElementById("mp-status-title");
            const descEl = document.getElementById("mp-status-desc");
            if (titleEl) titleEl.textContent = "M-Pesa Prompt Cancelled or Timed Out";
            if (descEl) descEl.textContent = "No money was deducted. You can retry checkout anytime.";
          }
        } catch {}
      }, 3000);
    }
  }

  window.advanceMarketplaceCheckoutQueue = function advanceMarketplaceCheckoutQueue() {
    clearInterval(activePollTimer);
    activeCheckoutIndex += 1;
    renderCurrentCheckoutStep();
  };

  // --- Unified Platform Orders Modal ---
  window.openMarketplaceOrdersModal = async function openMarketplaceOrdersModal() {
    const modal = document.getElementById("marketplace-orders-modal");
    const bodyEl = document.getElementById("marketplace-orders-body");
    if (!modal || !bodyEl) return;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");

    if (!platformUser) {
      bodyEl.innerHTML = `<div class="p-8 text-center space-y-4">
        <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center">
          <i data-lucide="user-round-check" class="w-6 h-6"></i>
        </div>
        <div>
          <h3 class="text-base font-extrabold text-slate-900">Sign in once to see all your orders</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Google Sign-In keeps all your Store254 orders &amp; M-Pesa receipts across different shops synced in one screen.</p>
        </div>
        <button type="button" onclick="closeMarketplaceOrdersModal(); startPlatformGoogleSignIn();" class="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold">
          Continue with Google
        </button>
      </div>`;
      if (typeof window.renderIcons === "function") window.renderIcons();
      return;
    }

    if (platformUser && !Array.isArray(platformUser.stores)) {
      await refreshPlatformSession();
    }

    bodyEl.innerHTML = `<div class="p-8 text-center text-xs font-semibold text-slate-500">Loading your Store254 orders…</div>`;
    try {
      const res = await fetch("/api/platform/marketplace/my-orders", { credentials: "include", cache: "no-store" });
      const json = await res.json();
      const ordersList = Array.isArray(json.data) ? json.data : [];

      const savedLoc = typeof window.getStore254BuyerLocation === "function" ? window.getStore254BuyerLocation() : null;
      const locLabel = savedLoc?.locationName
        ? [savedLoc.locationName, savedLoc.countyName].filter(Boolean).join(", ")
        : "";
      const locationRow = `<div class="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 min-w-0 text-xs">
          <i data-lucide="map-pin" class="w-3.5 h-3.5 text-emerald-700 shrink-0"></i>
          <span class="font-semibold text-slate-600 shrink-0">Location:</span>
          <span class="font-bold text-slate-900 truncate">${escapeHtml(locLabel || "Not selected")}</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" onclick="closeMarketplaceOrdersModal(); openBuyerWelcomeModal(2);" class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[11px] font-bold text-emerald-800">${locLabel ? "Change" : "Set town"}</button>
          ${
            locLabel
              ? `<button type="button" onclick="clearMarketplaceBuyerLocation(); openMarketplaceOrdersModal();" class="px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-50">Clear</button>`
              : ""
          }
        </div>
      </div>`;

      const accountBar = `<div class="pb-3 mb-3 border-b border-slate-100">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <p class="text-xs font-extrabold text-slate-900 truncate">${escapeHtml(platformUser.fullName || platformUser.email)}</p>
            <p class="text-[11px] text-slate-500 truncate">${escapeHtml(platformUser.email)}</p>
          </div>
          <button type="button" onclick="signOutPlatformBuyer()" class="shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">Sign out</button>
        </div>
        ${locationRow}
      </div>`;

      const activeStoreHtml =
        typeof window.buildActiveStoreProfileHtml === "function"
          ? window.buildActiveStoreProfileHtml(platformUser.activeStore, platformUser.stores)
          : "";
      const activeStoreBlock = activeStoreHtml ? `<div class="mb-4">${activeStoreHtml}</div>` : "";

      const followedStores = typeof window.getFollowedStores === "function" ? window.getFollowedStores() : [];
      const followedStoresBlock =
        followedStores.length > 0
          ? `<div class="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
              <div class="flex items-center justify-between gap-2 mb-2">
                <span class="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">★ Subscribed Stores (${followedStores.length})</span>
                <span class="text-[11px] text-emerald-700 font-semibold">Pinned at top</span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                ${followedStores
                  .slice(0, 8)
                  .map((fs) => {
                    const fsUrls =
                      typeof window.buildStore254StoreUrls === "function"
                        ? window.buildStore254StoreUrls(fs.subdomain)
                        : { storefrontUrl: `https://${fs.subdomain}.store254.co.ke/` };
                    return `<a href="${escapeHtml(fsUrls.storefrontUrl)}" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-emerald-200 hover:border-emerald-500 text-xs font-bold text-slate-800 shadow-xs">${escapeHtml(fs.name)}</a>`;
                  })
                  .join("")}
              </div>
            </div>`
          : "";

      if (ordersList.length === 0) {
        bodyEl.innerHTML = `<div class="p-5">${accountBar}${activeStoreBlock}${followedStoresBlock}<div class="py-8 text-center text-xs text-slate-500">You haven't placed any orders yet. Explore local stores below!</div></div>`;
        if (typeof window.renderIcons === "function") window.renderIcons();
        return;
      }

      bodyEl.innerHTML = `<div class="p-5">${accountBar}${activeStoreBlock}${followedStoresBlock}<div class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">${ordersList
        .map(
          (o) => {
            const storeUrls = typeof window.buildStore254StoreUrls === "function"
              ? window.buildStore254StoreUrls(o.storeSubdomain)
              : { storefrontUrl: `https://${o.storeSubdomain}.store254.co.ke` };
            return `
          <div class="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <p class="text-xs font-extrabold text-slate-900 truncate">${escapeHtml(o.storeName)} · #${escapeHtml(o.orderNumber)}</p>
                <p class="text-[11px] text-slate-500">${new Date(o.createdAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}${o.mpesaReceiptNumber ? ` · Receipt ${escapeHtml(o.mpesaReceiptNumber)}` : ""}</p>
              </div>
              <span class="shrink-0 text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                o.paymentStatus === "PAID"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }">${escapeHtml(o.status)}</span>
            </div>
            <div class="text-xs text-slate-600 space-y-0.5">
              ${(o.items || []).map((i) => `<div>${i.quantity}x ${escapeHtml(i.title)}</div>`).join("")}
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <strong class="text-emerald-700">${formatKes(o.totalAmount, o.currency)}</strong>
              <a href="${escapeHtml(storeUrls.storefrontUrl)}" target="_blank" rel="noopener" class="text-[11px] font-bold text-slate-500 hover:text-emerald-700">Visit Shop ↗</a>
            </div>
          </div>`;
          }
        )
        .join("")}</div></div>`;
      if (typeof window.renderIcons === "function") window.renderIcons();
    } catch {
      bodyEl.innerHTML = `<div class="p-8 text-center text-xs text-rose-600">Could not load your orders right now.</div>`;
    }
  };

  window.closeMarketplaceOrdersModal = function closeMarketplaceOrdersModal() {
    const modal = document.getElementById("marketplace-orders-modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  };

  window.addEventListener("pageshow", (event) => {
    if (event.persisted && isPlatformRootMode()) {
      void refreshPlatformSession();
    }
  });

  // --- Bootstrap Platform Buyer Experience ---
  window.addEventListener("DOMContentLoaded", async () => {
    if (!isPlatformRootMode()) return;

    // Storefront account drawer stays closed on root platform so returning shoppers never hit a blank white drawer
    const ordersDrawer = document.getElementById("orders-drawer");
    if (ordersDrawer) {
      ordersDrawer.classList.add("hidden");
      ordersDrawer.setAttribute("aria-hidden", "true");
    }

    const params = new URLSearchParams(window.location.search);
    const loginResult = params.get("_customer_login");
    if (loginResult) {
      params.delete("_customer_login");
      const cleanQuery = params.toString();
      const nextUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    }

    syncMarketplaceHeaderState();
    await refreshPlatformSession();

    const savedLoc = typeof window.getStore254BuyerLocation === "function" ? window.getStore254BuyerLocation() : null;
    const isStoresPage = document.documentElement.dataset.platformView === "stores";

    if (loginResult === "success") {
      let reopenOnboard = false;
      try {
        reopenOnboard = sessionStorage.getItem("store254_reopen_onboard") === "1";
        sessionStorage.removeItem("store254_reopen_onboard");
      } catch {}

      window.closeBuyerWelcomeModal(false);
      showToast(
        platformUser?.fullName
          ? `Signed in as ${platformUser.fullName}`
          : "Signed in to Store254!",
        "success"
      );
      if (reopenOnboard && platformUser && typeof window.toggleDrawer === "function") {
        window.toggleDrawer("onboard-modal", true);
      } else if (!savedLoc && !isStoresPage) {
        window.openBuyerWelcomeModal(2);
      }
    } else if (loginResult === "error") {
      try {
        sessionStorage.removeItem("store254_reopen_onboard");
      } catch {}
      window.closeBuyerWelcomeModal(false);
      showToast("Google sign-in was cancelled or failed. Please try again.", "error");
    }
  });
})();
