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

async function loadCategoriesForDropdown() {
  const r = await apiFetch('/categories');
  flatCategories = r.ok ? flattenTree(r.data?.data || []) : [];
  const catOpts = flatCategories.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.displayName)}</option>`).join('');
  const productCatEl = document.getElementById('product-category');
  if (productCatEl) productCatEl.innerHTML = '<option value="">No Category</option>' + catOpts;
  const parentCatEl = document.getElementById('category-parent');
  if (parentCatEl) parentCatEl.innerHTML = '<option value="">None (top-level)</option>' + catOpts;
}

async function loadCategories() {
  const r = await apiFetch('/categories');
  flatCategories = r.ok ? flattenTree(r.data?.data || []) : [];
  renderCategoriesTable(flatCategories);
  // Reload parent dropdown
  const parentCatEl = document.getElementById('category-parent');
  if (parentCatEl) {
    parentCatEl.innerHTML = '<option value="">None (top-level)</option>' + flatCategories.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.displayName)}</option>`).join('');
  }
}

function renderCategoriesTable(cats) {
  const tbody = document.getElementById('categories-table-body');
  if (!tbody) return;
  if (!cats.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="px-5 py-10 text-center text-slate-400">No categories yet.</td></tr>';
    return;
  }
  tbody.innerHTML = cats.map(c => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="px-5 py-3 font-bold text-slate-900 text-sm"><span class="${c.parentId ? 'ml-6 border-l-2 border-slate-200 pl-3' : ''}">${c.parentId ? '↳ ' : ''}${escHtml(c.name)}</span></td>
      <td class="px-5 py-3 text-xs text-slate-400 font-mono">${escHtml(c.slug || '')}</td>
      <td class="px-5 py-3 text-xs text-slate-500">${c.parentId ? escHtml(c.parentName || '—') : '—'}</td>
      <td class="px-5 py-3 text-right">
        <button onclick="openEditCategoryModal(${inlineJs(c.id)})" class="text-xs font-bold text-slate-500 hover:text-emerald-600 px-2 py-1 rounded-lg transition-all">Edit</button>
        <button onclick="deleteCategory(${inlineJs(c.id)}, ${inlineJs(c.name)})" class="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-all">Delete</button>
      </td>
    </tr>
  `).join('');
}

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
  parentSelect.innerHTML = '<option value="">None (top-level)</option>' + flatCategories
    .filter(c => !excludedIds.has(c.id))
    .map(c => `<option value="${escHtml(c.id)}">${escHtml(c.displayName)}</option>`).join('');
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
