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

let mobilePageReturnTo = 'dashboard';

function showPage(name) {
  if ((name === 'settings' || name === 'payments') && currentPage !== 'settings' && currentPage !== 'payments') {
    mobilePageReturnTo = currentPage || 'dashboard';
  }
  toggleAdminSidebar(false);
  toggleMobileAdminMenu(false);
  ['dashboard', 'products', 'categories', 'orders', 'settings', 'payments'].forEach(p => {
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
    settings: 'Store Settings',
    payments: 'M-Pesa & Payments',
  };
  const subs = {
    dashboard: 'Overview of your store activity',
    products: 'Manage your product catalog',
    categories: 'Organise products into categories',
    orders: 'View and manage customer orders',
    settings: 'Update your store profile and design',
    payments: 'Configure M-Pesa payment credentials',
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[name] || name;
  const subEl = document.getElementById('page-subtitle');
  if (subEl) subEl.textContent = subs[name] || '';
  const mobileInd = document.getElementById('mobile-page-indicator');
  if (mobileInd) mobileInd.textContent = titles[name] || name;
  currentPage = name;
  document.body.classList.toggle('admin-page-open', name === 'settings' || name === 'payments');
  ['dashboard', 'products', 'categories', 'orders'].forEach((page) => {
    document.getElementById(`mobile-nav-${page}`)?.classList.toggle('active', page === name);
  });
  document.getElementById('mobile-nav-more')?.classList.toggle('active', name === 'settings' || name === 'payments');
  
  const headerAddBtn = document.getElementById('header-add-product');
  if (headerAddBtn) {
    if (name === 'categories') {
      headerAddBtn.innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i><span>Category</span>';
      headerAddBtn.onclick = () => { if (typeof openAddCategoryModal === 'function') openAddCategoryModal(); };
      headerAddBtn.classList.remove('hidden');
    } else if (name === 'settings' || name === 'payments') {
      headerAddBtn.classList.add('hidden');
    } else {
      headerAddBtn.innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i><span>Add Product</span>';
      headerAddBtn.onclick = () => { showPage('products'); setTimeout(openAddProductModal, 100); };
      headerAddBtn.classList.remove('hidden');
    }
  }

  if (name === 'products' && typeof loadProducts === 'function') loadProducts();
  if (name === 'categories' && typeof loadCategories === 'function') loadCategories();
  if (name === 'orders' && typeof loadOrders === 'function') loadOrders();
  if (name === 'settings' && typeof loadSettings === 'function') loadSettings();
  if (name === 'payments' && typeof loadPaymentSettings === 'function') loadPaymentSettings();
  if (window.lucide?.createIcons) lucide.createIcons();
}

function closeMobileAdminPage() {
  showPage(mobilePageReturnTo || 'dashboard');
}

function toggleMobileAdminMenu(forceOpen) {
  const menu = document.getElementById('mobile-admin-menu');
  if (!menu) return;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !shouldOpen);
  document.body.classList.toggle('admin-menu-open', shouldOpen);
  if (shouldOpen && window.lucide?.createIcons) lucide.createIcons();
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ['product-modal', 'category-modal', 'attribute-modal', 'order-drawer'].forEach(id => {
      document.getElementById(id)?.classList.add('hidden');
    });
    toggleMobileAdminMenu(false);
  }
});
