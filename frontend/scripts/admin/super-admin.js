(() => {
  const apiBase =
    ["localhost", "127.0.0.1"].includes(window.location.hostname) ||
    window.location.hostname.endsWith(".localhost")
      ? "http://localhost:8787"
      : window.location.origin;
  const ui = {
    app: document.getElementById("admin-app"),
    loading: document.getElementById("admin-loading"),
    rows: document.getElementById("business-rows"),
    empty: document.getElementById("empty-state"),
    search: document.getElementById("business-search"),
    notice: document.getElementById("notice"),
  };
  let stores = [];
  let selectedStatus = "ALL";

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const formatCategory = (value) => String(value || "Independent business").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric" }).format(date);
  };
  const money = (value) => `KES ${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

  async function api(path, options = {}) {
    try {
      const response = await fetch(`${apiBase}/api/platform/admin${path}`, {
        ...options,
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json", ...(options.headers || {}) },
      });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data };
    } catch {
      return { ok: false, status: 0, data: { error: { message: "Could not connect to Store254. Check your connection and try again." } } };
    }
  }

  function setNotice(message, isError = false) {
    ui.notice.textContent = message;
    ui.notice.classList.toggle("is-error", isError);
    ui.notice.hidden = !message;
  }

  function renderMetrics(stats) {
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

  async function loadStores() {
    ui.rows.innerHTML = '<tr><td colspan="6" class="table-message">Loading registered businesses…</td></tr>';
    ui.empty.hidden = true;
    const collected = [];
    let page = 1;
    while (page <= 100) {
      const result = await api(`/stores?page=${page}&limit=100`);
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

  function rowMarkup(store) {
    const name = store.name || "Unnamed business";
    const slug = /^[a-z0-9-]+$/i.test(store.subdomain || "") ? store.subdomain : "";
    const storeUrl = slug ? `https://${slug}.store254.co.ke/` : "";
    const status = ["ACTIVE", "PENDING", "SUSPENDED"].includes(store.status) ? store.status : "UNKNOWN";
    const statusLabel = { ACTIVE: "Active", PENDING: "Needs review", SUSPENDED: "Suspended", UNKNOWN: "Unknown" }[status];
    const category = formatCategory(store.businessType);
    const action = status === "PENDING"
      ? `<button class="row-action" type="button" data-store-action="activate" data-store-id="${escapeHtml(store.id)}">Approve store</button>`
      : status === "ACTIVE"
        ? `<button class="row-action is-danger" type="button" data-store-action="deactivate" data-store-id="${escapeHtml(store.id)}">Suspend</button>`
        : '<span aria-label="No available action">—</span>';
    return `<tr>
      <td><div class="business-cell"><span class="business-avatar" aria-hidden="true">${escapeHtml(name.trim().slice(0, 1).toUpperCase() || "S")}</span><span><strong class="business-name">${escapeHtml(name)}</strong><small class="business-type">${escapeHtml(category)}</small></span></div></td>
      <td>${storeUrl ? `<a class="store-link" href="${storeUrl}" target="_blank" rel="noopener">${escapeHtml(slug)}.store254.co.ke ↗</a>` : "—"}</td>
      <td>${escapeHtml(category)}</td>
      <td class="date-cell">${escapeHtml(formatDate(store.createdAt))}</td>
      <td><span class="status-badge status-${status.toLowerCase()}">${escapeHtml(statusLabel)}</span></td>
      <td class="actions-cell">${action}</td>
    </tr>`;
  }

  function renderStores() {
    const query = ui.search.value.trim().toLowerCase();
    const visible = stores.filter((store) => {
      const matchesStatus = selectedStatus === "ALL" || store.status === selectedStatus;
      const matchesQuery = !query || `${store.name || ""} ${store.subdomain || ""} ${store.businessType || ""}`.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
    document.getElementById("result-count").textContent = `${visible.length} ${visible.length === 1 ? "business" : "businesses"}`;
    ui.rows.innerHTML = visible.map(rowMarkup).join("");
    ui.empty.hidden = visible.length > 0;
    ui.rows.hidden = visible.length === 0;
    ui.rows.querySelectorAll("[data-store-action]").forEach((button) => button.addEventListener("click", () => void handleStoreAction(button)));
  }

  async function loadDashboard() {
    const [statsResult] = await Promise.all([api("/stats"), loadStores()]);
    if (!statsResult.ok || !statsResult.data.success) {
      if (statsResult.status === 401) window.location.replace("./super-admin-login.html");
      throw new Error(statsResult.data.error?.message || "Could not load marketplace overview.");
    }
    renderMetrics(statsResult.data.data);
    setNotice("");
  }

  async function handleStoreAction(button) {
    const store = stores.find((entry) => entry.id === button.dataset.storeId);
    if (!store) return;
    const action = button.dataset.storeAction;
    const isApproval = action === "activate";
    const prompt = isApproval
      ? `Approve ${store.name}? This makes the storefront live and notifies its owner.`
      : `Suspend ${store.name}? Customers will no longer be able to use this storefront.`;
    if (!window.confirm(prompt)) return;

    button.disabled = true;
    button.textContent = isApproval ? "Approving…" : "Suspending…";
    const result = await api(`/stores/${encodeURIComponent(store.id)}/${action}`, { method: "PATCH" });
    if (!result.ok || !result.data.success) {
      button.disabled = false;
      button.textContent = isApproval ? "Approve store" : "Suspend";
      if (result.status === 401) {
        window.location.replace("./super-admin-login.html");
        return;
      }
      setNotice(result.data.error?.message || `Could not ${isApproval ? "approve" : "suspend"} this business.`, true);
      return;
    }
    setNotice(result.data.message || `${store.name} has been updated.`);
    await loadDashboard();
  }

  async function start() {
    document.getElementById("footer-date").textContent = new Intl.DateTimeFormat("en-KE", { year: "numeric" }).format(new Date());
    const session = await fetch(`${apiBase}/api/platform/admin/me`, { credentials: "include", headers: { Accept: "application/json" } }).catch(() => null);
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
      setNotice(error.message || "Could not load platform data.", true);
      ui.rows.innerHTML = '<tr><td colspan="6" class="table-message">The business directory could not be loaded. Try refreshing.</td></tr>';
    }
  }

  ui.search.addEventListener("input", renderStores);
  document.querySelectorAll("[data-status-filter]").forEach((tab) => tab.addEventListener("click", () => {
    selectedStatus = tab.dataset.statusFilter;
    document.querySelectorAll("[data-status-filter]").forEach((other) => other.classList.toggle("is-selected", other === tab));
    renderStores();
  }));
  document.getElementById("refresh-button").addEventListener("click", () => void loadDashboard().catch((error) => setNotice(error.message, true)));
  document.getElementById("logout-button").addEventListener("click", async () => {
    const button = document.getElementById("logout-button");
    button.disabled = true;
    await api("/logout", { method: "POST" });
    window.location.replace("./super-admin-login.html");
  });
  void start();
})();
