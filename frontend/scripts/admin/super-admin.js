// SUPER ADMIN DASHBOARD CONTROLLER
// ═══════════════════════════════════════

(() => {
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

  async function handleStoreAction(button) {
    const store = stores.find((entry) => entry.id === button.dataset.storeId);
    if (!store) return;
    const action = button.dataset.storeAction;
    const isApproval = action === "activate";
    const title = isApproval ? `Approve ${store.name}?` : `Suspend ${store.name}?`;
    const message = isApproval
      ? `This will immediately make the storefront live at https://${store.subdomain}.store254.co.ke/ and notify the merchant.`
      : `Customers will no longer be able to browse or place orders on this storefront until re-activated.`;

    const confirmed = await confirmDialog(title, message, !isApproval);
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = isApproval ? "Approving…" : "Suspending…";
    const result = await platformApiFetch(`/stores/${encodeURIComponent(store.id)}/${action}`, { method: "PATCH" });
    if (!result.ok || !result.data.success) {
      button.disabled = false;
      button.textContent = isApproval ? "Approve store" : "Suspend";
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
  document.getElementById("logout-button").addEventListener("click", async () => {
    const button = document.getElementById("logout-button");
    button.disabled = true;
    await platformApiFetch("/logout", { method: "POST" });
    window.location.replace("./super-admin-login.html");
  });
  void start();
})();
