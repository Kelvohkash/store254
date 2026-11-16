// PRODUCT MEDIA & VARIANTS EDITOR
// ═══════════════════════════════════════

let currentProductImages = [];

function getProductImages() {
  return [...currentProductImages];
}

function setProductImages(images = []) {
  currentProductImages = Array.isArray(images)
    ? images.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean)
    : [];
  syncProductImagesState();
}

function syncProductImagesState() {
  const count = document.getElementById("product-image-count");
  const photos = currentProductImages.length;
  if (count) {
    count.textContent = `${photos}/5 photos`;
    count.classList.toggle("text-red-600", photos > 5);
    count.classList.toggle("text-slate-500", photos <= 5);
  }

  const hiddenInput = document.getElementById("product-images");
  if (hiddenInput) {
    hiddenInput.value = currentProductImages.join("\n");
  }

  renderProductImagePreviews(currentProductImages);
}

function updateProductImageCount() {
  const hiddenInput = document.getElementById("product-images");
  if (hiddenInput && hiddenInput.value && !currentProductImages.length) {
    currentProductImages = hiddenInput.value.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
  }
  syncProductImagesState();
}

function renderProductImagePreviews(urls) {
  const container = document.getElementById("product-image-previews");
  if (!container) return;
  if (!urls.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = urls.slice(0, 5).map((url, idx) => `
    <div class="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-100">
      <img src="${escHtml(url)}" class="w-full h-full object-cover" onerror="this.style.opacity='0.3'" />
      <button type="button" onclick="removeProductImageAt(${idx})" class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/75 hover:bg-red-600 text-white text-xs font-bold flex items-center justify-center transition-colors shadow-sm" title="Remove photo" aria-label="Remove photo">✕</button>
    </div>
  `).join("");
}

function removeProductImageAt(index) {
  currentProductImages.splice(index, 1);
  syncProductImagesState();
}

async function handleProductImageUpload(fileInput) {
  const files = Array.from(fileInput?.files || []);
  if (!files.length) return;
  if (currentProductImages.length + files.length > 5) {
    showToast("A product can have at most 5 photos.", false);
    fileInput.value = "";
    return;
  }

  const optimizer = window.StoreMediaOptimizer;
  showToast(`Optimizing & uploading ${files.length} photo(s)...`);

  const results = await Promise.all(
    files.map(async (rawFile) => {
      const optimized = optimizer?.optimizeImageFileForUpload
        ? await optimizer.optimizeImageFileForUpload(rawFile, "product")
        : { file: rawFile, originalBytes: rawFile.size, optimizedBytes: rawFile.size, wasOptimized: false };

      const formData = new FormData();
      formData.append("file", optimized.file || rawFile);
      const r = await apiFetch("/store/settings/media", { method: "POST", body: formData });
      return { r, optimized };
    })
  );

  let uploadedCount = 0;
  let totalOriginal = 0;
  let totalOptimized = 0;

  for (const { r, optimized } of results) {
    if (r.ok && r.data?.data?.url) {
      currentProductImages.push(r.data.data.url);
      uploadedCount += 1;
      totalOriginal += optimized.originalBytes || 0;
      totalOptimized += optimized.optimizedBytes || 0;
    } else {
      showToast(apiErrorMessage(r, "Failed to upload image."), false);
    }
  }

  fileInput.value = "";
  syncProductImagesState();
  if (uploadedCount > 0) {
    if (optimizer?.formatImageBytes && totalOptimized > 0 && totalOptimized < totalOriginal) {
      showToast(`Uploaded ${uploadedCount} optimized photo(s) (${optimizer.formatImageBytes(totalOriginal)} → ${optimizer.formatImageBytes(totalOptimized)})!`);
    } else {
      showToast(`Uploaded ${uploadedCount} photo(s)!`);
    }
  }
}

function getEditorItemType() {
  return document.getElementById('product-type')?.value || 'PHYSICAL';
}

function syncItemEditorTypeUI(itemType) {
  const type = itemType || getEditorItemType();
  const isService = type === 'SERVICE';
  const isDigital = type === 'DIGITAL';
  const isEditing = Boolean(document.getElementById('product-id')?.value);

  const invSection = document.getElementById('product-inventory-section');
  const serviceSection = document.getElementById('service-setup-section');
  const digitalSection = document.getElementById('digital-setup-section');
  if (invSection) invSection.classList.toggle('hidden', isService || isDigital);
  if (serviceSection) serviceSection.classList.toggle('hidden', !isService);
  if (digitalSection) digitalSection.classList.toggle('hidden', !isDigital);

  const modalTitle = document.getElementById('product-modal-title');
  if (modalTitle) {
    const noun = isService ? 'Service' : isDigital ? 'Digital Product' : 'Product';
    modalTitle.textContent = isEditing ? `Edit ${noun}` : `Add ${noun}`;
  }
  const titleLabel = document.getElementById('product-title-label');
  if (titleLabel) titleLabel.textContent = isService ? 'Service Name *' : isDigital ? 'Digital Product Title *' : 'Product Title *';
  const attrHeading = document.getElementById('product-attributes-heading');
  if (attrHeading) attrHeading.textContent = isService ? 'Service Specifications' : 'Product Details';
  const attrHelp = document.getElementById('product-attributes-help');
  if (attrHelp) attrHelp.textContent = isService ? 'Add extra details for this service.' : 'Add any extra details for this product.';
  const photosLabel = document.getElementById('product-photos-label');
  if (photosLabel) {
    photosLabel.innerHTML = `${isService ? 'Service Photos' : 'Product Photos'} <span class="text-slate-400 font-normal">(up to 5)</span>`;
  }
  const variantsHeading = document.getElementById('product-variants-heading');
  if (variantsHeading) {
    variantsHeading.innerHTML = `${isService ? 'Service Packages &amp; Tiers' : isDigital ? 'License Editions' : 'Product Variants'} <span class="text-slate-400 font-normal lowercase">(optional)</span>`;
  }
  const variantsHelp = document.getElementById('product-variants-help');
  if (variantsHelp) {
    variantsHelp.textContent = isService
      ? 'Offer tiered packages (e.g. Basic Mix, Full Session, VIP Home Visit) — no stock needed'
      : isDigital
      ? 'Offer different licenses or editions with specific prices'
      : 'Add sizes, colours, or options with specific prices and stock';
  }
  const addVariantBtn = document.getElementById('product-add-variant-btn');
  if (addVariantBtn) addVariantBtn.textContent = isService ? '+ Add Package' : '+ Add Variant';

  const saveBtn = document.getElementById('product-save-btn');
  if (saveBtn && !saveBtn.disabled) {
    saveBtn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> Save ${isService ? 'Service' : 'Product'}`;
  }

  document.querySelectorAll('#product-variants-list .variant-row').forEach((row) => {
    const stockInput = row.querySelector('.variant-stock');
    const titleInput = row.querySelector('.variant-title');
    if (stockInput) stockInput.classList.toggle('hidden', isService || isDigital);
    if (titleInput) {
      titleInput.placeholder = isService ? 'Package (e.g. VIP Session)' : isDigital ? 'Edition (e.g. Pro License)' : 'Option (e.g. Red / XL)';
    }
    row.className = isService || isDigital
      ? 'variant-row grid grid-cols-[1fr_105px_32px] gap-2 items-center'
      : 'variant-row grid grid-cols-[1fr_90px_75px_32px] gap-2 items-center';
  });
}

function getAdminStoreArtworkContext() {
  const storeInfo = typeof getAdminStoreInfo === 'function' ? getAdminStoreInfo() : null;
  const categoryId = document.getElementById('product-category')?.value || '';
  const matchedCat = Array.isArray(flatCategories) ? flatCategories.find((c) => c.id === categoryId) : null;
  return {
    title: document.getElementById('product-title')?.value?.trim() || '',
    description: document.getElementById('product-description')?.value?.trim() || '',
    itemType: getEditorItemType(),
    categoryName: matchedCat?.name || '',
    attributes: typeof collectProductAttributeFields === 'function' ? collectProductAttributeFields() : {},
    businessType: storeInfo?.businessType || '',
    storeName: storeInfo?.name || '',
  };
}

function updateItemArtworkPreviewUi(artworkId, mode, labelText) {
  const idInput = document.getElementById('product-artwork-icon');
  const modeInput = document.getElementById('product-artwork-mode');
  const preview = document.getElementById('product-artwork-preview');
  const badge = document.getElementById('product-artwork-badge');
  const labelEl = document.getElementById('product-artwork-label');
  const resetBtn = document.getElementById('product-artwork-reset');
  if (!idInput || !preview || !window.Store254ItemArtwork) return;

  idInput.value = artworkId || '';
  if (modeInput) modeInput.value = mode || 'auto';
  const ctx = getAdminStoreArtworkContext();
  preview.innerHTML = window.Store254ItemArtwork.renderSvgString({ ...ctx, artworkIcon: artworkId }, ctx);

  if (badge) {
    badge.textContent = mode === 'manual' ? 'Custom' : 'Auto';
    badge.className = mode === 'manual'
      ? 'text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800'
      : 'text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
  }
  if (labelEl) labelEl.textContent = labelText || artworkId || 'Smart match';
  if (resetBtn) resetBtn.classList.toggle('hidden', mode !== 'manual');
}

function handleItemArtworkPreviewInput() {
  if (!window.Store254ItemArtwork) return;
  const mode = document.getElementById('product-artwork-mode')?.value || 'auto';
  if (mode === 'manual') return;
  const ctx = getAdminStoreArtworkContext();
  const resolved = window.Store254ItemArtwork.resolveArtwork(ctx, ctx);
  updateItemArtworkPreviewUi(resolved.id, 'auto', `${resolved.label}`);
  renderItemArtworkPicker(document.getElementById('product-artwork-search')?.value || '');
}

function selectManualItemArtwork(artworkId) {
  if (!window.Store254ItemArtwork) return;
  const entry = window.Store254ItemArtwork.ARTWORK_DEFINITIONS.find((d) => d.id === artworkId);
  updateItemArtworkPreviewUi(artworkId, 'manual', entry ? `${entry.label} (Custom)` : artworkId);
  renderItemArtworkPicker(document.getElementById('product-artwork-search')?.value || '');
}

function resetItemArtworkToAuto() {
  const modeInput = document.getElementById('product-artwork-mode');
  if (modeInput) modeInput.value = 'auto';
  handleItemArtworkPreviewInput();
}

function renderItemArtworkPicker(queryText = '') {
  const grid = document.getElementById('product-artwork-grid');
  if (!grid || !window.Store254ItemArtwork) return;
  const activeId = document.getElementById('product-artwork-icon')?.value || '';
  const list = window.Store254ItemArtwork.searchCatalog(queryText);
  if (!list.length) {
    grid.innerHTML = '<div class="col-span-full text-center text-[11px] text-slate-400 py-3">No matching icons — try another keyword</div>';
    return;
  }
  grid.innerHTML = list.map((entry) => {
    const selected = entry.id === activeId;
    const svg = window.Store254ItemArtwork.renderSvgString({ title: entry.label, artworkIcon: entry.id }, {});
    return `<button type="button" onclick="selectManualItemArtwork(${inlineJs(entry.id)})" title="${escHtml(entry.label)}" aria-label="${escHtml(entry.label)}" class="w-10 h-10 rounded-lg overflow-hidden border-2 transition-all p-0.5 bg-white ${
      selected ? 'border-emerald-600 ring-2 ring-emerald-200 scale-105' : 'border-slate-200 hover:border-emerald-400'
    }">${svg}</button>`;
  }).join('');
}

function renderVariantRows(variants = []) {
  const list = document.getElementById('product-variants-list');
  if (!list) return;
  list.innerHTML = '';
  variants.forEach(v => addProductVariantRow(v));
}

function addProductVariantRow(v = {}) {
  const list = document.getElementById('product-variants-list');
  if (!list) return;
  const type = getEditorItemType();
  const isNoStockType = type === 'SERVICE' || type === 'DIGITAL';
  const row = document.createElement('div');
  row.className = isNoStockType
    ? 'variant-row grid grid-cols-[1fr_105px_32px] gap-2 items-center'
    : 'variant-row grid grid-cols-[1fr_90px_75px_32px] gap-2 items-center';
  row.innerHTML = `
    <input type="text" class="input text-xs py-1.5 variant-title" placeholder="${isNoStockType ? (type === 'SERVICE' ? 'Package (e.g. VIP Session)' : 'Edition (e.g. Pro)') : 'Option (e.g. Red / XL)'}" value="${escHtml(v.title || '')}" />
    <input type="number" min="1" class="input text-xs py-1.5 variant-price" placeholder="KES Price" value="${escHtml(v.price || '')}" />
    <input type="number" min="0" class="input text-xs py-1.5 variant-stock ${isNoStockType ? 'hidden' : ''}" placeholder="Stock" value="${escHtml(v.stockQuantity ?? (isNoStockType ? 0 : 5))}" />
    <button type="button" onclick="this.closest('.variant-row').remove()" class="variant-remove-btn w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center" aria-label="Remove variant">✕</button>
  `;
  list.appendChild(row);
}

function collectProductVariants() {
  const rows = document.querySelectorAll('#product-variants-list .variant-row');
  const basePrice = parseInt(document.getElementById('product-price').value) || 1;
  const isNoStockType = ['SERVICE', 'DIGITAL'].includes(getEditorItemType());
  const out = [];
  rows.forEach(row => {
    const title = row.querySelector('.variant-title')?.value.trim();
    const price = parseInt(row.querySelector('.variant-price')?.value) || basePrice;
    const stockQuantity = isNoStockType ? 0 : Math.max(0, parseInt(row.querySelector('.variant-stock')?.value) || 0);
    if (title) {
      out.push({ title, price, stockQuantity, options: { variant: title } });
    }
  });
  return out;
}
