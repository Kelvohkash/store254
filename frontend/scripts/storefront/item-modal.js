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

function renderItemImageGallery(images, title) {
  const thumbnailContainer = document.getElementById("item-modal-image-thumbnails");
  const count = document.getElementById("item-modal-image-count");
  const previous = document.getElementById("item-modal-image-prev");
  const next = document.getElementById("item-modal-image-next");

  state.currentItemImages = images.slice(0, 5);
  state.currentItemImageIndex = 0;
  document.getElementById("item-modal-gallery-stage").style.aspectRatio = "4 / 3";
  previous.onclick = () => changeItemModalImage(-1);
  next.onclick = () => changeItemModalImage(1);
  const hasMultipleImages = state.currentItemImages.length > 1;
  thumbnailContainer.replaceChildren();
  thumbnailContainer.classList.toggle("hidden", !hasMultipleImages);
  count.classList.toggle("hidden", !hasMultipleImages);
  previous.classList.toggle("hidden", !hasMultipleImages);
  next.classList.toggle("hidden", !hasMultipleImages);

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

  setItemModalImage(0);
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
  const attrs = item.attributes || {};
  const fallbackImage =
    item.images && item.images.length > 0
      ? item.images[0]
      : isService
      ? "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80"
      : "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80";
  const images = item.images?.length ? item.images : [fallbackImage];

  document.getElementById("item-modal-title").textContent = item.title;
  renderItemImageGallery(images, item.title);
  document.getElementById("item-modal-price").textContent = `KES ${Number(item.basePrice).toLocaleString()}`;
  document.getElementById("item-modal-description").textContent = item.description || "Available from this store.";

  const comparePriceEl = document.getElementById("item-modal-compare-price");
  if (item.compareAtPrice && item.compareAtPrice > item.basePrice) {
    comparePriceEl.textContent = `KES ${Number(item.compareAtPrice).toLocaleString()}`;
    comparePriceEl.classList.remove("hidden");
  } else {
    comparePriceEl.classList.add("hidden");
  }

  // Badges
  const badgesEl = document.getElementById("item-modal-badges");
  badgesEl.innerHTML = `
    <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
      isService ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
    }">${isService ? "Service" : "Product"}</span>
    ${attrs.brand ? `<span class="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">${escapeHtml(attrs.brand)}</span>` : ""}
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

  // Variants selector & Quantity stepper
  const variantsEl = document.getElementById("item-modal-variants");
  const qtyInput = document.getElementById("item-modal-qty");
  if (qtyInput) qtyInput.value = "1";

  let selectedVariant = null;
  const variants = Array.isArray(item.variants) ? item.variants : [];
  if (variantsEl) {
    if (variants.length > 0) {
      selectedVariant = variants[0];
      document.getElementById("item-modal-price").textContent = `KES ${Number(selectedVariant.price).toLocaleString()}`;
      variantsEl.innerHTML = `
        <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Choose Option</label>
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
        });
      });
    } else {
      variantsEl.innerHTML = "";
      variantsEl.classList.add("hidden");
    }
  }

  // Add to Cart Button
  const btnCart = document.getElementById("item-modal-btn-cart");
  btnCart.innerHTML = `<i data-lucide="${isService ? "calendar" : "shopping-bag"}" class="w-4 h-4"></i> <span>${
    isService ? "Book Appointment" : "Add to Cart"
  }</span>`;
  btnCart.className = `flex-1 py-3 ${
    isService ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700"
  } text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2`;
  btnCart.onclick = () => {
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
