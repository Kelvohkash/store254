// PAGE NAVIGATION & SIDEBAR
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
  ['dashboard', 'products', 'categories', 'orders', 'promotions', 'settings', 'payments'].forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.toggle('hidden', p !== name);
    const nav = document.getElementById(`nav-${p}`);
    if (nav) nav.classList.toggle('active', p === name);
  });
  const titles = {
    dashboard: 'Dashboard',
    products: 'Products',
    categories: 'Categories',
    orders: 'Orders',
    promotions: 'Promotions & Coupons',
    settings: 'Store Settings',
    payments: 'M-Pesa & Payments',
  };
  const subs = {
    dashboard: 'Overview of your store activity',
    products: 'Manage your product catalog',
    categories: 'Organise products into categories',
    orders: 'View and manage customer orders',
    promotions: 'Manage discount codes and offers',
    settings: 'Update your store profile and design',
    payments: 'Configure M-Pesa payment credentials',
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[name] || name;
  const subEl = document.getElementById('page-subtitle');
  if (subEl) subEl.textContent = subs[name] || '';
  currentPage = name;

  if (name === 'products' && typeof loadProducts === 'function') loadProducts();
  if (name === 'categories' && typeof loadCategories === 'function') loadCategories();
  if (name === 'orders' && typeof loadOrders === 'function') loadOrders();
  if (name === 'promotions' && typeof loadPromotions === 'function') loadPromotions();
  if (name === 'settings' && typeof loadSettings === 'function') loadSettings();
  if (name === 'payments' && typeof loadPaymentSettings === 'function') loadPaymentSettings();
  if (window.lucide?.createIcons) lucide.createIcons();
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ['product-modal', 'category-modal', 'promo-modal', 'order-drawer'].forEach(id => {
      document.getElementById(id)?.classList.add('hidden');
    });
  }
});
