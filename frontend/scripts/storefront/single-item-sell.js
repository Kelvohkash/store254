// Store254 Quick Sell — Post 1 Item Without Creating a Store
(() => {
  "use strict";

  const PHONE_STORAGE_KEY = "store254_buyer_phone_v1";
  const REOPEN_SINGLE_ITEM_FLAG = "store254_reopen_single_item";
  const MAX_PHOTOS = 5;

  const singleState = {
    initialized: false,
    isOpen: false,
    activeTab: "post",
    counties: [],
    countiesLoaded: false,
    townResults: [],
    selectedLocation: null, // { countyId, countyName, locationId, locationName, constituencyName }
    uploadedImages: [], // array of "/api/media/tenant-community-market/..."
    uploadingCount: 0,
    isSubmitting: false,
    townTimer: null,
    myItems: [],
  };

  function esc(val) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(val);
    return String(val ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);
  }

  function toast(msg, type = "info") {
    if (typeof window.showToast === "function") {
      window.showToast(msg, type);
      return;
    }
    if (type === "error") console.error("[QuickSell]", msg);
    else console.log("[QuickSell]", msg);
  }

  function refreshIcons(target) {
    if (typeof window.renderIcons === "function") {
      window.renderIcons(target);
    } else if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  function extractErrorMsg(res, fallback) {
    const err = res?.data?.error;
    if (Array.isArray(err?.issues) && err.issues.length > 0 && err.issues[0]?.message) {
      return err.issues[0].message;
    }
    if (typeof err?.message === "string" && err.message.trim()) return err.message.trim();
    if (typeof res?.data?.message === "string" && res.data.message.trim()) return res.data.message.trim();
    return fallback;
  }

  async function resolvePlatformUser(forceRefresh = false) {
    const cached =
      (typeof window.getStore254PlatformUser === "function" ? window.getStore254PlatformUser() : null) ||
      window.platformUser ||
      null;
    if (cached && cached.email && !forceRefresh) return cached;

    if (typeof window.refreshStore254PlatformSession === "function") {
      try {
        await window.refreshStore254PlatformSession();
      } catch {}
      const refreshed =
        (typeof window.getStore254PlatformUser === "function" ? window.getStore254PlatformUser() : null) ||
        window.platformUser ||
        null;
      if (refreshed && refreshed.email) return refreshed;
    }

    try {
      const base = typeof API_BASE_URL === "string" ? API_BASE_URL : "";
      const res = await fetch(`${base}/api/platform/me`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (json?.data?.authenticated && json?.data?.user?.email) {
        return json.data.user;
      }
    } catch {}
    return null;
  }

  function setSingleItemFeedback(message, type = "error") {
    const el = document.getElementById("single-item-feedback");
    if (!el) return;
    if (!message) {
      el.textContent = "";
      el.className = "hidden rounded-xl border px-3.5 py-2.5 text-xs font-semibold";
      return;
    }
    const palette =
      type === "success"
        ? "bg-emerald-50 border-emerald-300 text-emerald-900"
        : type === "info"
          ? "bg-slate-50 border-slate-300 text-slate-800"
          : "bg-rose-50 border-rose-300 text-rose-800";
    el.textContent = message;
    el.className = `rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${palette}`;
  }

  // --- Auth Gate ---
  window.startSingleItemGoogleSignIn = function startSingleItemGoogleSignIn() {
    try {
      sessionStorage.setItem(REOPEN_SINGLE_ITEM_FLAG, "1");
    } catch {}
    if (typeof window.startPlatformGoogleSignIn === "function") {
      window.startPlatformGoogleSignIn();
      return;
    }
    window.location.href = `/auth/google/login?return_to=${encodeURIComponent(window.location.href)}`;
  };

  async function syncSingleItemAuthState(forceRefresh = false) {
    const gate = document.getElementById("single-item-auth-gate");
    const form = document.getElementById("single-item-form");
    const user = await resolvePlatformUser(forceRefresh);

    if (user) {
      if (gate) gate.classList.add("hidden");
      if (form) form.classList.remove("hidden");
      const nameInput = document.getElementById("single-item-seller-name");
      if (nameInput && !nameInput.value.trim() && user.fullName) {
        nameInput.value = user.fullName;
      }
      const phoneInput = document.getElementById("single-item-seller-phone");
      if (phoneInput && !phoneInput.value.trim()) {
        try {
          const savedPhone = localStorage.getItem(PHONE_STORAGE_KEY);
          if (savedPhone) phoneInput.value = savedPhone;
        } catch {}
      }
    } else {
      if (gate) gate.classList.remove("hidden");
      if (form) form.classList.add("hidden");
    }

    return user;
  }

  // --- Counties & Towns ---
  async function ensureCountiesLoaded() {
    if (singleState.countiesLoaded && singleState.counties.length > 0) {
      return singleState.counties;
    }
    if (Array.isArray(window.__store254CountiesCache) && window.__store254CountiesCache.length > 0) {
      singleState.counties = window.__store254CountiesCache;
      singleState.countiesLoaded = true;
      populateCountySelect();
      return singleState.counties;
    }
    const res = await apiFetch("/api/platform/locations/counties");
    if (res.ok && Array.isArray(res.data?.counties)) {
      singleState.counties = res.data.counties;
      singleState.countiesLoaded = true;
      window.__store254CountiesCache = res.data.counties;
      populateCountySelect();
    }
    return singleState.counties;
  }

  function populateCountySelect() {
    const selectEl = document.getElementById("single-item-county");
    if (!selectEl || selectEl.tagName !== "SELECT") return;
    const prevVal = selectEl.value;
    selectEl.innerHTML = `<option value="">Select County...</option>` +
      singleState.counties
        .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
        .join("");

    if (prevVal && singleState.counties.some((c) => c.id === prevVal)) {
      selectEl.value = prevVal;
    } else if (singleState.selectedLocation?.countyId) {
      selectEl.value = singleState.selectedLocation.countyId;
    }
  }

  function renderSelectedLocationBanner() {
    const el = document.getElementById("single-item-selected-loc");
    if (!el) return;
    const loc = singleState.selectedLocation;
    if (!loc || (!loc.locationName && !loc.countyName)) {
      el.textContent = "";
      el.classList.add("hidden");
      return;
    }
    const parts = [loc.locationName, loc.constituencyName, loc.countyName].filter(Boolean);
    el.textContent = `Selected: ${parts.join(" · ")}`;
    el.classList.remove("hidden");
  }

  function selectSingleItemLocation(loc) {
    if (!loc) return;
    const countyId = loc.countyId || document.getElementById("single-item-county")?.value || "";
    const countyObj = singleState.counties.find((c) => c.id === countyId);
    const countyName = loc.countyName || countyObj?.name || "";

    singleState.selectedLocation = {
      countyId,
      countyName,
      locationId: loc.id || loc.locationId || "",
      locationName: loc.name || loc.locationName || "",
      constituencyName: loc.constituencyName || "",
    };

    const countyEl = document.getElementById("single-item-county");
    if (countyEl && countyId) {
      countyEl.value = countyId;
    }

    const townEl = document.getElementById("single-item-town");
    if (townEl && singleState.selectedLocation.locationName) {
      townEl.value = singleState.selectedLocation.locationName;
    }

    const resultsEl = document.getElementById("single-item-town-results");
    if (resultsEl) {
      resultsEl.classList.add("hidden");
      resultsEl.innerHTML = "";
    }
    renderSelectedLocationBanner();
  }

  async function searchSingleItemTowns(rawQuery) {
    const resultsEl = document.getElementById("single-item-town-results");
    if (!resultsEl) return;

    const countyId = document.getElementById("single-item-county")?.value || "";
    const q = String(rawQuery || "").trim();

    const params = new URLSearchParams();
    if (countyId) params.set("countyId", countyId);
    if (q) params.set("q", q);
    params.set("limit", "12");

    const res = await apiFetch(`/api/platform/locations/towns?${params.toString()}`);
    const locs = res.ok && Array.isArray(res.data?.locations) ? res.data.locations : [];
    singleState.townResults = locs;

    const rows = locs
      .map((loc, idx) => {
        const sub = [loc.constituencyName, loc.countyName].filter(Boolean).join(" · ");
        return `
          <button type="button" data-single-town-idx="${idx}" class="w-full text-left px-3 py-2 hover:bg-emerald-50 flex items-center justify-between gap-2 border-b border-slate-100 last:border-0 text-xs">
            <span class="min-w-0">
              <strong class="block text-slate-900 truncate">${esc(loc.name)}</strong>
              ${sub ? `<span class="block text-[10px] text-emerald-700 truncate">${esc(sub)}</span>` : ""}
            </span>
            <span class="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">${esc(loc.kind === "TOWN" ? "Town" : loc.kind === "ESTATE" ? "Estate" : "Centre")}</span>
          </button>`;
      })
      .join("");

    const countyObj = singleState.counties.find((c) => c.id === countyId);
    const customBtn = countyId && q.length >= 2
      ? `<button type="button" data-single-custom-town="${esc(q)}" class="w-full text-left px-3 py-2 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px]">+ Use "${esc(q)}" in ${esc(countyObj?.name || "selected county")}</button>`
      : "";

    if (!rows && !customBtn) {
      resultsEl.innerHTML = `<div class="px-3 py-2 text-xs text-slate-500">No matching centres found. Select a county or type at least 2 letters.</div>`;
    } else {
      resultsEl.innerHTML = rows + customBtn;
    }
    resultsEl.classList.remove("hidden");
  }

  // --- Photo Optimization & Upload ---
  async function fallbackOptimizeImage(file) {
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
      return { file, originalBytes: file.size, optimizedBytes: file.size, wasOptimized: false };
    }
    try {
      const bitmap = await createImageBitmap(file);
      const maxDim = 720;
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        bitmap.close?.();
        return { file, originalBytes: file.size, optimizedBytes: file.size, wasOptimized: false };
      }
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close?.();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
      if (!blob) {
        return { file, originalBytes: file.size, optimizedBytes: file.size, wasOptimized: false };
      }
      const optimizedFile = new File([blob], "item.webp", { type: blob.type || "image/webp" });
      return {
        file: optimizedFile,
        originalBytes: file.size,
        optimizedBytes: optimizedFile.size,
        wasOptimized: true,
      };
    } catch {
      return { file, originalBytes: file.size, optimizedBytes: file.size, wasOptimized: false };
    }
  }

  function renderSingleItemPhotoPreviews() {
    const container = document.getElementById("single-item-photo-previews");
    if (!container) return;

    if (singleState.uploadedImages.length === 0 && singleState.uploadingCount === 0) {
      container.innerHTML = "";
      return;
    }

    const cards = singleState.uploadedImages
      .map((url, idx) => `
        <div class="relative rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-100">
          <img src="${esc(url)}" alt="Item photo ${idx + 1}" class="w-full h-full object-cover" />
          <button type="button" data-single-remove-photo="${idx}" aria-label="Remove photo ${idx + 1}" class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/75 hover:bg-rose-600 text-white text-xs font-bold flex items-center justify-center shadow">✕</button>
        </div>`)
      .join("");

    const loadingCards = Array.from({ length: singleState.uploadingCount }, () => `
      <div class="rounded-xl border border-emerald-200 bg-emerald-50 aspect-square flex items-center justify-center text-[10px] font-bold text-emerald-700 animate-pulse">
        Uploading…
      </div>`).join("");

    container.innerHTML = cards + loadingCards;
  }

  window.removeSingleItemPhoto = function removeSingleItemPhoto(idx) {
    const index = Number(idx);
    if (!Number.isFinite(index) || index < 0 || index >= singleState.uploadedImages.length) return;
    singleState.uploadedImages.splice(index, 1);
    renderSingleItemPhotoPreviews();
  };

  window.handleSingleItemPhotoUpload = async function handleSingleItemPhotoUpload(inputEl) {
    const rawFiles = Array.from(inputEl?.files || []);
    if (!rawFiles.length) return;

    const files = rawFiles.filter((f) => !f.type || f.type.startsWith("image/"));
    if (files.length !== rawFiles.length) {
      toast("Only image files (JPG, PNG, WebP) can be uploaded.", "error");
      if (!files.length) {
        if (inputEl) inputEl.value = "";
        return;
      }
    }

    if (singleState.uploadedImages.length + files.length > MAX_PHOTOS) {
      toast(`You can attach up to ${MAX_PHOTOS} photos per listing.`, "error");
      inputEl.value = "";
      return;
    }

    setSingleItemFeedback("");
    singleState.uploadingCount += files.length;
    renderSingleItemPhotoPreviews();

    const optimizer = window.StoreMediaOptimizer;
    const base = typeof API_BASE_URL === "string" ? API_BASE_URL : "";

    let uploaded = 0;
    let totalOriginal = 0;
    let totalOptimized = 0;

    try {
      await Promise.all(
        files.map(async (rawFile) => {
          const optimized = optimizer?.optimizeImageFileForUpload
            ? await optimizer.optimizeImageFileForUpload(rawFile, "product")
            : await fallbackOptimizeImage(rawFile);

          const formData = new FormData();
          formData.append("file", optimized.file || rawFile);

          const res = await fetch(`${base}/api/platform/single-items/media`, {
            method: "POST",
            credentials: "include",
            body: formData,
          });
          const data = await res.json().catch(() => null);

          if (res.status === 401) {
            void syncSingleItemAuthState(true);
            toast("Please sign in with Google to upload photos.", "error");
            return;
          }

          if (res.ok && data?.success && data?.data?.url) {
            singleState.uploadedImages.push(data.data.url);
            uploaded += 1;
            totalOriginal += optimized.originalBytes || 0;
            totalOptimized += optimized.optimizedBytes || 0;
          } else {
            const msg = data?.error?.message || "Failed to upload photo.";
            toast(msg, "error");
          }
        })
      );
    } catch {
      toast("Network error while uploading photo.", "error");
    } finally {
      singleState.uploadingCount = Math.max(0, singleState.uploadingCount - files.length);
      if (inputEl) inputEl.value = "";
      renderSingleItemPhotoPreviews();
    }

    if (uploaded > 0) {
      if (optimizer?.formatImageBytes && totalOptimized > 0 && totalOptimized < totalOriginal) {
        toast(
          `Uploaded ${uploaded} optimized photo(s) (${optimizer.formatImageBytes(totalOriginal)} → ${optimizer.formatImageBytes(totalOptimized)})`,
          "success"
        );
      } else {
        toast(`Uploaded ${uploaded} photo(s)!`, "success");
      }
    }
  };

  // --- Submit Quick-Sell Listing ---
  window.handleSingleItemSubmit = async function handleSingleItemSubmit(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (singleState.isSubmitting) return;
    setSingleItemFeedback("");

    const user = await resolvePlatformUser(false);
    if (!user) {
      await syncSingleItemAuthState(true);
      setSingleItemFeedback("Please sign in with Google first to post your item.", "error");
      return;
    }

    if (singleState.uploadingCount > 0) {
      setSingleItemFeedback("Please wait for your photo upload to finish.", "info");
      return;
    }

    const titleEl = document.getElementById("single-item-title");
    const priceEl = document.getElementById("single-item-price");
    const typeEl = document.getElementById("single-item-type");
    const condEl = document.getElementById("single-item-condition");
    const descEl = document.getElementById("single-item-description");
    const sellerNameEl = document.getElementById("single-item-seller-name");
    const sellerPhoneEl = document.getElementById("single-item-seller-phone");
    const sellerWaEl = document.getElementById("single-item-seller-whatsapp");
    const countyEl = document.getElementById("single-item-county");
    const townEl = document.getElementById("single-item-town");
    const submitBtn = document.getElementById("single-item-submit-btn");

    const title = (titleEl?.value || "").trim();
    const basePrice = Math.round(Number(priceEl?.value || 0));
    const itemType = typeEl?.value === "SERVICE" ? "SERVICE" : "PHYSICAL";
    const condition = condEl?.value === "USED" ? "USED" : "NEW";
    const description = (descEl?.value || "").trim();
    const sellerName = (sellerNameEl?.value || "").trim();
    const sellerPhone = (sellerPhoneEl?.value || "").trim();
    const rawWhatsapp = (sellerWaEl?.value || "").trim();
    const sellerWhatsapp = rawWhatsapp || sellerPhone;
    const countyId = (countyEl?.value || singleState.selectedLocation?.countyId || "").trim();
    const typedTown = (townEl?.value || "").trim();

    if (title.length < 2) {
      setSingleItemFeedback("Please enter an item title (at least 2 characters).", "error");
      titleEl?.focus();
      return;
    }
    if (!Number.isFinite(basePrice) || basePrice < 1) {
      setSingleItemFeedback("Please enter a valid price in KES (at least 1).", "error");
      priceEl?.focus();
      return;
    }
    if (sellerName.length < 2) {
      setSingleItemFeedback("Please enter your seller name.", "error");
      sellerNameEl?.focus();
      return;
    }
    if (sellerPhone.replace(/\D/g, "").length < 9) {
      setSingleItemFeedback("Please enter a valid phone number so buyers can reach you.", "error");
      sellerPhoneEl?.focus();
      return;
    }
    if (rawWhatsapp && rawWhatsapp.replace(/\D/g, "").length < 9) {
      setSingleItemFeedback("WhatsApp number should be at least 9 digits (or leave blank to use phone).", "error");
      sellerWaEl?.focus();
      return;
    }
    if (!countyId) {
      setSingleItemFeedback("Please select your County.", "error");
      countyEl?.focus();
      return;
    }

    const locationMatchesCounty =
      singleState.selectedLocation?.locationId &&
      (!singleState.selectedLocation?.countyId || singleState.selectedLocation.countyId === countyId);
    const locationId = locationMatchesCounty ? singleState.selectedLocation.locationId : undefined;
    const customLocationName = !locationId
      ? (singleState.selectedLocation?.countyId === countyId ? singleState.selectedLocation?.locationName : "") || typedTown
      : undefined;

    if (!locationId && (!customLocationName || customLocationName.length < 2)) {
      setSingleItemFeedback("Please choose or type your town / shopping centre.", "error");
      townEl?.focus();
      return;
    }

    try {
      localStorage.setItem(PHONE_STORAGE_KEY, sellerPhone);
    } catch {}

    const prevBtnHtml = submitBtn ? submitBtn.innerHTML : "";
    singleState.isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Publishing…";
    }

    try {
      const payload = {
        title,
        basePrice,
        itemType,
        condition,
        description: description || undefined,
        sellerName,
        sellerPhone,
        sellerWhatsapp,
        countyId,
        locationId,
        customLocationName,
        images: [...singleState.uploadedImages],
      };

      const res = await apiFetch("/api/platform/single-items", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok || !res.data?.success) {
        const msg = extractErrorMsg(res, "Failed to publish listing. Please check your details.");
        setSingleItemFeedback(msg, "error");
        toast(msg, "error");
        if (res.status === 401) {
          await syncSingleItemAuthState(true);
        }
        return;
      }

      setSingleItemFeedback("Your listing is live on Store254 Marketplace! Buyers can find it right away.", "success");
      toast("Item posted live without creating a store!", "success");

      if (titleEl) titleEl.value = "";
      if (priceEl) priceEl.value = "";
      if (descEl) descEl.value = "";
      singleState.uploadedImages = [];
      renderSingleItemPhotoPreviews();

      if (typeof window.runMarketplaceProductSearch === "function") {
        void window.runMarketplaceProductSearch();
      }
      void loadMySingleItems(false);
    } finally {
      singleState.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = prevBtnHtml;
      }
      refreshIcons();
    }
  };

  // --- My Single-Item Listings ---
  function renderMySingleItems() {
    const listEl = document.getElementById("single-item-mine-list");
    if (!listEl) return;

    if (!Array.isArray(singleState.myItems) || singleState.myItems.length === 0) {
      listEl.innerHTML = `
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500">
          You haven't posted any individual items yet. Switch to "Post 1 Item" to list something in seconds!
        </div>`;
      return;
    }

    listEl.innerHTML = singleState.myItems
      .map((item) => {
        const imgUrl = Array.isArray(item.images) && item.images[0] ? item.images[0] : "";
        const isArchived = String(item.status || "").toUpperCase() === "ARCHIVED";
        const meta = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
        const locLabel = meta.locationLabel || "";
        const cond = meta.condition === "USED" ? "Used" : "New";
        const priceStr = `KES ${Number(item.basePrice || 0).toLocaleString("en-KE")}`;

        return `
          <div class="rounded-2xl border border-slate-200 bg-white p-3 flex items-center gap-3">
            <div class="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
              ${
                imgUrl
                  ? `<img src="${esc(imgUrl)}" alt="${esc(item.title)}" class="w-full h-full object-cover" />`
                  : `<i data-lucide="package" class="w-5 h-5 text-slate-400"></i>`
              }
            </div>
            <div class="min-w-0 flex-1 space-y-0.5 text-xs">
              <div class="flex items-center gap-2">
                <strong class="text-slate-900 truncate">${esc(item.title)}</strong>
                <span class="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isArchived ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"
                }">${isArchived ? "Sold / Archived" : "Active"}</span>
              </div>
              <p class="font-extrabold text-emerald-700">${esc(priceStr)} <span class="text-slate-400 font-semibold">· ${esc(cond)}${locLabel ? ` · ${esc(locLabel)}` : ""}</span></p>
              <div class="flex flex-wrap gap-2 pt-1">
                ${
                  isArchived
                    ? `<button type="button" data-single-action="relist" data-item-id="${esc(item.id)}" class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px]">Relist</button>`
                    : `<button type="button" data-single-action="mark-sold" data-item-id="${esc(item.id)}" class="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px]">Mark Sold</button>`
                }
                <button type="button" data-single-action="delete" data-item-id="${esc(item.id)}" data-item-title="${esc(item.title)}" class="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px]">Delete</button>
              </div>
            </div>
          </div>`;
      })
      .join("");
    refreshIcons(listEl);
  }

  async function loadMySingleItems(forceAuthCheck = true) {
    const listEl = document.getElementById("single-item-mine-list");
    if (!listEl) return;

    const user = await resolvePlatformUser(forceAuthCheck);
    if (!user) {
      listEl.innerHTML = `
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-center space-y-3 text-xs">
          <p class="font-bold text-slate-800">Sign in with Google to view and manage your posted items.</p>
          <button type="button" data-single-action="google-signin" class="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs">Continue with Google</button>
        </div>`;
      return;
    }

    listEl.innerHTML = `<p class="text-xs text-slate-500 py-3">Loading your listings…</p>`;
    const res = await apiFetch("/api/platform/single-items/mine");
    if (!res.ok || !res.data?.success) {
      listEl.innerHTML = `<p class="text-xs text-rose-600 py-2">${esc(extractErrorMsg(res, "Could not load your listings."))}</p>`;
      return;
    }

    const raw = res.data?.data;
    singleState.myItems = Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw)
        ? raw
        : Array.isArray(res.data?.items)
          ? res.data.items
          : [];
    renderMySingleItems();
  }

  window.markSingleItemSold = async function markSingleItemSold(id) {
    if (!id) return;
    const res = await apiFetch(`/api/platform/single-items/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    if (!res.ok || !res.data?.success) {
      toast(extractErrorMsg(res, "Could not mark listing as sold."), "error");
      return;
    }
    toast("Marked as sold!", "success");
    await loadMySingleItems(false);
    if (typeof window.runMarketplaceProductSearch === "function") {
      void window.runMarketplaceProductSearch();
    }
  };

  window.relistSingleItem = async function relistSingleItem(id) {
    if (!id) return;
    const res = await apiFetch(`/api/platform/single-items/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "PUBLISHED" }),
    });
    if (!res.ok || !res.data?.success) {
      toast(extractErrorMsg(res, "Could not relist item."), "error");
      return;
    }
    toast("Listing is active again!", "success");
    await loadMySingleItems(false);
    if (typeof window.runMarketplaceProductSearch === "function") {
      void window.runMarketplaceProductSearch();
    }
  };

  window.deleteSingleItem = async function deleteSingleItem(id, title = "this item") {
    if (!id) return;
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const res = await apiFetch(`/api/platform/single-items/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok || !res.data?.success) {
      toast(extractErrorMsg(res, "Could not delete listing."), "error");
      return;
    }
    toast("Listing deleted.", "info");
    await loadMySingleItems(false);
    if (typeof window.runMarketplaceProductSearch === "function") {
      void window.runMarketplaceProductSearch();
    }
  };

  // --- Modal & Tabs ---
  window.switchSingleItemTab = function switchSingleItemTab(tab) {
    const nextTab = tab === "mine" ? "mine" : "post";
    singleState.activeTab = nextTab;

    const postTab = document.getElementById("single-item-tab-post");
    const mineTab = document.getElementById("single-item-tab-mine");
    const postPanel = document.getElementById("single-item-post-panel");
    const minePanel = document.getElementById("single-item-mine-panel");

    if (postTab) {
      const active = nextTab === "post";
      postTab.setAttribute("aria-selected", String(active));
      postTab.classList.toggle("bg-emerald-700", active);
      postTab.classList.toggle("text-white", active);
      postTab.classList.toggle("bg-slate-100", !active);
      postTab.classList.toggle("text-slate-700", !active);
    }
    if (mineTab) {
      const active = nextTab === "mine";
      mineTab.setAttribute("aria-selected", String(active));
      mineTab.classList.toggle("bg-emerald-700", active);
      mineTab.classList.toggle("text-white", active);
      mineTab.classList.toggle("bg-slate-100", !active);
      mineTab.classList.toggle("text-slate-700", !active);
    }
    if (postPanel) postPanel.classList.toggle("hidden", nextTab !== "post");
    if (minePanel) minePanel.classList.toggle("hidden", nextTab !== "mine");

    if (nextTab === "mine") {
      void loadMySingleItems(true);
    } else {
      void syncSingleItemAuthState(false);
    }
    refreshIcons();
  };

  window.openSingleItemModal = async function openSingleItemModal(tab = "post") {
    initSingleItemBindings();
    const modal = document.getElementById("single-item-modal");
    if (!modal) return;

    singleState.isOpen = true;
    setSingleItemFeedback("");
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");

    await Promise.all([ensureCountiesLoaded(), syncSingleItemAuthState(true)]);

    // Pre-fill buyer's saved location if user hasn't picked a location yet
    if (!singleState.selectedLocation) {
      const buyerLoc = typeof window.getStore254BuyerLocation === "function" ? window.getStore254BuyerLocation() : null;
      if (buyerLoc && (buyerLoc.countyId || buyerLoc.locationId)) {
        selectSingleItemLocation({
          countyId: buyerLoc.countyId || "",
          countyName: buyerLoc.countyName || "",
          locationId: buyerLoc.locationId || "",
          locationName: buyerLoc.locationName || "",
          constituencyName: buyerLoc.constituencyName || "",
        });
      }
    }

    window.switchSingleItemTab(tab);
    refreshIcons(modal);
  };

  window.closeSingleItemModal = function closeSingleItemModal() {
    const modal = document.getElementById("single-item-modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
    singleState.isOpen = false;
  };

  function initSingleItemBindings() {
    if (singleState.initialized) return;
    const modal = document.getElementById("single-item-modal");
    if (!modal) return;
    singleState.initialized = true;

    modal.addEventListener("click", (ev) => {
      if (ev.target === modal) {
        window.closeSingleItemModal();
        return;
      }

      const townIdxBtn = ev.target?.closest?.("[data-single-town-idx]");
      if (townIdxBtn) {
        const idx = Number(townIdxBtn.getAttribute("data-single-town-idx") || 0);
        selectSingleItemLocation(singleState.townResults[idx]);
        return;
      }

      const customTownBtn = ev.target?.closest?.("[data-single-custom-town]");
      if (customTownBtn) {
        const name = customTownBtn.getAttribute("data-single-custom-town") || "";
        const countyId = document.getElementById("single-item-county")?.value || "";
        const countyObj = singleState.counties.find((c) => c.id === countyId);
        selectSingleItemLocation({
          countyId,
          countyName: countyObj?.name || "",
          locationId: "",
          locationName: name,
          constituencyName: "",
        });
        return;
      }

      const rmPhotoBtn = ev.target?.closest?.("[data-single-remove-photo]");
      if (rmPhotoBtn) {
        window.removeSingleItemPhoto(Number(rmPhotoBtn.getAttribute("data-single-remove-photo")));
        return;
      }

      const actionBtn = ev.target?.closest?.("[data-single-action]");
      if (actionBtn) {
        const action = actionBtn.getAttribute("data-single-action");
        const itemId = actionBtn.getAttribute("data-item-id") || "";
        const itemTitle = actionBtn.getAttribute("data-item-title") || "this listing";
        if (action === "mark-sold") void window.markSingleItemSold(itemId);
        else if (action === "relist") void window.relistSingleItem(itemId);
        else if (action === "delete") void window.deleteSingleItem(itemId, itemTitle);
        else if (action === "google-signin") window.startSingleItemGoogleSignIn();
      }
    });

    const postTab = document.getElementById("single-item-tab-post");
    if (postTab && !postTab.getAttribute("onclick")) {
      postTab.addEventListener("click", () => window.switchSingleItemTab("post"));
    }
    const mineTab = document.getElementById("single-item-tab-mine");
    if (mineTab && !mineTab.getAttribute("onclick")) {
      mineTab.addEventListener("click", () => window.switchSingleItemTab("mine"));
    }

    const authBtn = document.querySelector("#single-item-auth-gate button");
    if (authBtn && !authBtn.getAttribute("onclick")) {
      authBtn.addEventListener("click", () => window.startSingleItemGoogleSignIn());
    }

    const countyEl = document.getElementById("single-item-county");
    if (countyEl && !countyEl.getAttribute("onchange")) {
      countyEl.addEventListener("change", () => {
        const nextCountyId = countyEl.value || "";
        if (singleState.selectedLocation && singleState.selectedLocation.countyId !== nextCountyId) {
          singleState.selectedLocation = null;
          renderSelectedLocationBanner();
          const townEl = document.getElementById("single-item-town");
          if (townEl) townEl.value = "";
        }
        void searchSingleItemTowns(document.getElementById("single-item-town")?.value || "");
      });
    }

    const townEl = document.getElementById("single-item-town");
    if (townEl) {
      townEl.addEventListener("input", () => {
        if (singleState.selectedLocation) {
          singleState.selectedLocation = {
            ...singleState.selectedLocation,
            locationId: "",
            locationName: "",
            constituencyName: "",
          };
          renderSelectedLocationBanner();
        }
        clearTimeout(singleState.townTimer);
        singleState.townTimer = setTimeout(() => {
          void searchSingleItemTowns(townEl.value);
        }, 160);
      });
      townEl.addEventListener("focus", () => {
        void searchSingleItemTowns(townEl.value);
      });
    }

    const photoInput = document.getElementById("single-item-photo-input");
    if (photoInput && !photoInput.getAttribute("onchange")) {
      photoInput.addEventListener("change", () => void window.handleSingleItemPhotoUpload(photoInput));
    }

    const formEl = document.getElementById("single-item-form");
    if (formEl && !formEl.getAttribute("onsubmit")) {
      formEl.addEventListener("submit", (e) => void window.handleSingleItemSubmit(e));
    }

    document.addEventListener("click", (ev) => {
      const resultsEl = document.getElementById("single-item-town-results");
      const townInput = document.getElementById("single-item-town");
      if (resultsEl && townInput && !resultsEl.contains(ev.target) && ev.target !== townInput) {
        resultsEl.classList.add("hidden");
      }
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && singleState.isOpen) {
        window.closeSingleItemModal();
      }
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    initSingleItemBindings();
    let shouldReopen = false;
    try {
      shouldReopen = sessionStorage.getItem(REOPEN_SINGLE_ITEM_FLAG) === "1";
      if (shouldReopen) sessionStorage.removeItem(REOPEN_SINGLE_ITEM_FLAG);
    } catch {}
    if (shouldReopen) {
      setTimeout(() => void window.openSingleItemModal("post"), 250);
    }
  });
})();
