// Item Details Modal & Image Gallery

function setItemModalImage(index) {
  const image = document.getElementById("item-modal-image");
  const count = document.getElementById("item-modal-image-count");
  const thumbnails = document.getElementById("item-modal-image-thumbnails");
  const images = state.currentItemImages;
  if (!image || images.length === 0) return;

  state.currentItemImageIndex = (index + images.length) % images.length;
  image.decoding = "async";
  image.fetchPriority = "high";
  image.src = images[state.currentItemImageIndex];
  image.alt = `${document.getElementById("item-modal-title").textContent} photo ${state.currentItemImageIndex + 1}`;
  if (images.length > 1) {
    const nextUrl = images[(state.currentItemImageIndex + 1) % images.length];
    if (nextUrl) {
      const preload = new Image();
      preload.decoding = "async";
      preload.src = nextUrl;
    }
  }
  count.textContent = `${state.currentItemImageIndex + 1} / ${images.length}`;
  image.onload = () => {
    const stage = document.getElementById("item-modal-gallery-stage");
    if (image.naturalWidth && image.naturalHeight) {
      stage.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
    }
  };

  for (const [thumbnailIndex, thumbnail] of [...thumbnails.children].entries()) {
    thumbnail.classList.toggle("is-active", thumbnailIndex === state.currentItemImageIndex);
    thumbnail.setAttribute("aria-pressed", String(thumbnailIndex === state.currentItemImageIndex));
  }
}

function changeItemModalImage(offset) {
  setItemModalImage(state.currentItemImageIndex + offset);
}

function renderItemImageGallery(images, title, itemObj = null) {
  const stage = document.getElementById("item-modal-gallery-stage");
  const imageEl = document.getElementById("item-modal-image");
  const artworkStage = document.getElementById("item-modal-artwork-stage");
  const thumbnailContainer = document.getElementById("item-modal-image-thumbnails");
  const count = document.getElementById("item-modal-image-count");
  const previous = document.getElementById("item-modal-image-prev");
  const next = document.getElementById("item-modal-image-next");

  const uploadedPhotos = Array.isArray(images) ? images.filter(Boolean).slice(0, 5) : [];
  const hasRealPhotos = uploadedPhotos.length > 0;
  const fallbackArt = typeof getItemFallbackArtwork === "function" ? getItemFallbackArtwork(itemObj || { title }) : { dataUri: "", stageHtml: "" };

  state.currentItemImages = hasRealPhotos ? uploadedPhotos : [fallbackArt.dataUri].filter(Boolean);
  state.currentItemImageIndex = 0;
  if (stage) stage.style.aspectRatio = "4 / 3";

  if (!hasRealPhotos && artworkStage && imageEl) {
    imageEl.classList.add("hidden");
    artworkStage.innerHTML = fallbackArt.stageHtml;
    artworkStage.classList.remove("hidden");
  } else if (imageEl && artworkStage) {
    artworkStage.innerHTML = "";
    artworkStage.classList.add("hidden");
    imageEl.classList.remove("hidden");
    imageEl.onerror = () => {
      imageEl.classList.add("hidden");
      artworkStage.innerHTML = fallbackArt.stageHtml;
      artworkStage.classList.remove("hidden");
    };
  }

  if (previous) {
    previous.onclick = (e) => {
      e?.stopPropagation();
      changeItemModalImage(-1);
    };
  }
  if (next) {
    next.onclick = (e) => {
      e?.stopPropagation();
      changeItemModalImage(1);
    };
  }
  if (stage && stage.dataset.swipeBound !== "true") {
    stage.dataset.swipeBound = "true";
    let touchStartX = null;
    stage.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.touches?.[0]?.clientX ?? null;
      },
      { passive: true }
    );
    stage.addEventListener(
      "touchend",
      (e) => {
        if (touchStartX === null) return;
        const touchEndX = e.changedTouches?.[0]?.clientX ?? touchStartX;
        const dx = touchEndX - touchStartX;
        touchStartX = null;
        if (Math.abs(dx) >= 40 && state.currentItemImages.length > 1) {
          changeItemModalImage(dx < 0 ? 1 : -1);
        }
      },
      { passive: true }
    );
  }
  const hasMultipleImages = hasRealPhotos && uploadedPhotos.length > 1;
  thumbnailContainer.replaceChildren();
  thumbnailContainer.classList.toggle("hidden", !hasMultipleImages);
  count.classList.toggle("hidden", !hasMultipleImages);
  if (previous) previous.classList.toggle("hidden", !hasMultipleImages);
  if (next) next.classList.toggle("hidden", !hasMultipleImages);

  if (hasMultipleImages) {
    state.currentItemImages.forEach((src, index) => {
      const thumbnail = document.createElement("button");
      thumbnail.type = "button";
      thumbnail.className = "item-modal-image-thumbnail";
      thumbnail.setAttribute("aria-label", `Show photo ${index + 1} of ${title}`);
      thumbnail.setAttribute("aria-pressed", "false");

      const thumbnailImage = document.createElement("img");
      thumbnailImage.src = src;
      thumbnailImage.alt = "";
      thumbnailImage.loading = "lazy";
      thumbnailImage.decoding = "async";
      thumbnail.appendChild(thumbnailImage);
      thumbnail.addEventListener("click", () => setItemModalImage(index));
      thumbnailContainer.appendChild(thumbnail);
    });
  }

  if (hasRealPhotos) {
    setItemModalImage(0);
  }
}

async function viewItemDetails(itemId, options = { updateHistory: true }) {
  const item = state.items.find((i) => i.id === itemId || i.slug === itemId);
  if (!item) return;

  state.currentItemId = item.id;
  state.currentItemSlug = item.slug || "";
  if (state.activeTenant?.name) {
    document.title = `${item.title} | ${state.activeTenant.name}`;
  }
  if (
    options?.updateHistory !== false &&
    item.slug &&
    typeof window !== "undefined" &&
    window.history &&
    typeof getStorefrontRouteUrl === "function"
  ) {
    const nextUrl = getStorefrontRouteUrl({ itemSlug: item.slug });
    const currentHistoryState =
      window.history.state && typeof window.history.state === "object"
        ? window.history.state
        : {};
    window.history.pushState(
      {
        ...currentHistoryState,
        __storefrontCategory: state.selectedCategory || "",
        __storefrontItem: item.slug,
      },
      "",
      nextUrl
    );
  }
  const isService = item.itemType === "SERVICE";
  const isDigital = item.itemType === "DIGITAL";
  const attrs = item.attributes || {};
  const serviceConfig = item.metadata?.serviceConfig || {};
  const serviceAvailable = !isService || serviceConfig.available !== false;
  const serviceModeLabels = {
    IN_PERSON_SHOP: "At Provider Location",
    ON_SITE_CLIENT: "Mobile / On-Site Visit",
    VIRTUAL_ONLINE: "Online / Remote Session",
    FLEXIBLE: "Flexible Venue",
  };
  const serviceModeLabel = serviceModeLabels[String(serviceConfig.deliveryMode || "").toUpperCase()] || "";

  document.getElementById("item-modal-title").textContent = item.title;
  renderItemImageGallery(item.images || [], item.title, item);
  document.getElementById("item-modal-price").textContent = `KES ${Number(item.basePrice).toLocaleString()}`;
  document.getElementById("item-modal-description").textContent = item.description || (isService ? "Bookable service available from this store." : "Available from this store.");

  const comparePriceEl = document.getElementById("item-modal-compare-price");
  if (item.compareAtPrice && item.compareAtPrice > item.basePrice) {
    comparePriceEl.textContent = `KES ${Number(item.compareAtPrice).toLocaleString()}`;
    comparePriceEl.classList.remove("hidden");
  } else {
    comparePriceEl.classList.add("hidden");
  }

  // Separate Product Stock Badges vs Service Booking Badges
  const badgesEl = document.getElementById("item-modal-badges");
  let statusBadgeHtml = "";
  if (isService) {
    statusBadgeHtml = `<span class="text-[10px] font-bold px-2 py-0.5 rounded ${serviceAvailable ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-amber-50 text-amber-800 border border-amber-200"}">${serviceAvailable ? "Bookable Service" : "Bookings Paused"}</span>`;
    if (serviceConfig.duration) {
      statusBadgeHtml += `<span class="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">${escapeHtml(serviceConfig.duration)}</span>`;
    }
    if (serviceModeLabel) {
      statusBadgeHtml += `<span class="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">${escapeHtml(serviceModeLabel)}</span>`;
    }
  } else if (!isDigital && item.trackInventory) {
    const qtyAvail = Number(item.stockQuantity || 0);
    statusBadgeHtml = qtyAvail <= 0
      ? `<span class="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded">Out of stock</span>`
      : qtyAvail <= 8
      ? `<span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">Only ${qtyAvail} left</span>`
      : `<span class="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded">${qtyAvail} in stock</span>`;
  }
  badgesEl.innerHTML = `
    <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
      isService ? "bg-indigo-100 text-indigo-700" : isDigital ? "bg-cyan-100 text-cyan-700" : "bg-emerald-100 text-emerald-700"
    }">${isService ? "Service" : isDigital ? "Digital" : "Product"}</span>
    ${attrs.brand ? `<span class="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">${escapeHtml(attrs.brand)}</span>` : ""}
    ${statusBadgeHtml}
  `;

  // Attributes table
  const attrsEl = document.getElementById("item-modal-attributes");
  let attrsHtml = "";
  for (const [k, v] of Object.entries(attrs)) {
    if (v) {
      const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      attrsHtml += `<div class="bg-slate-50 p-2 rounded-lg border border-slate-100"><span class="text-[10px] text-slate-400 font-semibold block">${escapeHtml(label)}</span><span class="text-xs font-bold text-slate-800">${escapeHtml(v)}</span></div>`;
    }
  }
  attrsEl.innerHTML = attrsHtml;

  // Variants / Service Packages selector & Quantity / Sessions stepper
  const variantsEl = document.getElementById("item-modal-variants");
  const qtyInput = document.getElementById("item-modal-qty");
  if (qtyInput) qtyInput.value = "1";

  let selectedVariant = null;
  const variants = Array.isArray(item.variants) ? item.variants : [];
  const btnCart = document.getElementById("item-modal-btn-cart");

  const syncCartButtonState = () => {
    const activeStock = selectedVariant ? selectedVariant.stockQuantity : item.stockQuantity;
    const isPhysicalOutOfStock = !isService && !isDigital && Boolean(item.trackInventory) && Number(activeStock || 0) <= 0;
    const blocked = isService ? !serviceAvailable : isPhysicalOutOfStock;
    btnCart.disabled = blocked;
    if (isService) {
      btnCart.innerHTML = `<i data-lucide="calendar" class="w-4 h-4"></i> <span>${serviceAvailable ? "Book Session" : "Bookings Paused"}</span>`;
      btnCart.className = `flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2`;
    } else {
      btnCart.innerHTML = `<i data-lucide="shopping-bag" class="w-4 h-4"></i> <span>${isPhysicalOutOfStock ? "Out of Stock" : "Add to Cart"}</span>`;
      btnCart.className = `flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2`;
    }
  };

  if (variantsEl) {
    if (variants.length > 0) {
      selectedVariant = variants[0];
      document.getElementById("item-modal-price").textContent = `KES ${Number(selectedVariant.price).toLocaleString()}`;
      variantsEl.innerHTML = `
        <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">${isService ? "Choose Package" : isDigital ? "Choose Edition" : "Choose Option"}</label>
        <div class="flex flex-wrap gap-2" id="item-modal-variant-buttons">
          ${variants.map((v, idx) => `
            <button type="button" data-variant-idx="${idx}" class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              idx === 0 ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-200 hover:border-emerald-400"
            }">${escapeHtml(v.title)} · KES ${Number(v.price).toLocaleString()}</button>
          `).join("")}
        </div>`;
      variantsEl.classList.remove("hidden");
      variantsEl.querySelectorAll("[data-variant-idx]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.getAttribute("data-variant-idx") || 0);
          selectedVariant = variants[idx] || variants[0];
          document.getElementById("item-modal-price").textContent = `KES ${Number(selectedVariant.price).toLocaleString()}`;
          variantsEl.querySelectorAll("[data-variant-idx]").forEach((b, i) => {
            b.className = `px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              i === idx ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-200 hover:border-emerald-400"
            }`;
          });
          syncCartButtonState();
          renderIcons();
        });
      });
    } else {
      variantsEl.innerHTML = "";
      variantsEl.classList.add("hidden");
    }
  }

  // Action Button (Book Session for services vs Add to Cart for products)
  syncCartButtonState();
  btnCart.onclick = () => {
    if (btnCart.disabled) return;
    const qty = Math.max(1, parseInt(document.getElementById("item-modal-qty")?.value || "1", 10) || 1);
    const displayTitle = selectedVariant ? `${item.title} (${selectedVariant.title})` : item.title;
    const unitPrice = selectedVariant ? selectedVariant.price : item.basePrice;
    addToCart(item.id, displayTitle, unitPrice, state.currentItemImages[state.currentItemImageIndex], item.itemType, selectedVariant?.id, qty);
    toggleDrawer("item-details-modal", false);
  };

  // Reset Review Form & Load Reviews
  toggleReviewForm(false);
  await loadItemReviews(itemId);
  toggleDrawer("item-details-modal", true);
  renderIcons();
}

function stepItemModalQty(delta) {
  const input = document.getElementById("item-modal-qty");
  if (!input) return;
  const current = parseInt(input.value || "1", 10) || 1;
  input.value = String(Math.min(99, Math.max(1, current + delta)));
}

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const modal = document.getElementById("item-details-modal");
    if (!modal || modal.classList.contains("hidden")) return;
    if (!Array.isArray(state?.currentItemImages) || state.currentItemImages.length <= 1) return;
    changeItemModalImage(e.key === "ArrowRight" ? 1 : -1);
  });
}
