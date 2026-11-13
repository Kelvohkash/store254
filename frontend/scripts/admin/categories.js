// CATEGORIES
// ═══════════════════════════════════════

function flattenTree(tree, prefix = '', parent = null) {
  const out = [];
  for (const n of tree) {
    out.push({ ...n, parentId: parent?.id || null, parentName: parent?.name || null, displayName: prefix + n.name });
    if (n.children?.length) out.push(...flattenTree(n.children, `${prefix}　　`, n));
  }
  return out;
}

function topLevelCategoryOptions(categories) {
  return categories
    .filter(category => !category.parentId)
    .map(category => `<option value="${escHtml(category.id)}">${escHtml(category.name)}</option>`)
    .join('');
}

async function loadCategoriesForDropdown() {
  const r = await apiFetch('/categories');
  flatCategories = r.ok ? flattenTree(r.data?.data || []) : [];
  const catOpts = flatCategories.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.displayName)}</option>`).join('');
  const productCatEl = document.getElementById('product-category');
  if (productCatEl) productCatEl.innerHTML = '<option value="">No Category</option>' + catOpts;
  const parentCatEl = document.getElementById('category-parent');
  if (parentCatEl) parentCatEl.innerHTML = '<option value="">None (top-level)</option>' + topLevelCategoryOptions(flatCategories);
}

let categoriesCurrentPage = 1;
const categoriesPerPage = 10;
let attributeDefinitionsCache = [];

async function loadCategories() {
  const [catRes, attrRes] = await Promise.all([
    apiFetch('/categories'),
    apiFetch('/attributes')
  ]);
  flatCategories = catRes.ok ? flattenTree(catRes.data?.data || []) : [];
  attributeDefinitionsCache = attrRes.ok && Array.isArray(attrRes.data?.data) ? attrRes.data.data : [];
  categoriesCurrentPage = 1;
  renderCategoriesTable(flatCategories);
  // Reload parent dropdown
  const parentCatEl = document.getElementById('category-parent');
  if (parentCatEl) {
    parentCatEl.innerHTML = '<option value="">None (top-level)</option>' + topLevelCategoryOptions(flatCategories);
  }
  const attributeCategoryEl = document.getElementById('attribute-category');
  if (attributeCategoryEl) {
    attributeCategoryEl.innerHTML = '<option value="">All categories (Global filter)</option>' + flatCategories.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.displayName)}</option>`).join('');
  }
}

function syncAttributeCodeFromName() {
  const nameEl = document.getElementById('attribute-name');
  const codeEl = document.getElementById('attribute-code');
  if (!nameEl || !codeEl || codeEl.readOnly || codeEl.dataset.edited === 'true') return;
  codeEl.value = nameEl.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

async function loadAttributeDefinitions() {
  const response = await apiFetch('/attributes');
  attributeDefinitionsCache = response.ok && Array.isArray(response.data?.data) ? response.data.data : [];
  renderCategoriesTable(flatCategories);
}

async function deleteAttributeDefinition(id, name) {
  if (!confirm(`Delete product filter "${name}"? This cannot be undone.`)) return;
  const r = await apiFetch(`/attributes/${id}`, { method: 'DELETE' });
  if (r.ok) {
    showToast('Product filter deleted.');
    await loadAttributeDefinitions();
  } else {
    showToast(apiErrorMessage(r, 'Could not delete product filter.'), false);
  }
}
window.deleteAttributeDefinition = deleteAttributeDefinition;

function openAddAttributeModal(preselectedCategoryId = '') {
  cancelEditAttributeDefinition();
  document.getElementById('attribute-modal-title').textContent = preselectedCategoryId ? 'Add Category Filter' : 'Add Product Filter';
  const catEl = document.getElementById('attribute-category');
  if (catEl) catEl.value = preselectedCategoryId || '';
  document.getElementById('attribute-modal').classList.remove('hidden');
  lucide.createIcons();
  document.getElementById('attribute-name').focus();
}
window.openAddAttributeModal = openAddAttributeModal;

function editAttributeDefinition(id) {
  const definition = attributeDefinitionsCache.find((item) => item.id === id);
  if (!definition) return;
  document.getElementById('attribute-id').value = definition.id;
  document.getElementById('attribute-name').value = definition.name || '';
  const code = document.getElementById('attribute-code');
  code.value = definition.code || '';
  code.readOnly = true;
  document.getElementById('attribute-category').value = definition.categoryId || '';
  document.getElementById('attribute-type').value = definition.type || 'TEXT';
  document.getElementById('attribute-options').value = Array.isArray(definition.options) ? definition.options.join(', ') : '';
  document.getElementById('attribute-unit').value = definition.unit || '';
  document.getElementById('attribute-filterable').checked = Boolean(definition.isFilterable);
  document.getElementById('attribute-required').checked = Boolean(definition.isRequired);
  document.getElementById('attribute-modal-title').textContent = 'Edit Product Filter';
  document.getElementById('attribute-save-btn').textContent = 'Save Changes';
  document.getElementById('attribute-cancel-edit-btn').classList.remove('hidden');
  document.getElementById('attribute-form-error').classList.add('hidden');
  document.getElementById('attribute-modal').classList.remove('hidden');
  lucide.createIcons();
  document.getElementById('attribute-name').focus();
}

function cancelEditAttributeDefinition() {
  document.getElementById('attribute-id').value = '';
  document.getElementById('attribute-name').value = '';
  const code = document.getElementById('attribute-code');
  code.value = '';
  code.readOnly = false;
  code.dataset.edited = 'false';
  document.getElementById('attribute-category').value = '';
  document.getElementById('attribute-type').value = 'SELECT';
  document.getElementById('attribute-options').value = '';
  document.getElementById('attribute-unit').value = '';
  document.getElementById('attribute-filterable').checked = true;
  document.getElementById('attribute-required').checked = false;
  document.getElementById('attribute-save-btn').textContent = 'Add Product Field';
  document.getElementById('attribute-cancel-edit-btn').classList.add('hidden');
  document.getElementById('attribute-form-error').classList.add('hidden');
}

async function handleSaveAttributeDefinition(event) {
  event.preventDefault();
  const error = document.getElementById('attribute-form-error');
  const button = document.getElementById('attribute-save-btn');
  const id = document.getElementById('attribute-id').value;
  error.classList.add('hidden');
  button.disabled = true;
  const type = document.getElementById('attribute-type').value;
  const body = {
    categoryId: document.getElementById('attribute-category').value || null,
    name: document.getElementById('attribute-name').value.trim(),
    code: document.getElementById('attribute-code').value.trim(),
    type,
    options: type === 'SELECT' ? document.getElementById('attribute-options').value.split(',').map(value => value.trim()).filter(Boolean) : [],
    unit: document.getElementById('attribute-unit').value.trim() || undefined,
    isFilterable: document.getElementById('attribute-filterable').checked,
    isRequired: document.getElementById('attribute-required').checked,
  };
  const response = await apiFetch(id ? `/attributes/${id}` : '/attributes', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
  button.disabled = false;
  if (!response.ok) {
    error.textContent = apiErrorMessage(response, 'Could not add this product field. Check whether its key already exists for this category.');
    error.classList.remove('hidden');
    return;
  }
  cancelEditAttributeDefinition();
  closeModal('attribute-modal');
  showToast(id ? 'Product field updated.' : 'Product field added.');
  await loadAttributeDefinitions();
}

let expandedAdminCategories = new Set();
let categoriesViewMode = 'all';

function setCategoriesViewMode(mode) {
  categoriesViewMode = mode || 'all';
  categoriesCurrentPage = 1;
  ['all', 'categories', 'filters'].forEach((key) => {
    const btn = document.getElementById(`cat-view-${key}`);
    if (btn) btn.className = `text-xs ${categoriesViewMode === key ? 'btn-primary' : 'btn-secondary'}`;
  });
  renderCategoriesTable(flatCategories);
}
window.setCategoriesViewMode = setCategoriesViewMode;

function formatAttributeTypeLabel(type) {
  const labels = {
    SELECT: 'Choice list',
    MULTISELECT: 'Multi-select',
    TEXT: 'Text',
    NUMBER: 'Number',
    BOOLEAN: 'Yes / No',
    RANGE: 'Range',
  };
  return labels[type] || type || 'Text';
}

function updateCategoriesCountBadge(mainCatCount, filterCount) {
  const badge = document.getElementById('categories-count-badge');
  if (!badge) return;
  if (categoriesViewMode === 'filters') {
    badge.textContent = filterCount ? `${filterCount} filter${filterCount === 1 ? '' : 's'}` : '';
  } else if (categoriesViewMode === 'categories') {
    badge.textContent = mainCatCount ? `${mainCatCount} categor${mainCatCount === 1 ? 'y' : 'ies'}` : '';
  } else {
    const parts = [];
    if (mainCatCount) parts.push(`${mainCatCount} cat${mainCatCount === 1 ? '' : 's'}`);
    if (filterCount) parts.push(`${filterCount} filter${filterCount === 1 ? '' : 's'}`);
    badge.textContent = parts.join(' · ');
  }
}

function renderFilterRowHtml(f, { parentId = '', parentLabel = 'All categories', isSubfilter = false, isVisible = true, isFlatList = false } = {}) {
  const borderClass = isFlatList
    ? ''
    : isSubfilter
      ? 'pl-7 border-l-2 border-purple-400'
      : f.categoryId
        ? 'pl-4 border-l-2 border-purple-500'
        : 'pl-4 border-l-2 border-emerald-500';
  const iconTone = f.categoryId
    ? 'bg-purple-50 text-purple-700 border-purple-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  const typeLabel = formatAttributeTypeLabel(f.type || 'TEXT');
  const optionsText = Array.isArray(f.options) && f.options.length ? f.options.join(', ') : '';

  return `
    <tr class="admin-cat-row admin-cat-filter ${isSubfilter ? 'admin-cat-subfilter' : ''} ${isFlatList ? 'admin-cat-filter-flat' : ''} ${isVisible ? 'is-visible' : 'is-collapsed'}" data-parent-id="${escHtml(parentId)}">
      <td data-label="Category" class="px-5 py-2.5 font-normal text-slate-800 text-sm">
        <div class="admin-cat-filter-main flex items-center gap-2 ${borderClass}">
          ${isSubfilter && !isFlatList ? '<span class="text-purple-500 font-bold shrink-0">↳</span>' : ''}
          <span class="w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${iconTone}">
            <i data-lucide="sliders-horizontal" class="w-3 h-3"></i>
          </span>
          <div class="admin-cat-filter-copy min-w-0">
            <div class="admin-cat-filter-title-row flex items-center gap-1.5 flex-wrap">
              <span class="font-bold text-slate-800 text-sm">${escHtml(f.name)}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${f.isFilterable ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}">
                ${f.isFilterable ? 'Filter' : 'Spec'}
              </span>
              <span class="admin-cat-type-chip text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">${escHtml(typeLabel)}</span>
              ${f.unit ? `<span class="text-[11px] text-slate-500 font-medium">(${escHtml(f.unit)})</span>` : ''}
            </div>
            ${optionsText ? `<p class="admin-cat-filter-options text-[11px] text-slate-500 mt-0.5" title="${escHtml(optionsText)}">${escHtml(optionsText)}</p>` : ''}
          </div>
        </div>
      </td>
      <td data-label="Slug" class="px-5 py-2.5 text-xs text-slate-500 font-mono">${escHtml(typeLabel)}</td>
      <td data-label="Parent" class="px-5 py-2.5 text-xs text-slate-500">${escHtml(parentLabel)}</td>
      <td data-label="Actions" class="px-5 py-2.5 text-right" onclick="event.stopPropagation()">
        <div class="admin-cat-actions-wrap inline-flex items-center justify-end gap-1.5">
          <button type="button" onclick="editAttributeDefinition(${inlineJs(f.id)})" class="admin-cat-action-edit text-xs font-bold text-slate-500 hover:text-emerald-600 px-2 py-1 rounded-lg transition-all">
            <i data-lucide="pencil" class="w-3.5 h-3.5 md:hidden"></i>
            <span>Edit</span>
          </button>
          <button type="button" onclick="deleteAttributeDefinition(${inlineJs(f.id)}, ${inlineJs(f.name)})" class="admin-cat-action-delete text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-all" aria-label="Delete ${escHtml(f.name)}" title="Delete filter">
            <i data-lucide="trash-2" class="w-3.5 h-3.5 md:hidden"></i>
            <span class="admin-action-label-desktop">Delete</span>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function toggleAdminCategory(catId) {
  if (expandedAdminCategories.has(catId)) {
    expandedAdminCategories.delete(catId);
  } else {
    expandedAdminCategories.add(catId);
  }
  renderCategoriesTable(flatCategories);
}

function renderCategoriesTable(cats) {
  const tbody = document.getElementById('categories-table-body');
  if (!tbody) return;
  const allCats = cats || [];
  const mainCats = allCats.filter(c => !c.parentId);
  const allFilters = attributeDefinitionsCache || [];
  const globalFilters = allFilters.filter(f => !f.categoryId);

  updateCategoriesCountBadge(mainCats.length, allFilters.length);

  if (categoriesViewMode === 'filters') {
    if (!allFilters.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="px-5 py-10 text-center text-slate-400">No product filters configured yet.</td></tr>';
      renderPaginationControls({
        containerId: 'categories-pagination',
        currentPage: 1,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: categoriesPerPage,
        onPageChange: 'setCategoriesPage'
      });
      return;
    }

    const totalPages = Math.max(1, Math.ceil(allFilters.length / categoriesPerPage));
    if (categoriesCurrentPage > totalPages) categoriesCurrentPage = totalPages;
    if (categoriesCurrentPage < 1) categoriesCurrentPage = 1;

    const startIdx = (categoriesCurrentPage - 1) * categoriesPerPage;
    const pageFilters = allFilters.slice(startIdx, startIdx + categoriesPerPage);

    tbody.innerHTML = pageFilters.map((f) => {
      const cat = f.categoryId ? allCats.find(c => c.id === f.categoryId) : null;
      return renderFilterRowHtml(f, {
        parentId: f.categoryId || '__global__',
        parentLabel: cat ? cat.name : 'All categories',
        isSubfilter: Boolean(cat?.parentId),
        isVisible: true,
        isFlatList: true,
      });
    }).join('');

    renderPaginationControls({
      containerId: 'categories-pagination',
      currentPage: categoriesCurrentPage,
      totalPages,
      totalItems: allFilters.length,
      itemsPerPage: categoriesPerPage,
      onPageChange: 'setCategoriesPage'
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const showFiltersInTree = categoriesViewMode !== 'categories';

  if (!mainCats.length && (!showFiltersInTree || !globalFilters.length)) {
    tbody.innerHTML = '<tr><td colspan="4" class="px-5 py-10 text-center text-slate-400">No categories configured yet.</td></tr>';
    renderPaginationControls({
      containerId: 'categories-pagination',
      currentPage: 1,
      totalPages: 0,
      totalItems: 0,
      itemsPerPage: categoriesPerPage,
      onPageChange: 'setCategoriesPage'
    });
    return;
  }

  const totalPages = Math.max(1, Math.ceil(mainCats.length / categoriesPerPage));
  if (categoriesCurrentPage > totalPages) categoriesCurrentPage = totalPages;
  if (categoriesCurrentPage < 1) categoriesCurrentPage = 1;

  const startIdx = (categoriesCurrentPage - 1) * categoriesPerPage;
  const pageMainCats = mainCats.slice(startIdx, startIdx + categoriesPerPage);

  let rowsHtml = '';

  // Render Global Filters section at top of Page 1
  if (showFiltersInTree && categoriesCurrentPage === 1 && (globalFilters.length > 0 || mainCats.length > 0)) {
    const isGlobalExpanded = expandedAdminCategories.has('__global__');
    rowsHtml += `
      <tr class="admin-cat-row admin-cat-main admin-cat-global hover:bg-slate-50 transition-colors cursor-pointer" onclick="toggleAdminCategory('__global__')">
        <td data-label="Category" class="px-5 py-3 font-bold text-slate-900 text-sm">
          <div class="flex items-center justify-between w-full gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <i data-lucide="globe" class="w-3.5 h-3.5"></i>
              </span>
              <div class="min-w-0">
                <span class="font-bold text-slate-900 text-sm block truncate">Global Filters</span>
                <span class="admin-cat-mobile-slug">Applies to all categories</span>
              </div>
            </div>
            ${globalFilters.length > 0 ? `
              <button type="button" onclick="event.stopPropagation(); toggleAdminCategory('__global__')" class="admin-cat-toggle-btn text-[11px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 shrink-0 ${isGlobalExpanded ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-700 border-slate-200'}">
                <span>${globalFilters.length} filter${globalFilters.length === 1 ? '' : 's'}</span>
                <i data-lucide="${isGlobalExpanded ? 'chevron-up' : 'chevron-down'}" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
          </div>
        </td>
        <td data-label="Slug" class="px-5 py-3 text-xs text-slate-400 font-mono">global</td>
        <td data-label="Parent" class="px-5 py-3 text-xs text-slate-500 admin-cat-parent-empty">Universal</td>
        <td data-label="Actions" class="px-5 py-3 text-right" onclick="event.stopPropagation()">
          <div class="admin-cat-actions-wrap inline-flex items-center justify-end gap-1.5">
            <button type="button" onclick="openAddAttributeModal('')" class="admin-cat-action-filter text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition-all">+ Add Filter</button>
          </div>
        </td>
      </tr>
    `;

    // Global filter items
    rowsHtml += globalFilters.map(f => renderFilterRowHtml(f, {
      parentId: '__global__',
      parentLabel: 'All categories',
      isSubfilter: false,
      isVisible: isGlobalExpanded,
    })).join('');
  }

  // Render each Main Category and its tied filters & subcategories
  for (const c of pageMainCats) {
    const children = allCats.filter(x => x.parentId === c.id);
    const categoryFilters = showFiltersInTree ? allFilters.filter(f => f.categoryId === c.id) : [];
    const isExpanded = expandedAdminCategories.has(c.id);

    const parts = [];
    if (children.length) parts.push(`${children.length} sub`);
    if (categoryFilters.length) parts.push(`${categoryFilters.length} filter${categoryFilters.length === 1 ? '' : 's'}`);
    const summaryText = parts.join(' · ');

    const resolvedCatIcon = window.Store254CategoryClassifier
      ? window.Store254CategoryClassifier.resolveIcon(c, { businessType: tenantInfo?.businessType, storeName: tenantInfo?.name })
      : (c.icon || 'tag');

    rowsHtml += `
      <tr class="admin-cat-row admin-cat-main hover:bg-slate-50 transition-colors cursor-pointer" onclick="toggleAdminCategory(${inlineJs(c.id)})">
        <td data-label="Category" class="px-5 py-3 font-bold text-slate-900 text-sm">
          <div class="flex items-center justify-between w-full gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                <i data-lucide="${escHtml(resolvedCatIcon)}" class="w-3.5 h-3.5"></i>
              </span>
              <div class="min-w-0">
                <span class="font-bold text-slate-900 text-sm block truncate">${escHtml(c.name)}</span>
                ${c.slug ? `<span class="admin-cat-mobile-slug">/${escHtml(c.slug)}</span>` : ''}
              </div>
            </div>
            ${parts.length > 0 ? `
              <button type="button" onclick="event.stopPropagation(); toggleAdminCategory(${inlineJs(c.id)})" class="admin-cat-toggle-btn text-[11px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 shrink-0 ${isExpanded ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-700 border-slate-200'}">
                <span>${summaryText}</span>
                <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
          </div>
        </td>
        <td data-label="Slug" class="px-5 py-3 text-xs text-slate-400 font-mono">${escHtml(c.slug || '')}</td>
        <td data-label="Parent" class="px-5 py-3 text-xs text-slate-500 admin-cat-parent-empty">—</td>
        <td data-label="Actions" class="px-5 py-3 text-right" onclick="event.stopPropagation()">
          <div class="admin-cat-actions-wrap inline-flex items-center justify-end gap-1.5">
            <button type="button" onclick="openAddAttributeModal(${inlineJs(c.id)})" class="admin-cat-action-filter text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition-all" title="Add Filter to ${escHtml(c.name)}">+ Filter</button>
            <button type="button" onclick="openEditCategoryModal(${inlineJs(c.id)})" class="admin-cat-action-edit text-xs font-bold text-slate-500 hover:text-emerald-600 px-2 py-1 rounded-lg transition-all">
              <i data-lucide="pencil" class="w-3.5 h-3.5 md:hidden"></i>
              <span>Edit</span>
            </button>
            <button type="button" onclick="deleteCategory(${inlineJs(c.id)}, ${inlineJs(c.name)})" class="admin-cat-action-delete text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-all" aria-label="Delete ${escHtml(c.name)}" title="Delete category">
              <i data-lucide="trash-2" class="w-3.5 h-3.5 md:hidden"></i>
              <span class="admin-action-label-desktop">Delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;

    // 1. Render Subcategories under this main category
    for (const sub of children) {
      const subFilters = showFiltersInTree ? allFilters.filter(f => f.categoryId === sub.id) : [];
      const resolvedSubIcon = window.Store254CategoryClassifier
        ? window.Store254CategoryClassifier.resolveIcon(sub, { parentName: c.name, businessType: tenantInfo?.businessType, storeName: tenantInfo?.name })
        : (sub.icon || 'tag');
      rowsHtml += `
        <tr class="admin-cat-row admin-cat-sub hover:bg-slate-50 transition-colors ${isExpanded ? 'is-visible' : 'is-collapsed'}" data-parent-id="${escHtml(sub.parentId)}">
          <td data-label="Category" class="px-5 py-3 font-bold text-slate-900 text-sm">
            <div class="flex items-center justify-between w-full gap-2 pl-3 border-l-2 border-emerald-500">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-emerald-600 font-bold shrink-0">↳</span>
                <span class="w-6 h-6 rounded-md bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0">
                  <i data-lucide="${escHtml(resolvedSubIcon)}" class="w-3 h-3"></i>
                </span>
                <div class="min-w-0">
                  <span class="font-bold text-slate-800 text-sm block truncate">${escHtml(sub.name)}</span>
                  ${sub.slug ? `<span class="admin-cat-mobile-slug">/${escHtml(sub.slug)}</span>` : ''}
                </div>
              </div>
              ${subFilters.length > 0 ? `
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                  ${subFilters.length} filter${subFilters.length === 1 ? '' : 's'}
                </span>
              ` : ''}
            </div>
          </td>
          <td data-label="Slug" class="px-5 py-3 text-xs text-slate-400 font-mono">${escHtml(sub.slug || '')}</td>
          <td data-label="Parent" class="px-5 py-3 text-xs text-slate-500">${escHtml(sub.parentName || c.name)}</td>
          <td data-label="Actions" class="px-5 py-3 text-right" onclick="event.stopPropagation()">
            <div class="admin-cat-actions-wrap inline-flex items-center justify-end gap-1.5">
              <button type="button" onclick="openAddAttributeModal(${inlineJs(sub.id)})" class="admin-cat-action-filter admin-cat-action-filter-sub text-xs font-bold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-1 rounded-lg transition-all" title="Add Filter to ${escHtml(sub.name)}">+ Filter</button>
              <button type="button" onclick="openEditCategoryModal(${inlineJs(sub.id)})" class="admin-cat-action-edit text-xs font-bold text-slate-500 hover:text-emerald-600 px-2 py-1 rounded-lg transition-all">
                <i data-lucide="pencil" class="w-3.5 h-3.5 md:hidden"></i>
                <span>Edit</span>
              </button>
              <button type="button" onclick="deleteCategory(${inlineJs(sub.id)}, ${inlineJs(sub.name)})" class="admin-cat-action-delete text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-all" aria-label="Delete ${escHtml(sub.name)}" title="Delete subcategory">
                <i data-lucide="trash-2" class="w-3.5 h-3.5 md:hidden"></i>
                <span class="admin-action-label-desktop">Delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;

      // Render filters tied directly to this subcategory
      for (const sf of subFilters) {
        rowsHtml += renderFilterRowHtml(sf, {
          parentId: sub.id,
          parentLabel: sub.name,
          isSubfilter: true,
          isVisible: isExpanded,
        });
      }
    }

    // 2. Render Filters tied directly to this main category
    for (const f of categoryFilters) {
      rowsHtml += renderFilterRowHtml(f, {
        parentId: c.id,
        parentLabel: c.name,
        isSubfilter: false,
        isVisible: isExpanded,
      });
    }
  }

  tbody.innerHTML = rowsHtml;

  renderPaginationControls({
    containerId: 'categories-pagination',
    currentPage: categoriesCurrentPage,
    totalPages,
    totalItems: mainCats.length,
    itemsPerPage: categoriesPerPage,
    onPageChange: 'setCategoriesPage'
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.setCategoriesPage = function(page) {
  categoriesCurrentPage = page;
  renderCategoriesTable(flatCategories);
  const tableEl = document.getElementById('categories-table-body');
  if (tableEl) tableEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

function getCategoryClassifierContext() {
  const name = document.getElementById('category-name')?.value?.trim() || '';
  const description = document.getElementById('category-desc')?.value?.trim() || '';
  const parentId = document.getElementById('category-parent')?.value || '';
  const parentCat = parentId ? flatCategories.find(c => c.id === parentId) : null;
  return {
    name,
    description,
    parentName: parentCat?.name || '',
    businessType: typeof tenantInfo !== 'undefined' ? tenantInfo?.businessType : '',
    storeName: typeof tenantInfo !== 'undefined' ? tenantInfo?.name : '',
  };
}

function updateCategoryIconPreviewUi(iconName, mode, domainLabel) {
  const iconInput = document.getElementById('category-icon');
  const modeInput = document.getElementById('category-icon-mode');
  const preview = document.getElementById('category-icon-preview');
  const badge = document.getElementById('category-icon-badge');
  const domainEl = document.getElementById('category-icon-domain');
  const resetBtn = document.getElementById('category-icon-reset');
  if (!iconInput || !preview) return;

  iconInput.value = iconName;
  if (modeInput) modeInput.value = mode;
  preview.innerHTML = `<i data-lucide="${escHtml(iconName)}" class="w-4 h-4"></i>`;

  if (badge) {
    if (mode === 'manual') {
      badge.textContent = 'Custom';
      badge.className = 'text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800';
    } else {
      badge.textContent = 'Auto';
      badge.className = 'text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
    }
  }
  if (domainEl) domainEl.textContent = domainLabel || iconName;
  if (resetBtn) resetBtn.classList.toggle('hidden', mode !== 'manual');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function handleCategoryClassifierInput() {
  const mode = document.getElementById('category-icon-mode')?.value || 'auto';
  if (mode === 'manual') return;
  if (!window.Store254CategoryClassifier) return;
  const result = window.Store254CategoryClassifier.classify(getCategoryClassifierContext());
  updateCategoryIconPreviewUi(result.icon, 'auto', `${result.domain} (${result.icon})`);
  renderCategoryIconPicker(document.getElementById('category-icon-search')?.value || '');
}

function selectManualCategoryIcon(iconName) {
  updateCategoryIconPreviewUi(iconName, 'manual', `Custom icon (${iconName})`);
  renderCategoryIconPicker(document.getElementById('category-icon-search')?.value || '');
}

function resetCategoryIconToAuto() {
  const modeInput = document.getElementById('category-icon-mode');
  if (modeInput) modeInput.value = 'auto';
  handleCategoryClassifierInput();
}

function renderCategoryIconPicker(filterText = '') {
  const grid = document.getElementById('category-icon-picker-grid');
  if (!grid || !window.Store254CategoryClassifier) return;
  const q = String(filterText || '').trim().toLowerCase();
  const activeIcon = document.getElementById('category-icon')?.value || 'package';
  const list = window.Store254CategoryClassifier.CURATED_ICON_CATALOG.filter(entry =>
    !q || entry.icon.includes(q) || entry.label.toLowerCase().includes(q)
  );
  grid.innerHTML = list.map(entry => {
    const selected = entry.icon === activeIcon;
    return `
      <button type="button" onclick="selectManualCategoryIcon('${escHtml(entry.icon)}')" title="${escHtml(entry.label)} (${escHtml(entry.icon)})" class="w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${selected ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400 hover:text-emerald-700'}">
        <i data-lucide="${escHtml(entry.icon)}" class="w-4 h-4"></i>
      </button>
    `;
  }).join('') || '<div class="col-span-8 text-center text-[11px] text-slate-400 py-3">No matching icons</div>';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openAddCategoryModal() {
  document.getElementById('category-modal-title').textContent = 'New Category';
  document.getElementById('category-save-btn').innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Create Category';
  document.getElementById('category-id').value = '';
  document.getElementById('category-name').value = '';
  document.getElementById('category-desc').value = '';
  document.getElementById('category-parent').value = '';
  const searchEl = document.getElementById('category-icon-search');
  if (searchEl) searchEl.value = '';
  document.getElementById('category-icon-mode').value = 'auto';
  document.getElementById('category-modal-error').classList.add('hidden');
  document.getElementById('category-modal').classList.remove('hidden');
  handleCategoryClassifierInput();
  lucide.createIcons();
}

function openEditCategoryModal(id) {
  const category = flatCategories.find(c => c.id === id);
  if (!category) return;
  const excludedIds = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of flatCategories) {
      if (candidate.parentId && excludedIds.has(candidate.parentId) && !excludedIds.has(candidate.id)) {
        excludedIds.add(candidate.id);
        changed = true;
      }
    }
  }
  const parentSelect = document.getElementById('category-parent');
  const hasChildren = flatCategories.some(candidate => candidate.parentId === id);
  parentSelect.innerHTML = '<option value="">None (top-level)</option>' + (hasChildren ? '' : topLevelCategoryOptions(flatCategories
    .filter(c => !excludedIds.has(c.id))));
  document.getElementById('category-modal-title').textContent = 'Edit Category';
  document.getElementById('category-save-btn').innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Save Changes';
  document.getElementById('category-id').value = category.id;
  document.getElementById('category-name').value = category.name;
  document.getElementById('category-desc').value = category.description || '';
  parentSelect.value = category.parentId || '';
  const searchEl = document.getElementById('category-icon-search');
  if (searchEl) searchEl.value = '';
  document.getElementById('category-modal-error').classList.add('hidden');
  document.getElementById('category-modal').classList.remove('hidden');

  if (window.Store254CategoryClassifier) {
    const classified = window.Store254CategoryClassifier.classify(getCategoryClassifierContext());
    if (category.icon && category.icon !== classified.icon) {
      updateCategoryIconPreviewUi(category.icon, 'manual', `Custom icon (${category.icon})`);
    } else {
      updateCategoryIconPreviewUi(classified.icon, 'auto', `${classified.domain} (${classified.icon})`);
    }
    renderCategoryIconPicker('');
  }
  lucide.createIcons();
}

async function handleSaveCategory(e) {
  e.preventDefault();
  const errEl = document.getElementById('category-modal-error');
  errEl.classList.add('hidden');
  const iconVal = document.getElementById('category-icon')?.value?.trim() || undefined;
  const body = {
    name: document.getElementById('category-name').value.trim(),
    description: document.getElementById('category-desc').value.trim() || undefined,
    parentId: document.getElementById('category-parent').value || undefined,
    icon: iconVal,
  };
  const id = document.getElementById('category-id').value;
  const r = await apiFetch(id ? `/categories/${id}` : '/categories', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
  if (!r.ok) {
    errEl.textContent = apiErrorMessage(r, 'Failed to create category.');
    errEl.classList.remove('hidden');
    return;
  }
  closeModal('category-modal');
  showToast(id ? 'Category updated!' : 'Category created!');
  await loadCategories();
  await loadCategoriesForDropdown();
}

async function deleteCategory(id, name) {
  if (!confirm(`Delete category "${name}"?`)) return;
  const r = await apiFetch(`/categories/${id}`, { method: 'DELETE' });
  if (r.ok) {
    showToast('Category deleted.');
    loadCategories();
  } else {
    showToast(apiErrorMessage(r, 'Cannot delete.'), false);
  }
}
