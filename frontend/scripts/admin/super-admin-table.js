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
  const phoneInfo = resolveStorePhones(store);

  const items = [];
  items.push(
    `<button type="button" class="action-menu-item" role="menuitem" data-store-action="edit-price" data-store-id="${escapeHtml(store.id)}"><i data-lucide="tag"></i><span>Set monthly price</span></button>`
  );
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
  if (phoneInfo.telHref) {
    items.push(
      `<a class="action-menu-item" role="menuitem" href="${escapeHtml(phoneInfo.telHref)}"><i data-lucide="phone"></i><span>Call ${escapeHtml(phoneInfo.primaryPhone)}</span></a>`
    );
  }
  if (phoneInfo.whatsappHref) {
    items.push(
      `<a class="action-menu-item" role="menuitem" href="${escapeHtml(phoneInfo.whatsappHref)}" target="_blank" rel="noopener noreferrer"><i data-lucide="message-circle"></i><span>Message on WhatsApp</span></a>`
    );
  }
  if (phoneInfo.primaryPhone) {
    items.push(
      `<button type="button" class="action-menu-item" role="menuitem" data-copy-phone="${escapeHtml(phoneInfo.primaryPhone)}"><i data-lucide="copy"></i><span>Copy phone number</span></button>`
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
  menu.querySelectorAll("[data-copy-phone]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = btn.dataset.copyPhone || "";
      closeRowActionMenu();
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        showAdminToast(`Copied ${value}`);
      } catch {
        setAdminNotice("Could not copy phone number to clipboard.", true);
      }
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
  document.querySelector(".admin-content")?.addEventListener("scroll", closeRowActionMenu, { passive: true });
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

  const ownerMeta = [store.ownerName, store.ownerEmail]
    .filter((val) => typeof val === "string" && val.trim().length > 0)
    .join(" · ");

  const phoneInfo = resolveStorePhones(store);
  const phoneCellHtml = (phoneInfo.primaryPhone || phoneInfo.whatsappHref)
    ? `<div class="store-phone-cell">
        <div class="store-phone-pill">
          ${phoneInfo.telHref
            ? `<a class="store-phone-link" href="${escapeHtml(phoneInfo.telHref)}" title="Call ${escapeHtml(phoneInfo.primaryPhone)}"><i data-lucide="phone"></i><span>${escapeHtml(phoneInfo.primaryPhone)}</span></a>`
            : `<span class="store-phone-text"><i data-lucide="phone"></i><span>${escapeHtml(phoneInfo.primaryPhone || "WhatsApp")}</span></span>`}
          ${phoneInfo.primaryPhone
            ? `<button type="button" class="phone-action-btn" title="Copy phone number" aria-label="Copy phone number ${escapeHtml(phoneInfo.primaryPhone)}" data-copy-phone="${escapeHtml(phoneInfo.primaryPhone)}"><i data-lucide="copy"></i></button>`
            : ""}
          ${phoneInfo.whatsappHref
            ? `<a class="phone-action-btn is-whatsapp" href="${escapeHtml(phoneInfo.whatsappHref)}" target="_blank" rel="noopener noreferrer" title="WhatsApp ${escapeHtml(name)}" aria-label="WhatsApp ${escapeHtml(name)}"><i data-lucide="message-circle"></i></a>`
            : ""}
        </div>
        ${phoneInfo.secondaryOwnerPhone
          ? `<small class="store-owner-phone-alt">Owner: ${phoneInfo.secondaryOwnerTelHref
              ? `<a href="${escapeHtml(phoneInfo.secondaryOwnerTelHref)}" title="Call owner ${escapeHtml(phoneInfo.secondaryOwnerPhone)}">${escapeHtml(phoneInfo.secondaryOwnerPhone)}</a>`
              : escapeHtml(phoneInfo.secondaryOwnerPhone)}</small>`
          : ""}
      </div>`
    : '<span class="text-muted store-phone-empty">No phone</span>';

  const primaryAction = status === "PENDING"
    ? `<button class="row-action is-approve" type="button" data-store-action="activate" data-store-id="${escapeHtml(store.id)}"><i data-lucide="check"></i><span>Approve</span></button>`
    : status === "ACTIVE"
      ? `<button class="row-action is-danger" type="button" data-store-action="deactivate" data-store-id="${escapeHtml(store.id)}"><i data-lucide="pause"></i><span>Suspend</span></button>`
      : status === "SUSPENDED"
        ? `<button class="row-action is-approve" type="button" data-store-action="reactivate" data-store-id="${escapeHtml(store.id)}"><i data-lucide="rotate-ccw"></i><span>Reactivate</span></button>`
        : '<span class="text-muted" aria-label="No available action">—</span>';

  const customPrice = Number(store.subscriptionAmount) || 0;
  const defaultPrice = Number(window.platformBillingUiState?.amount) || 0;
  const priceChip = customPrice > 0
    ? `<button type="button" class="store-price-chip is-custom" data-store-action="edit-price" data-store-id="${escapeHtml(store.id)}" title="Custom monthly price — click to edit"><i data-lucide="tag"></i><span>${escapeHtml(money(customPrice))}/mo</span></button>`
    : defaultPrice > 0
      ? `<button type="button" class="store-price-chip" data-store-action="edit-price" data-store-id="${escapeHtml(store.id)}" title="Using default fee — click to set custom price"><i data-lucide="tag"></i><span>Default ${escapeHtml(money(defaultPrice))}/mo</span></button>`
      : `<button type="button" class="store-price-chip is-unset" data-store-action="edit-price" data-store-id="${escapeHtml(store.id)}" title="No price set — click to set monthly price"><i data-lucide="tag"></i><span>Set price</span></button>`;

  const priceAction = `<button class="row-action is-billing" type="button" data-store-action="edit-price" data-store-id="${escapeHtml(store.id)}" title="Set custom monthly price"><i data-lucide="tag"></i><span>Price</span></button>`;

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
    <td>${phoneCellHtml}</td>
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
        ${priceChip}
        <small class="billing-due-label ${isBillingDue ? "is-due" : ""}">${escapeHtml(billingLabel)}</small>
      </div>
    </td>
    <td class="actions-cell">
      <div class="actions-group">
        ${primaryAction}
        ${priceAction}
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
  const isPhoneQuery = /^[+\d\s()-]{4,}$/.test(query);
  const queryRawDigits = query.replace(/\D/g, "");
  const queryNormDigits = normalizePhoneComparable(query);
  const selectedStatus = typeof filterOrStatus === "string" ? filterOrStatus : (filterOrStatus?.status || "ALL");
  const selectedCategory = typeof filterOrStatus === "object" && filterOrStatus?.category ? filterOrStatus.category : "ALL";

  const visible = stores.filter((store) => {
    const matchesStatus = selectedStatus === "ALL" || store.status === selectedStatus;
    const matchesCategory = selectedCategory === "ALL" || String(store.businessType || "GENERAL").toUpperCase() === selectedCategory;
    const phoneDigitVariants = [store.phone, store.contactPhone, store.ownerPhone, store.whatsapp]
      .filter(Boolean)
      .flatMap((val) => {
        const raw = String(val).replace(/\D/g, "");
        const norm = normalizePhoneComparable(val);
        const local = norm.startsWith("254") && norm.length === 12 ? `0${norm.slice(3)}` : "";
        return [raw, norm, local].filter(Boolean);
      });
    const searchable = [
      store.name,
      store.subdomain,
      store.customDomain,
      store.businessType,
      store.ownerName,
      store.ownerEmail,
      store.phone,
      store.contactPhone,
      store.ownerPhone,
      store.whatsapp,
      ...phoneDigitVariants,
    ].filter(Boolean).join(" ").toLowerCase();
    const matchesText = !query || searchable.includes(query);
    const matchesPhoneDigits = isPhoneQuery && phoneDigitVariants.some(
      (digits) => (queryRawDigits && digits.includes(queryRawDigits)) || (queryNormDigits && digits.includes(queryNormDigits))
    );
    const matchesQuery = matchesText || matchesPhoneDigits;
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

  rowsContainer.querySelectorAll("[data-copy-phone]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copyPhone);
        showAdminToast(`Copied ${button.dataset.copyPhone}`);
      } catch {
        setAdminNotice("Could not copy phone number to clipboard.", true);
      }
    });
  });

  rowsContainer.closest(".table-shell")?.addEventListener("scroll", closeRowActionMenu, { passive: true });

  if (window.lucide?.createIcons) window.lucide.createIcons();
}
