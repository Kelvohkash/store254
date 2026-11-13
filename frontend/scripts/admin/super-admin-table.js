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
  const dueDate = store.subscriptionDueAt ? new Date(store.subscriptionDueAt) : null;
  const isBillingDue = dueDate && !Number.isNaN(dueDate.getTime()) && dueDate <= new Date();
  const billingLabel = dueDate && !Number.isNaN(dueDate.getTime())
    ? isBillingDue ? "Payment overdue" : `Covered until ${formatDate(dueDate)}`
    : "Billing not started";

  const ownerMeta = [store.ownerName, store.ownerEmail, store.ownerPhone]
    .filter((val) => typeof val === "string" && val.trim().length > 0)
    .slice(0, 2)
    .join(" · ");

  const action = status === "PENDING"
    ? `<button class="row-action is-approve" type="button" data-store-action="activate" data-store-id="${escapeHtml(store.id)}"><i data-lucide="check"></i><span>Approve</span></button>`
    : status === "ACTIVE"
      ? `<button class="row-action is-danger" type="button" data-store-action="deactivate" data-store-id="${escapeHtml(store.id)}"><i data-lucide="pause"></i><span>Suspend</span></button>`
      : status === "SUSPENDED"
        ? `<button class="row-action is-approve" type="button" data-store-action="reactivate" data-store-id="${escapeHtml(store.id)}"><i data-lucide="rotate-ccw"></i><span>Reactivate</span></button>`
        : '<span class="text-muted" aria-label="No available action">—</span>';
  const canPrompt = ["ACTIVE", "SUSPENDED"].includes(status);
  const billingReady = window.platformBillingUiState?.darajaConfigured && window.platformBillingUiState?.amount > 0;
  const billingAction = canPrompt
    ? `<button class="row-action is-billing" type="button" data-store-action="payment-prompt" data-store-id="${escapeHtml(store.id)}" ${billingReady ? "" : "disabled title=\"Configure billing and Daraja first\""}><i data-lucide="smartphone"></i><span>M-Pesa</span></button>`
    : "";
  const trialAction = status === "ACTIVE"
    ? `<button class="row-action is-billing" type="button" data-store-action="grant-trial" data-store-id="${escapeHtml(store.id)}"><i data-lucide="gift"></i><span>Free month</span></button>`
    : "";
  const editSubdomainBtn = `<button class="row-action is-subtle" type="button" data-store-action="edit-subdomain" data-store-id="${escapeHtml(store.id)}" title="Amend store subdomain"><i data-lucide="pencil"></i><span>Subdomain</span></button>`;
  const deleteBtn = `<button class="row-action is-delete" type="button" data-store-action="delete" data-store-id="${escapeHtml(store.id)}" title="Delete store permanently"><i data-lucide="trash-2"></i><span>Delete</span></button>`;

  return `<tr>
    <td>
      <div class="business-cell">
        <span class="business-avatar" data-category="${escapeHtml(store.businessType || 'GENERAL')}" aria-hidden="true">${escapeHtml(name.trim().slice(0, 1).toUpperCase() || "S")}</span>
        <div>
          <strong class="business-name">${escapeHtml(name)}</strong>
          ${ownerMeta ? `<small class="business-owner-meta">${escapeHtml(ownerMeta)}</small>` : `<small class="business-type">${escapeHtml(category)}</small>`}
        </div>
      </div>
    </td>
    <td>
      ${storeUrl ? `
        <div class="store-url-pill">
          <a class="store-link" href="${storeUrl}" target="_blank" rel="noopener">${escapeHtml(slug)}.store254.co.ke</a>
          <button type="button" class="copy-url-btn" title="Copy store link" data-copy-url="${escapeHtml(storeUrl)}"><i data-lucide="copy"></i></button>
          <button type="button" class="edit-url-btn" title="Amend subdomain" data-store-action="edit-subdomain" data-store-id="${escapeHtml(store.id)}"><i data-lucide="pencil"></i></button>
        </div>
      ` : '<span class="text-muted">—</span>'}
    </td>
    <td><span class="category-pill">${escapeHtml(category)}</span></td>
    <td class="date-cell">${escapeHtml(formatDate(store.createdAt))}</td>
    <td><span class="status-badge status-${status.toLowerCase()}"><i class="status-dot"></i>${escapeHtml(statusLabel)}</span><small class="billing-due-label ${isBillingDue ? "is-due" : ""}">${escapeHtml(billingLabel)}</small></td>
    <td class="actions-cell">
      <div class="actions-group">
        ${action}
        ${editSubdomainBtn}
        ${billingAction}
        ${trialAction}
        ${storeUrl ? `<a href="${storeUrl}" target="_blank" rel="noopener" class="row-action is-link" title="Visit storefront"><i data-lucide="arrow-up-right"></i></a>` : ""}
        ${deleteBtn}
      </div>
    </td>
  </tr>`;
}

function renderStoresTable(stores, filterOrStatus, onAction) {
  const searchInput = document.getElementById("business-search");
  const rowsContainer = document.getElementById("business-rows");
  const emptyState = document.getElementById("empty-state");
  const query = searchInput?.value.trim().toLowerCase() || "";
  const selectedStatus = typeof filterOrStatus === "string" ? filterOrStatus : (filterOrStatus?.status || "ALL");
  const selectedCategory = typeof filterOrStatus === "object" && filterOrStatus?.category ? filterOrStatus.category : "ALL";

  const visible = stores.filter((store) => {
    const matchesStatus = selectedStatus === "ALL" || store.status === selectedStatus;
    const matchesCategory = selectedCategory === "ALL" || String(store.businessType || "GENERAL").toUpperCase() === selectedCategory;
    const searchable = [
      store.name,
      store.subdomain,
      store.customDomain,
      store.businessType,
      store.ownerName,
      store.ownerEmail,
      store.ownerPhone,
    ].filter(Boolean).join(" ").toLowerCase();
    const matchesQuery = !query || searchable.includes(query);
    return matchesStatus && matchesCategory && matchesQuery;
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
        showAdminToast(`Copied ${button.dataset.copyUrl}`);
      } catch {
        setAdminNotice("Could not copy link to clipboard.", true);
      }
    });
  });

  if (window.lucide?.createIcons) window.lucide.createIcons();
}
