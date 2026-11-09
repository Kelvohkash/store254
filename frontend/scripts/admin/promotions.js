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
