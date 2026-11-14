// SUPER ADMIN DASHBOARD CONTROLLER
// ═══════════════════════════════════════

(() => {
  window.platformBillingUiState = null;
  const ui = {
    app: document.getElementById("admin-app"),
    loading: document.getElementById("admin-loading"),
    rows: document.getElementById("business-rows"),
    empty: document.getElementById("empty-state"),
    search: document.getElementById("business-search"),
    categoryFilter: document.getElementById("business-category-filter"),
  };
  let stores = [];
  let selectedStatus = "ALL";
  let selectedCategory = "ALL";
  let editingSubdomainStore = null;
  let editingPriceStore = null;

  function renderStores() {
    renderStoresTable(stores, { status: selectedStatus, category: selectedCategory }, (button) => void handleStoreAction(button));
  }

  async function loadStores() {
    ui.rows.innerHTML = '<tr><td colspan="6" class="table-message">Loading registered businesses…</td></tr>';
    ui.empty.hidden = true;
    const collected = [];
    let page = 1;
    while (page <= 100) {
      const result = await platformApiFetch(`/stores?page=${page}&limit=100`);
      if (!result.ok || !Array.isArray(result.data.data)) {
        if (result.status === 401) window.location.replace("./super-admin-login.html");
        throw new Error(result.data.error?.message || "Could not load the business directory.");
      }
      collected.push(...result.data.data);
      if (result.data.data.length < 100) break;
      page += 1;
    }
    stores = collected;
    renderStores();
  }

  async function loadBillingSettings() {
    const result = await platformApiFetch("/billing/settings");
    if (!result.ok || !result.data.success) {
      if (result.status === 401) window.location.replace("./super-admin-login.html");
      throw new Error(result.data.error?.message || "Could not load billing settings.");
    }
    const settings = result.data.data || {};
    window.platformBillingUiState = settings;
    document.getElementById("platform-billing-amount").value = settings.amount || "";
    document.getElementById("platform-billing-shortcode-type").value = settings.shortcodeType || "PAYBILL";
    const status = document.getElementById("daraja-status");
    const topbarPill = document.getElementById("topbar-daraja-pill");
    const ready = settings.darajaConfigured;
    status.textContent = ready ? "Daraja credentials connected" : "Daraja credentials missing";
    status.classList.toggle("is-ready", ready);
    status.classList.toggle("is-missing", !ready);
    if (topbarPill) {
      topbarPill.textContent = ready ? "Daraja Ready" : "Daraja Missing";
      topbarPill.classList.toggle("is-ready", ready);
      topbarPill.classList.toggle("is-missing", !ready);
    }
    document.getElementById("daraja-mode").textContent = settings.darajaMode === "SANDBOX" ? "Sandbox" : "Production";
    document.getElementById("daraja-secret-help").textContent = ready
      ? "Daraja credentials are stored securely as Cloudflare Worker secrets. Secret values are never shown here."
      : "Add MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY, and MPESA_SHORTCODE to the backend Worker secrets in Cloudflare.";
  }

  async function saveBillingSettings() {
    const button = document.getElementById("save-billing-settings");
    const rawAmount = document.getElementById("platform-billing-amount").value.trim();
    const amount = rawAmount === "" ? 0 : Number(rawAmount);
    const shortcodeType = document.getElementById("platform-billing-shortcode-type").value;
    if (!Number.isInteger(amount) || amount < 0) {
      setAdminNotice("Enter a valid default monthly fee (or leave blank to set prices per store).", true);
      return;
    }
    button.disabled = true;
    button.textContent = "Saving…";
    const result = await platformApiFetch("/billing/settings", {
      method: "PUT",
      body: JSON.stringify({ amount, shortcodeType }),
    });
    button.disabled = false;
    button.textContent = "Save billing settings";
    if (!result.ok || !result.data.success) {
      if (result.status === 401) window.location.replace("./super-admin-login.html");
      setAdminNotice(result.data.error?.message || "Could not save billing settings.", true);
      return;
    }
    setAdminNotice(result.data.message || "Billing settings saved.");
    await loadBillingSettings();
    renderStores();
  }

  async function loadDashboard() {
    const [statsResult] = await Promise.all([platformApiFetch("/stats"), loadStores()]);
    if (!statsResult.ok || !statsResult.data.success) {
      if (statsResult.status === 401) window.location.replace("./super-admin-login.html");
      throw new Error(statsResult.data.error?.message || "Could not load marketplace overview.");
    }
    renderSuperAdminMetrics(statsResult.data.data);
    setAdminNotice("");
    if (window.lucide?.createIcons) window.lucide.createIcons();
  }

  function openPriceModal(store) {
    const modal = document.getElementById("price-modal");
    const subtitle = document.getElementById("price-modal-subtitle");
    const input = document.getElementById("store-price-input");
    const hint = document.getElementById("price-hint");
    const errorEl = document.getElementById("price-error");
    const clearBtn = document.getElementById("price-clear-btn");
    if (!modal || !input) return;

    editingPriceStore = store;
    const defaultAmount = Number(window.platformBillingUiState?.amount) || 0;
    subtitle.textContent = `Set the monthly subscription price for ${store.name}.`;
    input.value = store.subscriptionAmount > 0 ? String(store.subscriptionAmount) : "";
    hint.textContent = defaultAmount > 0
      ? `Platform default is KES ${defaultAmount.toLocaleString("en-KE")}/mo. Setting a custom price overrides it for this store.`
      : "No platform default is set. Enter the monthly KES amount this store should pay.";
    if (clearBtn) {
      clearBtn.hidden = !(store.subscriptionAmount > 0 && defaultAmount > 0);
    }
    errorEl.hidden = true;
    modal.hidden = false;
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 20);
  }

  function closePriceModal() {
    const modal = document.getElementById("price-modal");
    if (modal) modal.hidden = true;
    editingPriceStore = null;
  }

  async function persistStorePrice(amount) {
    if (!editingPriceStore) return;
    const errorEl = document.getElementById("price-error");
    const saveBtn = document.getElementById("price-save-btn");
    const clearBtn = document.getElementById("price-clear-btn");

    saveBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    errorEl.hidden = true;

    const result = await platformApiFetch(`/stores/${encodeURIComponent(editingPriceStore.id)}/billing/price`, {
      method: "PATCH",
      body: JSON.stringify({ amount }),
    });

    saveBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
    saveBtn.textContent = "Save Price";

    if (!result.ok || !result.data.success) {
      if (result.status === 401) {
        window.location.replace("./super-admin-login.html");
        return;
      }
      errorEl.textContent = result.data.error?.message || "Could not update store price.";
      errorEl.hidden = false;
      return;
    }

    const storeName = editingPriceStore.name;
    closePriceModal();
    setAdminNotice(
      result.data.message || (amount ? `Monthly price for "${storeName}" updated.` : `Custom price cleared for "${storeName}".`)
    );
    await loadDashboard();
  }

  async function saveStorePrice(event) {
    event.preventDefault();
    if (!editingPriceStore) return;
    const input = document.getElementById("store-price-input");
    const errorEl = document.getElementById("price-error");
    const raw = (input?.value || "").trim();
    const amount = Number(raw);
    if (!raw || !Number.isInteger(amount) || amount < 1 || amount > 10_000_000) {
      errorEl.textContent = "Enter a whole number between 1 and 10,000,000 KES.";
      errorEl.hidden = false;
      return;
    }
    await persistStorePrice(amount);
  }

  function openSubdomainModal(store) {
    const modal = document.getElementById("subdomain-modal");
    const subtitle = document.getElementById("subdomain-modal-subtitle");
    const input = document.getElementById("subdomain-input");
    const preview = document.getElementById("subdomain-preview");
    const errorEl = document.getElementById("subdomain-error");
    if (!modal || !input) return;

    editingSubdomainStore = store;
    subtitle.textContent = `Changing URL for ${store.name} (currently ${store.subdomain}.store254.co.ke).`;
    input.value = store.subdomain || "";
    preview.textContent = `Preview: https://${store.subdomain || "—"}.store254.co.ke/`;
    errorEl.hidden = true;
    modal.hidden = false;
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 20);
  }

  function closeSubdomainModal() {
    const modal = document.getElementById("subdomain-modal");
    if (modal) modal.hidden = true;
    editingSubdomainStore = null;
  }

  async function saveSubdomainEdit(event) {
    event.preventDefault();
    if (!editingSubdomainStore) return;
    const input = document.getElementById("subdomain-input");
    const errorEl = document.getElementById("subdomain-error");
    const saveBtn = document.getElementById("subdomain-save-btn");
    const cleaned = (input.value || "").trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(cleaned)) {
      errorEl.textContent = "Use 2-32 lowercase letters, numbers, or internal hyphens (cannot start or end with a hyphen).";
      errorEl.hidden = false;
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    errorEl.hidden = true;

    const result = await platformApiFetch(`/stores/${encodeURIComponent(editingSubdomainStore.id)}/subdomain`, {
      method: "PATCH",
      body: JSON.stringify({ subdomain: cleaned }),
    });

    saveBtn.disabled = false;
    saveBtn.textContent = "Save Subdomain";

    if (!result.ok || !result.data.success) {
      if (result.status === 401) {
        window.location.replace("./super-admin-login.html");
        return;
      }
      errorEl.textContent = result.data.error?.message || "Could not update subdomain.";
      errorEl.hidden = false;
      return;
    }

    const updatedName = editingSubdomainStore.name;
    closeSubdomainModal();
    setAdminNotice(result.data.message || `Subdomain for "${updatedName}" updated to ${cleaned}.store254.co.ke.`);
    await loadDashboard();
  }

  async function handleDeleteStore(store, button) {
    const confirmed = await confirmDialog({
      title: `Delete ${store.name}?`,
      message: `This permanently deletes "${store.name}" (${store.subdomain}.store254.co.ke), including all products, categories, orders, merchant accounts, and uploaded media. This cannot be undone.`,
      isDanger: true,
      confirmText: "Delete store permanently",
      requireTypedValue: store.subdomain,
      typedPromptLabel: `Type "${store.subdomain}" to permanently delete`,
    });
    if (!confirmed) return;

    button.disabled = true;
    const prevHtml = button.innerHTML;
    button.textContent = "Deleting…";

    const result = await platformApiFetch(`/stores/${encodeURIComponent(store.id)}`, { method: "DELETE" });
    if (!result.ok || !result.data.success) {
      button.disabled = false;
      button.innerHTML = prevHtml;
      if (result.status === 401) {
        window.location.replace("./super-admin-login.html");
        return;
      }
      setAdminNotice(result.data.error?.message || "Could not delete this business.", true);
      return;
    }

    setAdminNotice(result.data.message || `Store "${store.name}" permanently deleted.`);
    await loadDashboard();
  }

  async function handleStoreAction(button) {
    const store = stores.find((entry) => entry.id === button.dataset.storeId);
    if (!store) return;
    const action = button.dataset.storeAction;
    if (action === "edit-price") {
      openPriceModal(store);
      return;
    }
    if (action === "edit-subdomain") {
      openSubdomainModal(store);
      return;
    }
    if (action === "delete") {
      await handleDeleteStore(store, button);
      return;
    }
    if (action === "grant-trial") {
      const confirmed = await confirmDialog(
        `Give ${store.name} one free month?`,
        "The store will not see a payment due card until the new monthly coverage period ends.",
        false,
      );
      if (!confirmed) return;
      const prevHtml = button.innerHTML;
      button.disabled = true;
      button.textContent = "Adding month…";
      const result = await platformApiFetch(`/stores/${encodeURIComponent(store.id)}/billing/trial`, { method: "PATCH" });
      if (!result.ok || !result.data.success) {
        button.disabled = false;
        button.innerHTML = prevHtml;
        if (window.lucide?.createIcons) window.lucide.createIcons();
        if (result.status === 401) {
          window.location.replace("./super-admin-login.html");
          return;
        }
        setAdminNotice(result.data.error?.message || "Could not add a free month.", true);
        return;
      }
      setAdminNotice(result.data.message || "One free month has been added.");
      await loadDashboard();
      return;
    }
    const isApproval = action === "activate";
    const isReactivation = action === "reactivate";
    const isSuspension = action === "deactivate";
    const title = isApproval ? `Approve ${store.name}?` : isReactivation ? `Reactivate ${store.name}?` : `Suspend ${store.name}?`;
    const message = isApproval || isReactivation
      ? `This will immediately make the storefront live at https://${store.subdomain}.store254.co.ke/ and notify the merchant.`
      : `Customers will no longer be able to browse or place orders on this storefront until re-activated.`;

    const confirmed = await confirmDialog(title, message, isSuspension);
    if (!confirmed) return;

    const prevHtml = button.innerHTML;
    button.disabled = true;
    button.textContent = isApproval ? "Approving…" : isReactivation ? "Reactivating…" : "Suspending…";
    const result = await platformApiFetch(`/stores/${encodeURIComponent(store.id)}/${action}`, { method: "PATCH" });
    if (!result.ok || !result.data.success) {
      button.disabled = false;
      button.innerHTML = prevHtml;
      if (window.lucide?.createIcons) window.lucide.createIcons();
      if (result.status === 401) {
        window.location.replace("./super-admin-login.html");
        return;
      }
      setAdminNotice(result.data.error?.message || `Could not ${isApproval ? "approve" : "suspend"} this business.`, true);
      return;
    }
    setAdminNotice(result.data.message || `${store.name} has been updated.`);
    await loadDashboard();
  }

  async function start() {
    document.getElementById("footer-date").textContent = new Intl.DateTimeFormat("en-KE", { year: "numeric" }).format(new Date());
    const session = await fetch(`${superAdminApiBase}/api/platform/admin/me`, { credentials: "include", headers: { Accept: "application/json" } }).catch(() => null);
    const sessionData = session ? await session.json().catch(() => ({})) : {};
    if (!session?.ok || !sessionData.authenticated) {
      window.location.replace("./super-admin-login.html");
      return;
    }
    ui.loading.hidden = true;
    ui.app.hidden = false;
    try {
      await loadBillingSettings();
      await loadDashboard();
    } catch (error) {
      setAdminNotice(error.message || "Could not load platform data.", true);
      ui.rows.innerHTML = '<tr><td colspan="6" class="table-message">The business directory could not be loaded. Try refreshing.</td></tr>';
    }

    // Keyboard shortcut ⌘K / Ctrl+K
    window.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        ui.search.focus();
        ui.search.select();
      }
    });
  }

  ui.search.addEventListener("input", renderStores);
  ui.categoryFilter?.addEventListener("change", () => {
    selectedCategory = ui.categoryFilter.value || "ALL";
    renderStores();
  });
  document.querySelectorAll("[data-status-filter]").forEach((tab) => tab.addEventListener("click", () => {
    selectedStatus = tab.dataset.statusFilter;
    document.querySelectorAll("[data-status-filter]").forEach((other) => other.classList.toggle("is-selected", other === tab));
    renderStores();
  }));
  document.getElementById("refresh-button").addEventListener("click", () => void loadDashboard().catch((error) => setAdminNotice(error.message, true)));
  document.getElementById("save-billing-settings").addEventListener("click", () => void saveBillingSettings());
  document.getElementById("subdomain-form")?.addEventListener("submit", (event) => void saveSubdomainEdit(event));
  document.getElementById("subdomain-cancel-btn")?.addEventListener("click", closeSubdomainModal);
  document.getElementById("subdomain-modal")?.addEventListener("click", (event) => {
    if (event.target.id === "subdomain-modal") closeSubdomainModal();
  });

  // Sidebar active section indicator
  const navLinks = Array.from(document.querySelectorAll("[data-nav-section]"));
  const setActiveNav = (sectionId) => {
    navLinks.forEach((link) => {
      link.classList.toggle("is-current", link.dataset.navSection === sectionId);
    });
  };
  navLinks.forEach((link) => {
    link.addEventListener("click", () => setActiveNav(link.dataset.navSection));
  });
  if ("IntersectionObserver" in window && navLinks.length > 0) {
    const scrollRoot = document.querySelector(".admin-content");
    const sections = navLinks
      .map((link) => document.getElementById(link.dataset.navSection))
      .filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActiveNav(visible.target.id);
    }, { root: scrollRoot || null, rootMargin: "-20% 0px -60% 0px", threshold: 0 });
    sections.forEach((section) => observer.observe(section));
  }
  document.getElementById("subdomain-input")?.addEventListener("input", (event) => {
    const raw = (event.target.value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    const preview = document.getElementById("subdomain-preview");
    const errorEl = document.getElementById("subdomain-error");
    if (preview) preview.textContent = `Preview: https://${raw || "—"}.store254.co.ke/`;
    if (errorEl) errorEl.hidden = true;
  });
  document.getElementById("price-form")?.addEventListener("submit", (event) => void saveStorePrice(event));
  document.getElementById("price-cancel-btn")?.addEventListener("click", closePriceModal);
  document.getElementById("price-clear-btn")?.addEventListener("click", () => void persistStorePrice(null));
  document.getElementById("price-modal")?.addEventListener("click", (event) => {
    if (event.target.id === "price-modal") closePriceModal();
  });
  document.getElementById("store-price-input")?.addEventListener("input", () => {
    const errorEl = document.getElementById("price-error");
    if (errorEl) errorEl.hidden = true;
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.getElementById("subdomain-modal")?.hidden) {
      closeSubdomainModal();
    }
    if (event.key === "Escape" && !document.getElementById("price-modal")?.hidden) {
      closePriceModal();
    }
  });
  const performLogout = async () => {
    const button = document.getElementById("logout-button");
    if (button) button.disabled = true;
    await platformApiFetch("/logout", { method: "POST" });
    window.location.replace("./super-admin-login.html");
  };
  document.getElementById("logout-button").addEventListener("click", () => void performLogout());
  document.getElementById("mobile-logout-button")?.addEventListener("click", () => void performLogout());
  void start();
})();
