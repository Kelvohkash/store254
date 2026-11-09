// PRODUCT MEDIA & VARIANTS EDITOR
// ═══════════════════════════════════════

function updateProductImageCount() {
  const input = document.getElementById('product-images');
  const count = document.getElementById('product-image-count');
  if (!input || !count) return;

  const urls = input.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  const photos = urls.length;
  count.textContent = `${photos}/5 photos`;
  count.classList.toggle('text-red-600', photos > 5);
  count.classList.toggle('text-slate-500', photos <= 5);
  renderProductImagePreviews(urls);
}

function renderProductImagePreviews(urls) {
  const container = document.getElementById('product-image-previews');
  if (!container) return;
  if (!urls.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = urls.slice(0, 5).map((url, idx) => `
    <div class="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-100">
      <img src="${escHtml(url)}" class="w-full h-full object-cover" onerror="this.style.opacity='0.3'" />
      <button type="button" onclick="removeProductImageAt(${idx})" class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="Remove photo">✕</button>
    </div>
  `).join('');
}

function removeProductImageAt(index) {
  const input = document.getElementById('product-images');
  if (!input) return;
  const urls = input.value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  urls.splice(index, 1);
  input.value = urls.join('\n');
  updateProductImageCount();
}

async function handleProductImageUpload(fileInput) {
  const files = Array.from(fileInput?.files || []);
  if (!files.length) return;
  const textarea = document.getElementById('product-images');
  const currentUrls = textarea.value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  if (currentUrls.length + files.length > 5) {
    showToast('A product can have at most 5 photos.', false);
    fileInput.value = '';
    return;
  }

  showToast('Uploading photo(s)...');
  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);
    const r = await apiFetch('/store/settings/media', { method: 'POST', body: formData });
    if (r.ok && r.data?.data?.url) {
      currentUrls.push(r.data.data.url);
    } else {
      showToast(apiErrorMessage(r, 'Failed to upload image.'), false);
    }
  }
  textarea.value = currentUrls.join('\n');
  fileInput.value = '';
  updateProductImageCount();
  showToast('Photo(s) uploaded!');
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
