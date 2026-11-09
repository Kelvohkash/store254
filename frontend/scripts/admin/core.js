  // ═══════════════════════════════════════
  // CONFIG
  // ═══════════════════════════════════════
  const isLocalDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.localhost');
  const API = `${isLocalDev ? 'http://localhost:8787' : ''}/api`;
  const host = window.location.hostname.toLowerCase();
  let tenantSlug = null;
  if (host.endsWith('.store254.co.ke')) {
    const sub = host.slice(0, -'.store254.co.ke'.length);
    if (sub && sub !== 'www' && sub !== 'api') tenantSlug = sub;
  } else if (host.endsWith('.localhost')) {
    const sub = host.slice(0, -'.localhost'.length);
    if (sub && sub !== 'www' && sub !== 'api') tenantSlug = sub;
  } else {
    const parts = host.split('.');
    tenantSlug = (parts.length >= 3 && parts[0] !== 'store254' && parts[0] !== 'www') ? parts[0] : null;
  }

  // ═══════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════
  // Remove legacy persisted owner credentials; the current token stays in memory only.
  localStorage.removeItem('store254_owner_token');
  let hasSession = false;
  let adminAccessToken = null;
  let allProducts = [];
  let allOrders = [];
  let flatCategories = [];
  let currentPage = 'dashboard';

  // ═══════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════
  function fmt(n) { return 'KES ' + Number(n).toLocaleString('en-KE'); }
  function ago(d) {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff/60000), h = Math.floor(m/60), days = Math.floor(h/24);
    return days > 0 ? `${days}d ago` : h > 0 ? `${h}h ago` : m > 0 ? `${m}m ago` : 'just now';
  }
  function statusBadge(s) {
    const cls = { PENDING_PAYMENT:'badge-status-pending', PROCESSING:'badge-status-confirmed', SHIPPED:'badge-status-confirmed', COMPLETED:'badge-status-completed', CANCELLED:'badge-status-cancelled' }[s] || 'bg-slate-100 text-slate-600';
    const safeStatus = ['PENDING_PAYMENT','PROCESSING','SHIPPED','COMPLETED','CANCELLED'].includes(s) ? s : 'UNKNOWN';
    return `<span class="text-[10px] font-black px-2 py-0.5 rounded-full border ${cls}">${safeStatus === 'COMPLETED' ? 'DELIVERED' : safeStatus}</span>`;
  }
  function showToast(msg, ok=true) {
    const el = document.getElementById('toast-top');
    el.textContent = msg;
    el.className = `text-xs font-semibold px-3 py-1.5 rounded-lg ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
  }
  function apiErrorMessage(response, fallback) {
    return response.data?.error?.message || response.data?.message || fallback;
  }
  function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
  function togglePasswordVis(inputId) {
    const inp = document.getElementById(inputId);
    inp.type = inp.type === 'password' ? 'text' : 'password';
  }

  async function apiFetch(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug;
    if (adminAccessToken && path !== '/auth/login') {
      headers.Authorization = `Bearer ${adminAccessToken}`;
    }
    try {
      // Store Admin requests use the short-lived token returned by /auth/login.
      // Do not send the broad-domain customer SSO cookie to owner-only endpoints.
      const r = await fetch(API + path, { ...opts, headers, credentials: 'omit' });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401 && hasSession && path !== '/auth/login') {
        handleLogout('Your session expired. Sign in again to continue.');
      }
      return { ok: r.ok, status: r.status, data };
    } catch(e) {
      return { ok: false, status: 0, data: { message: 'Network error' } };
    }
  }

  // ═══════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════
  async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    btn.disabled = true; btn.innerHTML = '<svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Signing in...';
    errEl.classList.add('hidden');

    const r = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('login-email').value.trim(),
        password: document.getElementById('login-password').value,
      })
    });

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i><span>Sign In to Admin</span>';
    lucide.createIcons();

    const respData = r.data?.data;
    if (!r.ok || !respData?.user || !respData?.accessToken) {
      errEl.textContent = apiErrorMessage(r, 'Invalid email or password.');
      errEl.classList.remove('hidden');
      return;
    }

    const userData = respData.user;
    // Only OWNER or ADMIN can use this dashboard
    if (!['OWNER', 'ADMIN'].includes(userData?.role)) {
      errEl.textContent = 'You do not have admin access to this store.';
      errEl.classList.remove('hidden');
      return;
    }

    adminAccessToken = respData.accessToken;
    hasSession = true;
    bootApp(userData);
  }

  function handleLogout(message = '') {
    adminAccessToken = null;
    hasSession = false;
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    const errEl = document.getElementById('login-error');
    if (message) {
      errEl.textContent = message;
      errEl.classList.remove('hidden');
    }
  }

  // ═══════════════════════════════════════
  // BOOT
  // ═══════════════════════════════════════
  async function bootApp(user) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('flex');

    if (user) {
      document.getElementById('sidebar-user-name').textContent = user.fullName || user.email;
      document.getElementById('sidebar-user-role').textContent = user.role;
    }

    // Fetch store profile
    const profileRes = await apiFetch('/store');
    if (profileRes.ok && profileRes.data?.data) {
      const st = profileRes.data.data;
      const name = st.name || tenantSlug;
      document.getElementById('sidebar-store-name').textContent = name;
      document.getElementById('login-store-name').textContent = name;
      document.title = `${name} — Admin`;
    }

    await loadDashboard();
    lucide.createIcons();
  }

  // ═══════════════════════════════════════
  // PAGE SWITCHING
  // ═══════════════════════════════════════
  function toggleAdminSidebar(forceOpen) {
    const sidebar = document.getElementById('mobile-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;

    const shouldOpen = typeof forceOpen === 'boolean'
      ? forceOpen
      : !sidebar.classList.contains('is-open');
    sidebar.classList.toggle('is-open', shouldOpen);
    backdrop.classList.toggle('is-visible', shouldOpen);
  }

  function showPage(name) {
    toggleAdminSidebar(false);
    ['dashboard','products','categories','orders','settings','payments'].forEach(p => {
      const el = document.getElementById(`page-${p}`);
      if (el) el.classList.toggle('hidden', p !== name);
      const nav = document.getElementById(`nav-${p}`);
      if (nav) nav.classList.toggle('active', p === name);
    });
    const titles = { dashboard:'Dashboard', products:'Products', categories:'Categories', orders:'Orders', settings:'Store Settings', payments:'M-Pesa & Payments' };
    const subs = { dashboard:'Overview of your store activity', products:'Manage your product catalog', categories:'Organise products into categories', orders:'View and manage customer orders', settings:'Update your store profile', payments:'Configure M-Pesa payment credentials' };
    document.getElementById('page-title').textContent = titles[name] || name;
    document.getElementById('page-subtitle').textContent = subs[name] || '';
    currentPage = name;

    if (name === 'products') loadProducts();
    if (name === 'categories') loadCategories();
    if (name === 'orders') loadOrders();
    if (name === 'settings') loadSettings();
    if (name === 'payments') loadPaymentSettings();
    lucide.createIcons();
  }

  // ═══════════════════════════════════════
  
