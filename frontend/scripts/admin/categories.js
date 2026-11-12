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

async function loadCategories() {
  const r = await apiFetch('/categories');
  flatCategories = r.ok ? flattenTree(r.data?.data || []) : [];
  categoriesCurrentPage = 1;
  renderCategoriesTable(flatCategories);
  // Reload parent dropdown
  const parentCatEl = document.getElementById('category-parent');
  if (parentCatEl) {
    parentCatEl.innerHTML = '<option value="">None (top-level)</option>' + topLevelCategoryOptions(flatCategories);
  }
  const attributeCategoryEl = document.getElementById('attribute-category');
  if (attributeCategoryEl) {
    attributeCategoryEl.innerHTML = '<option value="">All categories</option>' + flatCategories.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.displayName)}</option>`).join('');
  }
  await loadAttributeDefinitions();
}

let attributeDefinitionsCache = [];

function syncAttributeCodeFromName() {
  const nameEl = document.getElementById('attribute-name');
  const codeEl = document.getElementById('attribute-code');
  if (!nameEl || !codeEl || codeEl.readOnly || codeEl.dataset.edited === 'true') return;
  codeEl.value = nameEl.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

async function loadAttributeDefinitions() {
  const container = document.getElementById('attribute-definitions-list');
  if (!container) return;
  const response = await apiFetch('/attributes');
  if (!response.ok) {
    container.innerHTML = '<p class="py-3 text-xs text-slate-500">Could not load product fields.</p>';
    return;
  }
  const definitions = Array.isArray(response.data?.data) ? response.data.data : [];
  attributeDefinitionsCache = definitions;
  if (!definitions.length) {
    container.innerHTML = '<p class="py-3 text-xs text-slate-500">No product fields configured yet.</p>';
    return;
  }
  container.innerHTML = definitions.map((definition) => {
    const categoryName = flatCategories.find((category) => category.id === definition.categoryId)?.name;
    const options = Array.isArray(definition.options) ? definition.options : [];
    return `<div class="py-3 flex items-start justify-between gap-3">
      <div class="min-w-0"><p class="font-bold text-slate-800">${escHtml(definition.name)} <span class="font-mono text-[10px] text-slate-400">${escHtml(definition.code)}</span></p>
      <p class="mt-0.5 text-[11px] text-slate-500">${categoryName ? escHtml(categoryName) : 'All categories'}${definition.unit ? ` · ${escHtml(definition.unit)}` : ''}${options.length ? ` · ${options.map(escHtml).join(', ')}` : ''}</p></div>
      <div class="shrink-0 flex items-center gap-2"><span class="rounded-full px-2 py-1 text-[10px] font-bold ${definition.isFilterable ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${definition.isFilterable ? 'Filter' : 'Product detail'}</span>
      <button type="button" onclick="editAttributeDefinition(${inlineJs(definition.id)})" class="text-xs font-bold text-emerald-700 hover:text-emerald-900">Edit</button></div>
    </div>`;
  }).join('');
}

function openAddAttributeModal() {
  cancelEditAttributeDefinition();
  document.getElementById('attribute-modal-title').textContent = 'Add Product Filter';
  document.getElementById('attribute-modal').classList.remove('hidden');
  lucide.createIcons();
  document.getElementById('attribute-name').focus();
}

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
  const mainCats = (cats || []).filter(c => !c.parentId);
  if (!mainCats.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="px-5 py-10 text-center text-slate-400">No categories yet.</td></tr>';
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

  const totalPages = Math.ceil(mainCats.length / categoriesPerPage);
  if (categoriesCurrentPage > totalPages) categoriesCurrentPage = totalPages;
  if (categoriesCurrentPage < 1) categoriesCurrentPage = 1;

  const startIdx = (categoriesCurrentPage - 1) * categoriesPerPage;
  const pageMainCats = mainCats.slice(startIdx, startIdx + categoriesPerPage);
  const pageMainCatIds = new Set(pageMainCats.map(c => c.id));

  // Keep main categories on this page and their subcategories
  const pageCats = (cats || []).filter(c => (!c.parentId && pageMainCatIds.has(c.id)) || (c.parentId && pageMainCatIds.has(c.parentId)));

  tbody.innerHTML = pageCats.map(c => {
    const isMain = !c.parentId;
    const children = isMain ? (cats || []).filter(x => x.parentId === c.id) : [];
    const isExpanded = expandedAdminCategories.has(c.id);
    const isParentExpanded = c.parentId ? expandedAdminCategories.has(c.parentId) : false;

    if (isMain) {
      return `
        <tr class="admin-cat-row admin-cat-main hover:bg-slate-50 transition-colors cursor-pointer" onclick="toggleAdminCategory(${inlineJs(c.id)})">
          <td data-label="Category" class="px-5 py-3 font-bold text-slate-900 text-sm">
            <div class="flex items-center justify-between w-full gap-2">
              <span class="font-bold text-slate-900 text-sm">${escHtml(c.name)}</span>
              ${children.length > 0 ? `
                <button type="button" onclick="event.stopPropagation(); toggleAdminCategory(${inlineJs(c.id)})" class="admin-cat-toggle-btn text-[11px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 ${isExpanded ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-700 border-slate-200'}">
                  <span>${children.length} subcategor${children.length === 1 ? 'y' : 'ies'}</span>
                  <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-3.5 h-3.5"></i>
                </button>
              ` : ''}
            </div>
          </td>
          <td data-label="Slug" class="px-5 py-3 text-xs text-slate-400 font-mono">${escHtml(c.slug || '')}</td>
          <td data-label="Parent" class="px-5 py-3 text-xs text-slate-500">—</td>
          <td data-label="Actions" class="px-5 py-3 text-right" onclick="event.stopPropagation()">
            <button onclick="openEditCategoryModal(${inlineJs(c.id)})" class="text-xs font-bold text-slate-500 hover:text-emerald-600 px-2 py-1 rounded-lg transition-all">Edit</button>
            <button onclick="deleteCategory(${inlineJs(c.id)}, ${inlineJs(c.name)})" class="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-all">Delete</button>
          </td>
        </tr>
      `;
    }

    // Subcategory row
    return `
      <tr class="admin-cat-row admin-cat-sub hover:bg-slate-50 transition-colors ${isParentExpanded ? 'is-visible' : 'is-collapsed'}" data-parent-id="${escHtml(c.parentId)}">
        <td data-label="Category" class="px-5 py-3 font-bold text-slate-900 text-sm">
          <div class="flex items-center gap-2 pl-3 border-l-2 border-emerald-500">
            <span class="text-emerald-600 font-bold">↳</span>
            <span class="font-bold text-slate-800 text-sm">${escHtml(c.name)}</span>
            <span class="text-[10px] text-slate-400 font-semibold">(${escHtml(c.parentName || 'Subcategory')})</span>
          </div>
        </td>
        <td data-label="Slug" class="px-5 py-3 text-xs text-slate-400 font-mono">${escHtml(c.slug || '')}</td>
        <td data-label="Parent" class="px-5 py-3 text-xs text-slate-500">${escHtml(c.parentName || '—')}</td>
        <td data-label="Actions" class="px-5 py-3 text-right">
          <button onclick="openEditCategoryModal(${inlineJs(c.id)})" class="text-xs font-bold text-slate-500 hover:text-emerald-600 px-2 py-1 rounded-lg transition-all">Edit</button>
          <button onclick="deleteCategory(${inlineJs(c.id)}, ${inlineJs(c.name)})" class="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-all">Delete</button>
        </td>
      </tr>
    `;
  }).join('');

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

function openAddCategoryModal() {
  document.getElementById('category-modal-title').textContent = 'New Category';
  document.getElementById('category-save-btn').innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Create Category';
  document.getElementById('category-id').value = '';
  document.getElementById('category-name').value = '';
  document.getElementById('category-desc').value = '';
  document.getElementById('category-parent').value = '';
  document.getElementById('category-modal-error').classList.add('hidden');
  document.getElementById('category-modal').classList.remove('hidden');
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
