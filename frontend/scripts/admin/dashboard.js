// DASHBOARD
  // ═══════════════════════════════════════
  async function loadDashboard() {
    const [prodRes, orderRes, statsRes] = await Promise.all([
      apiFetch('/items?limit=100&includeAll=true'),
      apiFetch('/orders?limit=50'),
      apiFetch('/store/settings/stats'),
    ]);

    const rawProducts = prodRes.ok ? (prodRes.data?.data?.items || prodRes.data?.data || []) : [];
    const rawOrders = orderRes.ok ? (orderRes.data?.data?.orders || orderRes.data?.data || []) : [];
    const stats = statsRes.ok ? statsRes.data?.data : null;

    allProducts = Array.isArray(rawProducts) ? rawProducts : [];
    allOrders = Array.isArray(rawOrders) ? rawOrders : [];

    const pending = stats?.pendingOrders ?? allOrders.filter(o => o.status === 'PENDING_PAYMENT' || o.status === 'PROCESSING').length;
    const revenue = stats?.totalRevenue ?? allOrders.filter(o => o.status === 'COMPLETED' || o.paymentStatus === 'PAID').reduce((s, o) => s + (o.totalAmount || 0), 0);

    document.getElementById('stat-products').textContent = stats?.totalProducts ?? allProducts.length;
    document.getElementById('stat-orders').textContent = stats?.totalOrders ?? allOrders.length;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-revenue').textContent = fmt(revenue);

    // Pending badge in sidebar and mobile navigation
    const badge = document.getElementById('sidebar-pending-badge');
    if (badge) {
      if (pending > 0) { badge.textContent = pending; badge.classList.remove('hidden'); }
      else { badge.classList.add('hidden'); }
    }
    const mobileOrdersBadge = document.getElementById('mobile-nav-orders-badge');
    if (mobileOrdersBadge) {
      if (pending > 0) { mobileOrdersBadge.textContent = pending; mobileOrdersBadge.classList.remove('hidden'); }
      else { mobileOrdersBadge.classList.add('hidden'); }
    }
    const mobileQuickBadge = document.getElementById('mobile-quick-orders-badge');
    if (mobileQuickBadge) {
      mobileQuickBadge.classList.toggle('hidden', pending <= 0);
    }

    // Recent orders
    const container = document.getElementById('dashboard-recent-orders');
    const recent = [...allOrders].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    if (recent.length === 0) {
      container.innerHTML = '<p class="text-sm text-slate-400 text-center py-4">No orders yet.</p>';
    } else {
      container.innerHTML = recent.map(o => `
        <div class="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 rounded-xl px-2 -mx-2" onclick="openOrderDrawer(${inlineJs(o.id)})">
          <div>
            <p class="text-sm font-bold text-slate-900">#${escHtml(o.orderNumber || String(o.id).slice(0,8).toUpperCase())}</p>
            <p class="text-xs text-slate-400">${escHtml(o.customerEmail || 'Guest')} · ${ago(o.createdAt)}</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-black text-slate-900">${fmt(o.totalAmount || 0)}</p>
            ${statusBadge(o.status)}
          </div>
        </div>
      `).join('');
    }
    lucide.createIcons();
  }

  // ═══════════════════════════════════════
  