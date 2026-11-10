// SUPER ADMIN TABLE & METRICS RENDERING
// ═══════════════════════════════════════

function renderSuperAdminMetrics(stats) {
  const data = stats || {};
  document.getElementById("metric-total").textContent = Number(data.stores?.total || 0).toLocaleString("en-KE");
  document.getElementById("metric-active").textContent = Number(data.stores?.active || 0).toLocaleString("en-KE");
  document.getElementById("metric-pending").textContent = Number(data.stores?.pendingApproval || 0).toLocaleString("en-KE");
  document.getElementById("metric-suspended").textContent = Number(data.stores?.suspended || 0).toLocaleString("en-KE");
  document.getElementById("metric-gmv").textContent = money(data.orders?.platformGMV_KES);
  document.getElementById("sidebar-store-count").textContent = Number(data.stores?.total || 0).toLocaleString("en-KE");
  document.getElementById("filter-count-all").textContent = Number(data.stores?.total || 0);
  document.getElementById("filter-count-pending").textContent = Number(data.stores?.pendingApproval || 0);
  document.getElementById("filter-count-active").textContent = Number(data.stores?.active || 0);
  document.getElementById("filter-count-suspended").textContent = Number(data.stores?.suspended || 0);
}

function storeRowMarkup(store) {
  const name = store.name || "Unnamed business";
  const slug = /^[a-z0-9-]+$/i.test(store.subdomain || "") ? store.subdomain : "";
  const storeUrl = slug ? `https://${slug}.store254.co.ke/` : "";
  const status = ["ACTIVE", "PENDING", "SUSPENDED"].includes(store.status) ? store.status : "UNKNOWN";
  const statusLabel = { ACTIVE: "Active", PENDING: "Needs review", SUSPENDED: "Suspended", UNKNOWN: "Unknown" }[status];
  const category = formatCategory(store.businessType);
  const templateId = store.settings?.storefrontTemplate || "market-modern";
  const templateLabel = formatTemplateName(templateId);

  const action = status === "PENDING"
    ? `<button class="row-action is-approve" type="button" data-store-action="activate" data-store-id="${escapeHtml(store.id)}"><span>✓</span> Approve store</button>`
    : status === "ACTIVE"
      ? `<button class="row-action is-danger" type="button" data-store-action="deactivate" data-store-id="${escapeHtml(store.id)}"><span>Ⅱ</span> Suspend</button>`
      : '<span class="text-muted" aria-label="No available action">—</span>';

  return `<tr>
    <td>
      <div class="business-cell">
        <span class="business-avatar" data-category="${escapeHtml(store.businessType || 'GENERAL')}" aria-hidden="true">${escapeHtml(name.trim().slice(0, 1).toUpperCase() || "S")}</span>
        <div>
          <strong class="business-name">${escapeHtml(name)}</strong>
          <small class="business-type">${escapeHtml(category)}</small>
        </div>
      </div>
    </td>
    <td>
      ${storeUrl ? `
        <div class="store-url-pill">
          <a class="store-link" href="${storeUrl}" target="_blank" rel="noopener">${escapeHtml(slug)}.store254.co.ke</a>
          <button type="button" class="copy-url-btn" title="Copy store link" data-copy-url="${escapeHtml(storeUrl)}">⎘</button>
        </div>
      ` : '<span class="text-muted">—</span>'}
    </td>
    <td>
      <span class="store-template-badge" data-template="${escapeHtml(templateId)}">${escapeHtml(templateLabel)}</span>
    </td>
    <td><span class="category-pill">${escapeHtml(category)}</span></td>
    <td class="date-cell">${escapeHtml(formatDate(store.createdAt))}</td>
    <td><span class="status-badge status-${status.toLowerCase()}"><i class="status-dot"></i>${escapeHtml(statusLabel)}</span></td>
    <td class="actions-cell">
      <div class="actions-group">
        ${action}
        ${storeUrl ? `<a href="${storeUrl}" target="_blank" rel="noopener" class="row-action is-link" title="Visit storefront">↗</a>` : ""}
      </div>
    </td>
  </tr>`;
}

function renderStoresTable(stores, selectedStatus, onAction) {
  const searchInput = document.getElementById("business-search");
  const rowsContainer = document.getElementById("business-rows");
  const emptyState = document.getElementById("empty-state");
  const query = searchInput?.value.trim().toLowerCase() || "";
  const visible = stores.filter((store) => {
    const matchesStatus = selectedStatus === "ALL" || store.status === selectedStatus;
    const matchesQuery = !query || `${store.name || ""} ${store.subdomain || ""} ${store.businessType || ""} ${store.settings?.storefrontTemplate || ""}`.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });
  document.getElementById("result-count").textContent = `${visible.length} ${visible.length === 1 ? "business" : "businesses"}`;
  rowsContainer.innerHTML = visible.map(storeRowMarkup).join("");
  emptyState.hidden = visible.length > 0;
  rowsContainer.hidden = visible.length === 0;

  rowsContainer.querySelectorAll("[data-store-action]").forEach((button) => {
    button.addEventListener("click", () => onAction(button));
  });

  rowsContainer.querySelectorAll("[data-copy-url]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copyUrl);
        const orig = button.textContent;
        button.textContent = "✓";
        setTimeout(() => { button.textContent = orig; }, 1400);
      } catch {
        setAdminNotice("Could not copy link to clipboard.", true);
      }
    });
  });

  if (window.lucide?.createIcons) window.lucide.createIcons();
}
