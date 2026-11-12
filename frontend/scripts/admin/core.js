// CONFIG & STATE
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
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), days = Math.floor(h / 24);
  return days > 0 ? `${days}d ago` : h > 0 ? `${h}h ago` : m > 0 ? `${m}m ago` : 'just now';
}
function statusBadge(s) {
  const cls = { PENDING_PAYMENT: 'badge-status-pending', PROCESSING: 'badge-status-confirmed', SHIPPED: 'badge-status-confirmed', COMPLETED: 'badge-status-completed', CANCELLED: 'badge-status-cancelled' }[s] || 'bg-slate-100 text-slate-600';
  const safeStatus = ['PENDING_PAYMENT', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'].includes(s) ? s : 'UNKNOWN';
  return `<span class="text-[10px] font-black px-2 py-0.5 rounded-full border ${cls}">${safeStatus === 'COMPLETED' ? 'DELIVERED' : safeStatus}</span>`;
}
function showToast(msg, ok = true) {
  const el = document.getElementById('toast-top');
  if (!el) return;
  el.textContent = msg;
  el.className = `text-xs font-semibold px-3 py-1.5 rounded-lg ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}
function apiErrorMessage(response, fallback) {
  return response.data?.error?.message || response.data?.message || fallback;
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}
function togglePasswordVis(inputId) {
  const inp = document.getElementById(inputId);
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}
function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function inlineJs(value) {
  return JSON.stringify(String(value ?? '')).replace(/[<>&"]/g, ch => ({ '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '"': '&quot;' })[ch]);
}

async function apiFetch(path, opts = {}) {
  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  const headers = isFormData ? { ...(opts.headers || {}) } : { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug;
  if (adminAccessToken && path !== '/auth/login') {
    headers.Authorization = `Bearer ${adminAccessToken}`;
  }
  try {
    const r = await fetch(API + path, { ...opts, headers, credentials: 'include' });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && hasSession && path !== '/auth/login' && path !== '/auth/logout') {
      handleLogout('Your session expired. Sign in again to continue.');
    }
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
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
  btn.disabled = true;
  btn.innerHTML = '<svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Signing in...';
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

async function handleLogout(message = '') {
  const hadSession = hasSession || Boolean(adminAccessToken);
  adminAccessToken = null;
  hasSession = false;
  if (hadSession && !message) {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
  }
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

  const setStoreNames = (name) => {
    ['sidebar-store-name', 'login-store-name', 'mobile-topbar-store-name', 'mobile-welcome-store', 'mobile-menu-store-name'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = name;
    });
    document.title = `${name} — Admin`;
  };

  if (user) {
    const displayName = user.fullName || user.email || 'Owner';
    const sidebarUser = document.getElementById('sidebar-user-name');
    if (sidebarUser) sidebarUser.textContent = displayName;
    const sidebarRole = document.getElementById('sidebar-user-role');
    if (sidebarRole) sidebarRole.textContent = user.role || 'OWNER';
    const mobileUser = document.getElementById('mobile-menu-user-name');
    if (mobileUser) mobileUser.textContent = displayName;
  }

  const subscription = typeof loadStoreSubscription === 'function'
    ? await loadStoreSubscription()
    : null;
  const isSuspended = subscription?.storeStatus === 'SUSPENDED';
  if (subscription?.storeName) {
    setStoreNames(subscription.storeName);
  }

  // A suspended store can still reach the admin dashboard to pay and reactivate.
  if (!isSuspended) {
    const profileRes = await apiFetch('/store');
    if (profileRes.ok && profileRes.data?.data) {
      const st = profileRes.data.data;
      const name = st.name || tenantSlug || 'My Store';
      setStoreNames(name);
    }
  }

  if (!isSuspended && typeof loadDashboard === 'function') {
    await loadDashboard();
  }
  lucide.createIcons();
}
