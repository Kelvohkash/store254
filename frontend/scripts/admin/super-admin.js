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
  };
  let stores = [];
  let selectedStatus = "ALL";

  function renderStores() {
    renderStoresTable(stores, selectedStatus, (button) => void handleStoreAction(button));
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
    document.getElementById("platform-billing-interval").value = settings.intervalDays || "";
    document.getElementById("platform-billing-shortcode-type").value = settings.shortcodeType || "PAYBILL";
    const status = document.getElementById("daraja-status");
    const ready = settings.darajaConfigured;
    status.textContent = ready ? "Daraja credentials connected" : "Daraja credentials missing";
    status.classList.toggle("is-ready", ready);
    status.classList.toggle("is-missing", !ready);
    document.getElementById("daraja-mode").textContent = settings.darajaMode === "SANDBOX" ? "Sandbox" : "Production";
    document.getElementById("daraja-secret-help").textContent = ready
      ? "Daraja credentials are stored securely as Cloudflare Worker secrets. Secret values are never shown here."
      : "Add MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY, and MPESA_SHORTCODE to the backend Worker secrets in Cloudflare.";
  }

  async function saveBillingSettings() {
    const button = document.getElementById("save-billing-settings");
    const amount = Number(document.getElementById("platform-billing-amount").value);
    const intervalDays = Number(document.getElementById("platform-billing-interval").value);
    const shortcodeType = document.getElementById("platform-billing-shortcode-type").value;
    if (!Number.isInteger(amount) || amount <= 0 || !Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 366) {
      setAdminNotice("Enter a subscription amount and a billing period between 1 and 366 days.", true);
      return;
    }
    button.disabled = true;
    button.textContent = "Saving…";
    const result = await platformApiFetch("/billing/settings", {
      method: "PUT",
      body: JSON.stringify({ amount, intervalDays, shortcodeType }),
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

  const pause = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  async function handleBillingPrompt(store, button) {
    const settings = window.platformBillingUiState || {};
    if (!settings.darajaConfigured) {
      setAdminNotice("Daraja credentials are missing. Add them to the backend Worker secrets in Cloudflare first.", true);
      return;
    }
    if (!settings.amount || !settings.intervalDays) {
      setAdminNotice("Save a subscription amount and billing period first.", true);
      return;
    }
    let phoneNumber = store.ownerPhone || "";
    if (!phoneNumber) {
      phoneNumber = window.prompt("Enter the store owner’s Kenyan M-Pesa number:", "") || "";
      if (!phoneNumber.trim()) return;
    }
    const confirmed = await confirmDialog(
      `Send payment prompt to ${store.name}?`,
      `Daraja will send a KES ${Number(settings.amount).toLocaleString("en-KE")} M-Pesa prompt to ${phoneNumber}. A successful payment covers ${settings.intervalDays} days and reactivates a suspended store.`,
      false
    );
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Sending…";
    const result = await platformApiFetch(`/stores/${encodeURIComponent(store.id)}/billing/payment-prompt`, {
      method: "POST",
      body: JSON.stringify({ phoneNumber }),
    });
    button.disabled = false;
    button.textContent = "↗ M-Pesa prompt";
    if (!result.ok || !result.data.success) {
      if (result.status === 401) window.location.replace("./super-admin-login.html");
      setAdminNotice(result.data.error?.message || "Could not send the M-Pesa prompt.", true);
      return;
    }

    const { paymentId } = result.data.data;
    setAdminNotice(result.data.message || "M-Pesa prompt sent. Waiting for payment confirmation…");
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await pause(3000);
      const statusResult = await platformApiFetch(`/billing/payments/${encodeURIComponent(paymentId)}`);
      if (!statusResult.ok) break;
      const payment = statusResult.data.data;
      if (payment.status === "COMPLETED") {
        setAdminNotice(`Payment received${payment.receipt ? ` · M-Pesa receipt ${payment.receipt}` : ""}. The billing period has been extended.`);
        await loadDashboard();
        return;
      }
      if (payment.status === "FAILED") {
        setAdminNotice(payment.resultDesc || "The M-Pesa payment was not completed.", true);
        return;
      }
    }
    setAdminNotice("The M-Pesa prompt is still pending. Refresh the business directory shortly to see the result.");
  }

  async function handleStoreAction(button) {
    const store = stores.find((entry) => entry.id === button.dataset.storeId);
    if (!store) return;
    const action = button.dataset.storeAction;
    if (action === "payment-prompt") {
      await handleBillingPrompt(store, button);
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

    button.disabled = true;
    button.textContent = isApproval ? "Approving…" : isReactivation ? "Reactivating…" : "Suspending…";
    const result = await platformApiFetch(`/stores/${encodeURIComponent(store.id)}/${action}`, { method: "PATCH" });
    if (!result.ok || !result.data.success) {
      button.disabled = false;
      button.textContent = isApproval ? "Approve store" : isReactivation ? "Reactivate" : "Suspend";
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
      ui.rows.innerHTML = '<tr><td colspan="7" class="table-message">The business directory could not be loaded. Try refreshing.</td></tr>';
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
  document.querySelectorAll("[data-status-filter]").forEach((tab) => tab.addEventListener("click", () => {
    selectedStatus = tab.dataset.statusFilter;
    document.querySelectorAll("[data-status-filter]").forEach((other) => other.classList.toggle("is-selected", other === tab));
    renderStores();
  }));
  document.getElementById("refresh-button").addEventListener("click", () => void loadDashboard().catch((error) => setAdminNotice(error.message, true)));
  document.getElementById("save-billing-settings").addEventListener("click", () => void saveBillingSettings());
  document.getElementById("logout-button").addEventListener("click", async () => {
    const button = document.getElementById("logout-button");
    button.disabled = true;
    await platformApiFetch("/logout", { method: "POST" });
    window.location.replace("./super-admin-login.html");
  });
  void start();
})();
