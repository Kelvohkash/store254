// PRODUCTS
  // ═══════════════════════════════════════
  async function loadProducts() {
    const r = await apiFetch('/items?limit=100&includeAll=true');
    const rawItems = r.ok ? (r.data?.data?.items || r.data?.data || []) : [];
    allProducts = Array.isArray(rawItems) ? rawItems : [];
    renderProductsTable(allProducts);

    // Also load categories for the dropdown
    await loadCategoriesForDropdown();
  }

  function renderProductsTable(products) {
    const tbody = document.getElementById('products-table-body');
    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-5 py-10 text-center text-slate-400">No products yet. Add your first product!</td></tr>';
      return;
    }
    tbody.innerHTML = products.map(p => `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-5 py-3">
          <div class="flex items-center gap-3">
            ${p.images?.[0] ? `<img src="${escHtml(p.images[0])}" class="w-9 h-9 rounded-lg object-cover border border-slate-200" onerror="this.style.display='none'">` : `<div class="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center"><i data-lucide="image" class="w-4 h-4 text-slate-400"></i></div>`}
            <div>
              <p class="font-bold text-slate-900 text-sm">${escHtml(p.title)}</p>
              <p class="text-xs text-slate-400 font-mono">${escHtml(p.slug)}</p>
            </div>
          </div>
        </td>
        <td class="px-5 py-3 text-xs text-slate-500">${escHtml(p.categoryName || '—')}</td>
        <td class="px-5 py-3">
          <p class="font-black text-slate-900 text-sm">${fmt(p.basePrice)}</p>
          ${p.compareAtPrice ? `<p class="text-xs text-slate-400 line-through">${fmt(p.compareAtPrice)}</p>` : ''}
        </td>
        <td class="px-5 py-3">
          <span class="text-sm font-bold ${p.stockQuantity <= 0 ? 'text-red-600' : p.stockQuantity < 5 ? 'text-amber-600' : 'text-slate-700'}">${p.trackInventory ? p.stockQuantity : '∞'}</span>
        </td>
        <td class="px-5 py-3">
          <span class="text-[10px] font-black px-2 py-0.5 rounded-full border ${p.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : p.status === 'DRAFT' ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-red-50 text-red-600 border-red-200'}">${escHtml(p.status)}</span>
        </td>
        <td class="px-5 py-3 text-right">
          <button onclick="openEditProductModal(${inlineJs(p.id)})" class="text-xs font-bold text-slate-500 hover:text-emerald-600 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-all mr-1">Edit</button>
          <button onclick="deleteProduct(${inlineJs(p.id)}, ${inlineJs(p.title)})" class="text-xs font-bold text-slate-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-all">Delete</button>
        </td>
      </tr>
    `).join('');
    lucide.createIcons();
  }

  function filterProducts() {
    const q = document.getElementById('product-search').value.toLowerCase();
    renderProductsTable(q ? allProducts.filter(p => p.title.toLowerCase().includes(q) || (p.slug||'').includes(q)) : allProducts);
  }

  async function loadCategoriesForDropdown() {
    const r = await apiFetch('/categories');
    flatCategories = r.ok ? flattenTree(r.data?.data || []) : [];
    const catOpts = flatCategories.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join('');
    document.getElementById('product-category').innerHTML = '<option value="">No Category</option>' + catOpts;
    document.getElementById('category-parent').innerHTML = '<option value="">None (top-level)</option>' + catOpts;
  }

  function flattenTree(tree, prefix='') {
    const out = [];
    for (const n of tree) {
      out.push({ id: n.id, name: prefix + n.name });
      if (n.children?.length) out.push(...flattenTree(n.children, prefix + '  '));
    }
    return out;
  }

  function openAddProductModal() {
    document.getElementById('product-modal-title').textContent = 'Add Product';
    document.getElementById('product-id').value = '';
    document.getElementById('product-title').value = '';
    document.getElementById('product-description').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-compare-price').value = '';
    document.getElementById('product-stock').value = '0';
    document.getElementById('product-sku').value = '';
    document.getElementById('product-images').value = '';
    updateProductImageCount();
    renderVariantRows([]);
    document.getElementById('product-status').value = 'PUBLISHED';
    document.getElementById('product-type').value = 'PHYSICAL';
    document.getElementById('product-category').value = '';
    document.getElementById('product-modal-error').classList.add('hidden');
    document.getElementById('product-modal').classList.remove('hidden');
    lucide.createIcons();
  }

  function openEditProductModal(id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;
    document.getElementById('product-modal-title').textContent = 'Edit Product';
    document.getElementById('product-id').value = p.id;
    document.getElementById('product-title').value = p.title;
    document.getElementById('product-description').value = p.description || '';
    document.getElementById('product-price').value = p.basePrice;
    document.getElementById('product-compare-price').value = p.compareAtPrice || '';
    document.getElementById('product-stock').value = p.stockQuantity || 0;
    document.getElementById('product-sku').value = p.sku || '';
    document.getElementById('product-images').value = (p.images || []).join('\n');
    updateProductImageCount();
    renderVariantRows(p.variants || []);
    document.getElementById('product-status').value = p.status || 'PUBLISHED';
    document.getElementById('product-type').value = p.itemType || 'PHYSICAL';
    document.getElementById('product-category').value = p.categoryId || '';
    document.getElementById('product-modal-error').classList.add('hidden');
    document.getElementById('product-modal').classList.remove('hidden');
    lucide.createIcons();
  }

  async function handleSaveProduct(e) {
    e.preventDefault();
    const btn = document.getElementById('product-save-btn');
    const errEl = document.getElementById('product-modal-error');
    const id = document.getElementById('product-id').value;
    const images = document.getElementById('product-images').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if (images.length > 5) {
      errEl.textContent = 'A product can have at most 5 photos. Remove extra image URLs before saving.';
      errEl.classList.remove('hidden');
      updateProductImageCount();
      return;
    }

    btn.disabled = true; btn.innerHTML = 'Saving...';
    errEl.classList.add('hidden');

    const body = {
      title: document.getElementById('product-title').value.trim(),
      description: document.getElementById('product-description').value.trim() || undefined,
      basePrice: parseInt(document.getElementById('product-price').value) || 0,
      compareAtPrice: parseInt(document.getElementById('product-compare-price').value) || undefined,
      stockQuantity: parseInt(document.getElementById('product-stock').value) || 0,
      sku: document.getElementById('product-sku').value.trim() || undefined,
      images,
      status: document.getElementById('product-status').value,
      itemType: document.getElementById('product-type').value,
      categoryId: document.getElementById('product-category').value || undefined,
      trackInventory: true,
      variants: collectProductVariants(),
    };

    const r = id
      ? await apiFetch(`/items/${id}`, { method: 'PUT', body: JSON.stringify(body) })
      : await apiFetch('/items', { method: 'POST', body: JSON.stringify(body) });

    btn.disabled = false; btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Save Product'; lucide.createIcons();

    if (!r.ok) {
      errEl.textContent = apiErrorMessage(r, 'Failed to save product.');
      errEl.classList.remove('hidden');
      return;
    }

    closeModal('product-modal');
    showToast(id ? 'Product updated!' : 'Product added!');
    await loadProducts();
  }

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

  async function deleteProduct(id, title) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const r = await apiFetch(`/items/${id}`, { method: 'DELETE' });
    if (r.ok) { showToast('Product deleted.'); allProducts = allProducts.filter(p => p.id !== id); renderProductsTable(allProducts); }
    else showToast(apiErrorMessage(r, 'Failed to delete.'), false);
  }

  // ═══════════════════════════════════════
  // CATEGORIES
  // ═══════════════════════════════════════
  async function loadCategories() {
    const r = await apiFetch('/categories');
    flatCategories = r.ok ? flattenTree(r.data?.data || []) : [];
    renderCategoriesTable(r.ok ? flattenTree(r.data?.data || []) : []);
    // Reload parent dropdown
    document.getElementById('category-parent').innerHTML = '<option value="">None (top-level)</option>' + flatCategories.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join('');
  }

  function renderCategoriesTable(cats) {
    const tbody = document.getElementById('categories-table-body');
    if (!cats.length) { tbody.innerHTML = '<tr><td colspan="4" class="px-5 py-10 text-center text-slate-400">No categories yet.</td></tr>'; return; }
    tbody.innerHTML = cats.map(c => `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-5 py-3 font-bold text-slate-900 text-sm">${escHtml(c.name)}</td>
        <td class="px-5 py-3 text-xs text-slate-400 font-mono">${escHtml(c.slug || '')}</td>
        <td class="px-5 py-3 text-xs text-slate-500">${c.parentId ? escHtml(flatCategories.find(x=>x.id===c.parentId)?.name||'—') : '—'}</td>
        <td class="px-5 py-3 text-right">
          <button onclick="deleteCategory(${inlineJs(c.id)}, ${inlineJs(c.name)})" class="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-all">Delete</button>
        </td>
      </tr>
    `).join('');
  }

  function openAddCategoryModal() {
    document.getElementById('category-name').value = '';
    document.getElementById('category-desc').value = '';
    document.getElementById('category-parent').value = '';
    document.getElementById('category-modal-error').classList.add('hidden');
    document.getElementById('category-modal').classList.remove('hidden');
    lucide.createIcons();
  }

  async function handleSaveCategory(e) {
    e.preventDefault();
    const errEl = document.getElementById('category-modal-error');
    errEl.classList.add('hidden');
    const body = {
      name: document.getElementById('category-name').value.trim(),
      description: document.getElementById('category-desc').value.trim() || undefined,
      parentId: document.getElementById('category-parent').value || undefined,
    };
    const r = await apiFetch('/categories', { method: 'POST', body: JSON.stringify(body) });
    if (!r.ok) { errEl.textContent = apiErrorMessage(r, 'Failed to create category.'); errEl.classList.remove('hidden'); return; }
    closeModal('category-modal'); showToast('Category created!'); loadCategories();
  }

  async function deleteCategory(id, name) {
    if (!confirm(`Delete category "${name}"?`)) return;
    const r = await apiFetch(`/categories/${id}`, { method: 'DELETE' });
    if (r.ok) { showToast('Category deleted.'); loadCategories(); }
    else showToast(apiErrorMessage(r, 'Cannot delete.'), false);
  }

  // ═══════════════════════════════════════
  // PROMOTIONS & COUPONS
  // ═══════════════════════════════════════
  async function loadPromotions() {
    const r = await apiFetch('/offers/manage');
    const promos = r.ok && Array.isArray(r.data?.data) ? r.data.data : [];
    renderPromotionsTable(promos);
  }

  function renderPromotionsTable(promos) {
    const tbody = document.getElementById('promotions-table-body');
    if (!tbody) return;
    if (!promos.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-5 py-10 text-center text-slate-400">No promotions or coupon codes yet. Create one to boost sales!</td></tr>';
      return;
    }
    tbody.innerHTML = promos.map(p => `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-5 py-3 font-bold text-slate-900 text-sm">${escHtml(p.title)}</td>
        <td class="px-5 py-3">
          ${p.code ? `<span class="font-mono text-xs font-black bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200">${escHtml(p.code)}</span>` : '<span class="text-xs text-slate-400">Auto</span>'}
        </td>
        <td class="px-5 py-3 font-black text-emerald-700 text-sm">
          ${p.discountType === 'PERCENTAGE' ? `${p.discountValue}% OFF` : fmt(p.discountValue)}
        </td>
        <td class="px-5 py-3 text-xs text-slate-500">${p.minOrderAmount ? fmt(p.minOrderAmount) : 'None'}</td>
        <td class="px-5 py-3 text-xs font-bold text-slate-600">${p.usageCount || 0}${p.usageLimit ? ` / ${p.usageLimit}` : ''}</td>
        <td class="px-5 py-3">
          <span class="text-[10px] font-black px-2 py-0.5 rounded-full border ${p.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}">${p.isActive ? 'ACTIVE' : 'PAUSED'}</span>
        </td>
        <td class="px-5 py-3 text-right">
          <button onclick="togglePromoStatus(${inlineJs(p.id)}, ${!p.isActive})" class="text-xs font-bold text-slate-600 hover:text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-50 mr-1">${p.isActive ? 'Pause' : 'Activate'}</button>
          <button onclick="deletePromo(${inlineJs(p.id)}, ${inlineJs(p.title)})" class="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg">Delete</button>
        </td>
      </tr>
    `).join('');
  }

  function openAddPromoModal() {
    document.getElementById('promo-title').value = '';
    document.getElementById('promo-code').value = '';
    document.getElementById('promo-type').value = 'PERCENTAGE';
    document.getElementById('promo-value').value = '';
    document.getElementById('promo-min-order').value = '0';
    document.getElementById('promo-usage-limit').value = '';
    document.getElementById('promo-ends-at').value = '';
    document.getElementById('promo-modal-error').classList.add('hidden');
    document.getElementById('promo-modal').classList.remove('hidden');
    lucide.createIcons();
  }

  async function handleSavePromo(e) {
    e.preventDefault();
    const errEl = document.getElementById('promo-modal-error');
    errEl.classList.add('hidden');
    const endsDate = document.getElementById('promo-ends-at').value;
    const usageLimitVal = parseInt(document.getElementById('promo-usage-limit').value);
    const body = {
      title: document.getElementById('promo-title').value.trim(),
      code: document.getElementById('promo-code').value.trim().toUpperCase(),
      discountType: document.getElementById('promo-type').value,
      discountValue: parseInt(document.getElementById('promo-value').value) || 1,
      minOrderAmount: parseInt(document.getElementById('promo-min-order').value) || 0,
      usageLimit: usageLimitVal > 0 ? usageLimitVal : undefined,
      startsAt: new Date().toISOString(),
      endsAt: endsDate ? new Date(`${endsDate}T23:59:59Z`).toISOString() : undefined,
    };
    const r = await apiFetch('/offers', { method: 'POST', body: JSON.stringify(body) });
    if (!r.ok) {
      errEl.textContent = apiErrorMessage(r, 'Could not create promotion.');
      errEl.classList.remove('hidden');
      return;
    }
    closeModal('promo-modal');
    showToast('Coupon created!');
    loadPromotions();
  }

  async function togglePromoStatus(id, isActive) {
    const r = await apiFetch(`/offers/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
    if (r.ok) {
      showToast(isActive ? 'Promotion activated!' : 'Promotion paused.');
      loadPromotions();
    } else {
      showToast(apiErrorMessage(r, 'Failed to update promotion.'), false);
    }
  }

  async function deletePromo(id, title) {
    if (!confirm(`Delete promotion "${title}"?`)) return;
    const r = await apiFetch(`/offers/${id}`, { method: 'DELETE' });
    if (r.ok) {
      showToast('Promotion deleted.');
      loadPromotions();
    } else {
      showToast(apiErrorMessage(r, 'Failed to delete promotion.'), false);
    }
  }

  // ═══════════════════════════════════════
  