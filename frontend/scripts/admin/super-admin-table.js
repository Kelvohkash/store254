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

let activeMenuTrigger = null;
let rowMenuListenersBound = false;

function closeRowActionMenu() {
  const menu = document.getElementById("row-action-menu");
  if (menu) {
    menu.hidden = true;
    menu.innerHTML = "";
  }
  if (activeMenuTrigger) {
    activeMenuTrigger.setAttribute("aria-expanded", "false");
    activeMenuTrigger = null;
  }
}

function openRowActionMenu(trigger, store, onAction) {
  const menu = document.getElementById("row-action-menu");
  if (!menu) return;

  if (activeMenuTrigger === trigger && !menu.hidden) {
    closeRowActionMenu();
    return;
  }

  closeRowActionMenu();
  activeMenuTrigger = trigger;
  trigger.setAttribute("aria-expanded", "true");

  const slug = /^[a-z0-9-]+$/i.test(store.subdomain || "") ? store.subdomain : "";
  const storeUrl = slug ? `https://${slug}.store254.co.ke/` : "";
  const status = ["ACTIVE", "PENDING", "SUSPENDED"].includes(store.status) ? store.status : "UNKNOWN";

  const items = [];
  if (status === "ACTIVE") {
    items.push(
      `<button type="button" class="action-menu-item" role="menuitem" data-store-action="grant-trial" data-store-id="${escapeHtml(store.id)}"><i data-lucide="gift"></i><span>Grant 1 free month</span></button>`
    );
  }
  items.push(
    `<button type="button" class="action-menu-item" role="menuitem" data-store-action="edit-subdomain" data-store-id="${escapeHtml(store.id)}"><i data-lucide="pencil"></i><span>Amend subdomain</span></button>`
  );
  if (storeUrl) {
    items.push(
      `<a class="action-menu-item" role="menuitem" href="${storeUrl}" target="_blank" rel="noopener"><i data-lucide="external-link"></i><span>Visit storefront</span></a>`
    );
  }
  items.push('<div class="action-menu-divider" role="separator"></div>');
  items.push(
    `<button type="button" class="action-menu-item is-danger" role="menuitem" data-store-action="delete" data-store-id="${escapeHtml(store.id)}"><i data-lucide="trash-2"></i><span>Delete store</span></button>`
  );

  menu.innerHTML = items.join("");
  menu.hidden = false;
  if (window.lucide?.createIcons) window.lucide.createIcons();

  const rect = trigger.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const gap = 6;

  let top = rect.bottom + gap;
  if (top + menuRect.height > viewportH - 12 && rect.top - menuRect.height - gap > 12) {
    top = rect.top - menuRect.height - gap;
  }

  let left = rect.right - menuRect.width;
  if (left < 12) left = 12;
  if (left + menuRect.width > viewportW - 12) left = viewportW - menuRect.width - 12;

  menu.style.top = `${Math.round(top)}px`;
  menu.style.left = `${Math.round(left)}px`;

  menu.querySelectorAll("[data-store-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeRowActionMenu();
      onAction(btn);
    });
  });
  menu.querySelectorAll("a[role='menuitem']").forEach((link) => {
    link.addEventListener("click", () => closeRowActionMenu());
  });
}

function bindRowMenuGlobalListeners() {
  if (rowMenuListenersBound) return;
  rowMenuListenersBound = true;

  document.addEventListener("click", (event) => {
    const menu = document.getElementById("row-action-menu");
    if (!menu || menu.hidden) return;
    if (menu.contains(event.target) || activeMenuTrigger?.contains(event.target)) return;
    closeRowActionMenu();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeRowActionMenu();
  });

  window.addEventListener("resize", closeRowActionMenu);
  window.addEventListener("scroll", closeRowActionMenu, { passive: true });
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

  const primaryAction = status === "PENDING"
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

  const moreBtn = `<button class="row-action is-more" type="button" data-store-menu-trigger="${escapeHtml(store.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ${escapeHtml(name)}" title="More actions"><i data-lucide="more-horizontal"></i></button>`;

  return `<tr>
    <td>
      <div class="business-cell">
        <span class="business-avatar" data-category="${escapeHtml(store.businessType || 'GENERAL')}" aria-hidden="true">${escapeHtml(name.trim().slice(0, 1).toUpperCase() || "S")}</span>
        <div class="business-cell-text">
          <strong class="business-name" title="${escapeHtml(name)}">${escapeHtml(name)}</strong>
          ${ownerMeta
            ? `<small class="business-owner-meta" title="${escapeHtml(ownerMeta)}">${escapeHtml(ownerMeta)}</small>`
            : `<small class="business-type">${escapeHtml(category)}</small>`}
        </div>
      </div>
    </td>
    <td>
      ${storeUrl ? `
        <div class="store-url-pill">
          <a class="store-link" href="${storeUrl}" target="_blank" rel="noopener" title="${escapeHtml(storeUrl)}">${escapeHtml(slug)}.store254.co.ke</a>
          <button type="button" class="copy-url-btn" title="Copy store link" aria-label="Copy store link" data-copy-url="${escapeHtml(storeUrl)}"><i data-lucide="copy"></i></button>
          <button type="button" class="edit-url-btn" title="Amend subdomain" aria-label="Amend subdomain" data-store-action="edit-subdomain" data-store-id="${escapeHtml(store.id)}"><i data-lucide="pencil"></i></button>
        </div>
      ` : '<span class="text-muted">—</span>'}
    </td>
    <td><span class="category-pill">${escapeHtml(category)}</span></td>
    <td class="date-cell">${escapeHtml(formatDate(store.createdAt))}</td>
    <td>
      <div class="status-cell-wrap">
        <span class="status-badge status-${status.toLowerCase()}"><i class="status-dot"></i>${escapeHtml(statusLabel)}</span>
        <small class="billing-due-label ${isBillingDue ? "is-due" : ""}">${escapeHtml(billingLabel)}</small>
      </div>
    </td>
    <td class="actions-cell">
      <div class="actions-group">
        ${primaryAction}
        ${billingAction}
        ${moreBtn}
      </div>
    </td>
  </tr>`;
}

function renderStoresTable(stores, filterOrStatus, onAction) {
  bindRowMenuGlobalListeners();
  closeRowActionMenu();

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

  rowsContainer.querySelectorAll("[data-store-menu-trigger]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const store = stores.find((entry) => entry.id === trigger.dataset.storeMenuTrigger);
      if (store) openRowActionMenu(trigger, store, onAction);
    });
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

  rowsContainer.closest(".table-shell")?.addEventListener("scroll", closeRowActionMenu, { passive: true });

  if (window.lucide?.createIcons) window.lucide.createIcons();
}
