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

  showToast("Uploading photo(s)...");
  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);
    const r = await apiFetch("/store/settings/media", { method: "POST", body: formData });
    if (r.ok && r.data?.data?.url) {
      currentProductImages.push(r.data.data.url);
    } else {
      showToast(apiErrorMessage(r, "Failed to upload image."), false);
    }
  }
  fileInput.value = "";
  syncProductImagesState();
  showToast("Photo(s) uploaded!");
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
  const row = document.createElement('div');
  row.className = 'variant-row grid grid-cols-[1fr_90px_75px_32px] gap-2 items-center';
  row.innerHTML = `
    <input type="text" class="input text-xs py-1.5 variant-title" placeholder="Variant (e.g. Large / Red)" value="${escHtml(v.title || '')}" />
    <input type="number" min="1" class="input text-xs py-1.5 variant-price" placeholder="KES Price" value="${escHtml(v.price || '')}" />
    <input type="number" min="0" class="input text-xs py-1.5 variant-stock" placeholder="Stock" value="${escHtml(v.stockQuantity ?? 5)}" />
    <button type="button" onclick="this.closest('.variant-row').remove()" class="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center">✕</button>
  `;
  list.appendChild(row);
}

function collectProductVariants() {
  const rows = document.querySelectorAll('#product-variants-list .variant-row');
  const basePrice = parseInt(document.getElementById('product-price').value) || 1;
  const out = [];
  rows.forEach(row => {
    const title = row.querySelector('.variant-title')?.value.trim();
    const price = parseInt(row.querySelector('.variant-price')?.value) || basePrice;
    const stockQuantity = Math.max(0, parseInt(row.querySelector('.variant-stock')?.value) || 0);
    if (title) {
      out.push({ title, price, stockQuantity, options: { variant: title } });
    }
  });
  return out;
}
