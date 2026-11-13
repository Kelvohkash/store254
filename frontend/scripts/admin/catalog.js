// PRODUCTS
// ═══════════════════════════════════════

let productAttributeDraft = {};
let productAttributeLoadToken = 0;

function captureProductAttributeFields() {
  document.querySelectorAll('[data-product-attribute-code]').forEach((field) => {
    const code = field.dataset.productAttributeCode;
    const value = field.value.trim();
    if (!value) {
      delete productAttributeDraft[code];
    } else if (field.dataset.productAttributeType === 'NUMBER' && Number.isFinite(Number(value))) {
      productAttributeDraft[code] = Number(value);
    } else {
      productAttributeDraft[code] = value;
    }
  });
}

function collectProductAttributeFields() {
  captureProductAttributeFields();
  return { ...productAttributeDraft };
}

async function loadProductAttributeFields(categoryId, initialAttributes = null) {
  const section = document.getElementById('product-attributes-section');
  const container = document.getElementById('product-attributes-fields');
  if (!section || !container) return;

  if (initialAttributes) productAttributeDraft = { ...initialAttributes };
  else captureProductAttributeFields();

  const token = ++productAttributeLoadToken;
  container.innerHTML = '<p class="text-xs text-slate-500">Loading product details…</p>';
  section.classList.remove('hidden');

  // Load definitions once, then keep globals and only the selected category's
  // ancestor chain. This inherits useful parent fields without sibling fields.
  const response = await apiFetch('/attributes');
  if (token !== productAttributeLoadToken) return;
  if (!response.ok) {
    section.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  const definitions = Array.isArray(response.data?.data) ? response.data.data : [];
  const relevantCategoryIds = new Set();
  let ancestor = (flatCategories || []).find((category) => category.id === categoryId);
  while (ancestor && !relevantCategoryIds.has(ancestor.id)) {
    relevantCategoryIds.add(ancestor.id);
    ancestor = (flatCategories || []).find((category) => category.id === ancestor.parentId);
  }
  const applicable = definitions.filter((definition) =>
    !definition.categoryId || relevantCategoryIds.has(definition.categoryId)
  );

  if (!applicable.length) {
    section.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  container.innerHTML = applicable.map((definition) => {
    const code = String(definition.code || '');
    const name = String(definition.name || code);
    const value = productAttributeDraft[code] ?? '';
    const required = definition.isRequired ? 'required' : '';
    const type = definition.type || 'TEXT';
    const options = Array.isArray(definition.options) ? definition.options : [];
    const id = `product-attribute-${code}`;
    let control;

    if (type === 'BOOLEAN') {
      control = `<select id="${escHtml(id)}" data-product-attribute-code="${escHtml(code)}" data-product-attribute-type="BOOLEAN" class="input" ${required}>
        <option value="">Choose…</option><option value="true" ${String(value) === 'true' ? 'selected' : ''}>Yes</option><option value="false" ${String(value) === 'false' ? 'selected' : ''}>No</option>
      </select>`;
    } else if (type === 'SELECT') {
      control = `<input id="${escHtml(id)}" data-product-attribute-code="${escHtml(code)}" data-product-attribute-type="TEXT" type="text" list="${escHtml(id)}-options" value="${escHtml(value)}" class="input" ${required}>
        <datalist id="${escHtml(id)}-options">${options.map((option) => `<option value="${escHtml(option)}"></option>`).join('')}</datalist>`;
    } else {
      const isNumber = type === 'NUMBER' || type === 'RANGE';
      control = `<input id="${escHtml(id)}" data-product-attribute-code="${escHtml(code)}" data-product-attribute-type="${isNumber ? type : 'TEXT'}" type="${isNumber ? 'number' : 'text'}" value="${escHtml(value)}" class="input" ${required}>`;
    }

    return `<label class="block text-xs font-bold text-slate-700" for="${escHtml(id)}">${escHtml(name)}${definition.isRequired ? ' *' : ''}${control}</label>`;
  }).join('');
}

let productsCurrentPage = 1;
const productsPerPage = 10;
let currentFilteredProducts = [];
let activeProductStatusFilter = '';

function formatProductStatus(status) {
  const labels = {
    PUBLISHED: 'Published',
    DRAFT: 'Draft',
    ARCHIVED: 'Archived',
  };
  return labels[status] || status || 'Draft';
}

function formatMobileStockLabel(product) {
  if (!product.trackInventory) return 'Unlimited stock';
  const qty = Number(product.stockQuantity || 0);
  if (qty <= 0) return 'Out of stock';
  if (qty < 5) return `${qty} left`;
  return `${qty} in stock`;
}

function updateProductCountBadge(filteredCount) {
  const badge = document.getElementById('products-count-badge');
  if (!badge) return;
  const total = allProducts.length;
  if (!total) {
    badge.textContent = '';
    return;
  }
  badge.textContent = filteredCount === total
    ? `${total} item${total === 1 ? '' : 's'}`
    : `${filteredCount} of ${total}`;
}

async function loadProducts() {
  const r = await apiFetch('/items?limit=200&includeAll=true');
  const rawItems = r.ok ? (r.data?.data?.items || r.data?.data || []) : [];
  allProducts = Array.isArray(rawItems) ? rawItems : [];
  productsCurrentPage = 1;
  filterProducts();

  // Also load categories for the dropdown
  if (typeof loadCategoriesForDropdown === 'function') {
    await loadCategoriesForDropdown();
  }
}

function filterProductsByStatus(status) {
  activeProductStatusFilter = status || '';
  ['', 'PUBLISHED', 'DRAFT', 'LOW_STOCK', 'ARCHIVED'].forEach((key) => {
    const btn = document.getElementById(`product-filter-${key || 'ALL'}`);
    if (btn) btn.className = `text-xs ${activeProductStatusFilter === key ? 'btn-primary' : 'btn-secondary'}`;
  });
  filterProducts();
}
window.filterProductsByStatus = filterProductsByStatus;

function filterProducts() {
  const q = (document.getElementById('product-search')?.value || '').toLowerCase().trim();
  productsCurrentPage = 1;
  currentFilteredProducts = allProducts.filter((p) => {
    const matchesSearch = !q || (p.title || '').toLowerCase().includes(q) || (p.categoryName || '').toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (!activeProductStatusFilter) return true;
    if (activeProductStatusFilter === 'LOW_STOCK') {
      return Boolean(p.trackInventory) && Number(p.stockQuantity || 0) < 5;
    }
    return p.status === activeProductStatusFilter;
  });
  renderProductsTable(currentFilteredProducts);
}

function renderProductsTable(products) {
  currentFilteredProducts = products || [];
  updateProductCountBadge(currentFilteredProducts.length);
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;
  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-5 py-10 text-center text-slate-400">No products found.</td></tr>';
    renderPaginationControls({
      containerId: 'products-pagination',
      currentPage: 1,
      totalPages: 0,
      totalItems: 0,
      itemsPerPage: productsPerPage,
      onPageChange: 'setProductsPage'
    });
    return;
  }

  const totalPages = Math.ceil(products.length / productsPerPage);
  if (productsCurrentPage > totalPages) productsCurrentPage = totalPages;
  if (productsCurrentPage < 1) productsCurrentPage = 1;

  const startIdx = (productsCurrentPage - 1) * productsPerPage;
  const pageProducts = products.slice(startIdx, startIdx + productsPerPage);

  tbody.innerHTML = pageProducts.map(p => {
    const stockTone = !p.trackInventory
      ? 'is-ok'
      : p.stockQuantity <= 0
        ? 'is-out'
        : p.stockQuantity < 5
          ? 'is-low'
          : 'is-ok';
    const desktopStockClass = p.stockQuantity <= 0 ? 'text-red-600' : p.stockQuantity < 5 ? 'text-amber-600' : 'text-slate-700';
    const statusClass = p.status === 'PUBLISHED'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : p.status === 'DRAFT'
        ? 'bg-slate-50 text-slate-600 border-slate-200'
        : 'bg-red-50 text-red-600 border-red-200';
    return `
    <tr class="admin-product-row hover:bg-slate-50 transition-colors cursor-pointer" onclick="openEditProductModal(${inlineJs(p.id)})">
      <td data-label="Product" class="px-5 py-3">
        <div class="admin-product-identity flex items-center gap-3">
          ${p.images?.[0]
            ? `<img src="${escHtml(p.images[0])}" class="admin-product-thumb w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0" onerror="this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden')"><div class="admin-product-thumb-fallback hidden w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><i data-lucide="image" class="w-4 h-4 text-slate-400"></i></div>`
            : `<div class="admin-product-thumb-fallback w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><i data-lucide="image" class="w-4 h-4 text-slate-400"></i></div>`}
          <div class="min-w-0">
            <p class="admin-product-title font-normal text-slate-900 text-sm">${escHtml(p.title)}</p>
          </div>
        </div>
      </td>
      <td data-label="Category" class="px-5 py-3 text-xs text-slate-500 ${p.categoryName ? '' : 'admin-product-cat-empty'}">
        <span class="admin-product-cat-pill">${escHtml(p.categoryName || '—')}</span>
      </td>
      <td data-label="Price" class="px-5 py-3">
        <div class="admin-product-price-wrap">
          <p class="font-normal text-slate-900 text-sm">${fmt(p.basePrice)}</p>
          ${p.compareAtPrice ? `<p class="text-xs text-slate-400 line-through">${fmt(p.compareAtPrice)}</p>` : ''}
        </div>
      </td>
      <td data-label="Stock" class="px-5 py-3">
        <span class="admin-stock-desktop text-sm font-normal ${desktopStockClass}">${p.trackInventory ? p.stockQuantity : '∞'}</span>
        <span class="admin-stock-mobile ${stockTone}">${escHtml(formatMobileStockLabel(p))}</span>
      </td>
      <td data-label="Status" class="px-5 py-3">
        <span class="admin-product-status-pill text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusClass}">${escHtml(formatProductStatus(p.status))}</span>
      </td>
      <td data-label="Actions" class="px-5 py-3 text-right" onclick="event.stopPropagation()">
        <div class="admin-product-actions-wrap inline-flex items-center justify-end gap-1.5">
          <button type="button" onclick="openEditProductModal(${inlineJs(p.id)})" class="admin-product-action-edit text-xs font-normal text-slate-500 hover:text-emerald-600 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-all">
            <i data-lucide="pencil" class="w-3.5 h-3.5 md:hidden"></i>
            <span>Edit</span>
          </button>
          <button type="button" onclick="deleteProduct(${inlineJs(p.id)}, ${inlineJs(p.title)})" class="admin-product-action-delete text-xs font-normal text-slate-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-all" aria-label="Delete ${escHtml(p.title)}" title="Delete product">
            <i data-lucide="trash-2" class="w-3.5 h-3.5 md:hidden"></i>
            <span class="admin-action-label-desktop">Delete</span>
          </button>
        </div>
      </td>
    </tr>
  `;
  }).join('');

  renderPaginationControls({
    containerId: 'products-pagination',
    currentPage: productsCurrentPage,
    totalPages,
    totalItems: products.length,
    itemsPerPage: productsPerPage,
    onPageChange: 'setProductsPage'
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.setProductsPage = function(page) {
  productsCurrentPage = page;
  renderProductsTable(currentFilteredProducts);
  const tableEl = document.getElementById('products-table-body');
  if (tableEl) tableEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

function openAddProductModal() {
  productAttributeDraft = {};
  document.getElementById('product-modal-title').textContent = 'Add Product';
  document.getElementById('product-id').value = '';
  document.getElementById('product-title').value = '';
  document.getElementById('product-description').value = '';
  document.getElementById('product-price').value = '';
  document.getElementById('product-compare-price').value = '';
  document.getElementById('product-stock').value = '0';
  if (typeof setProductImages === 'function') {
    setProductImages([]);
  } else {
    const imgInput = document.getElementById('product-images');
    if (imgInput) imgInput.value = '';
    if (typeof updateProductImageCount === 'function') updateProductImageCount();
  }
  if (typeof renderVariantRows === 'function') renderVariantRows([]);
  document.getElementById('product-status').value = 'PUBLISHED';
  document.getElementById('product-type').value = 'PHYSICAL';
  document.getElementById('product-category').value = '';
  loadProductAttributeFields('');
  document.getElementById('product-modal-error').classList.add('hidden');
  document.getElementById('product-modal').classList.remove('hidden');
  lucide.createIcons();
}

async function openEditProductModal(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  document.getElementById('product-modal-title').textContent = 'Edit Product';
  document.getElementById('product-id').value = p.id;
  document.getElementById('product-title').value = p.title;
  document.getElementById('product-description').value = p.description || '';
  document.getElementById('product-price').value = p.basePrice;
  document.getElementById('product-compare-price').value = p.compareAtPrice || '';
  document.getElementById('product-stock').value = p.stockQuantity || 0;
  if (typeof setProductImages === 'function') {
    setProductImages(p.images || []);
  } else {
    const imgInput = document.getElementById('product-images');
    if (imgInput) imgInput.value = (p.images || []).join('\n');
    if (typeof updateProductImageCount === 'function') updateProductImageCount();
  }
  if (typeof renderVariantRows === 'function') renderVariantRows(p.variants || []);
  document.getElementById('product-status').value = p.status || 'PUBLISHED';
  document.getElementById('product-type').value = p.itemType || 'PHYSICAL';
  document.getElementById('product-category').value = p.categoryId || '';
  productAttributeDraft = { ...(p.attributes || {}) };
  await loadProductAttributeFields(p.categoryId || '', p.attributes || {});
  document.getElementById('product-modal-error').classList.add('hidden');
  document.getElementById('product-modal').classList.remove('hidden');
  lucide.createIcons();
}

async function handleSaveProduct(e) {
  e.preventDefault();
  const btn = document.getElementById('product-save-btn');
  const errEl = document.getElementById('product-modal-error');
  const id = document.getElementById('product-id').value;
  const images = typeof getProductImages === 'function'
    ? getProductImages()
    : (document.getElementById('product-images')?.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean) || []);
  if (images.length > 5) {
    errEl.textContent = 'A product can have at most 5 photos. Remove extra photos before saving.';
    errEl.classList.remove('hidden');
    if (typeof updateProductImageCount === 'function') updateProductImageCount();
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Saving...';
  errEl.classList.add('hidden');

  const body = {
    title: document.getElementById('product-title').value.trim(),
    description: document.getElementById('product-description').value.trim() || undefined,
    basePrice: parseInt(document.getElementById('product-price').value) || 0,
    compareAtPrice: parseInt(document.getElementById('product-compare-price').value) || undefined,
    stockQuantity: parseInt(document.getElementById('product-stock').value) || 0,
    images,
    status: document.getElementById('product-status').value,
    itemType: document.getElementById('product-type').value,
    categoryId: document.getElementById('product-category').value || undefined,
    attributes: collectProductAttributeFields(),
    trackInventory: true,
    variants: typeof collectProductVariants === 'function' ? collectProductVariants() : [],
  };

  const r = id
    ? await apiFetch(`/items/${id}`, { method: 'PUT', body: JSON.stringify(body) })
    : await apiFetch('/items', { method: 'POST', body: JSON.stringify(body) });

  btn.disabled = false;
  btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Save Product';
  lucide.createIcons();

  if (!r.ok) {
    errEl.textContent = apiErrorMessage(r, 'Failed to save product.');
    errEl.classList.remove('hidden');
    return;
  }

  closeModal('product-modal');
  showToast(id ? 'Product updated!' : 'Product added!');
  await loadProducts();
}

async function deleteProduct(id, title) {
  if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
  const r = await apiFetch(`/items/${id}`, { method: 'DELETE' });
  if (r.ok) {
    showToast('Product deleted.');
    allProducts = allProducts.filter(p => p.id !== id);
    currentFilteredProducts = currentFilteredProducts.filter(p => p.id !== id);
    const maxPage = Math.max(1, Math.ceil(currentFilteredProducts.length / productsPerPage));
    if (productsCurrentPage > maxPage) productsCurrentPage = maxPage;
    renderProductsTable(currentFilteredProducts);
  } else {
    showToast(apiErrorMessage(r, 'Failed to delete.'), false);
  }
}
