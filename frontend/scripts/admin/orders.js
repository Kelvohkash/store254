// ORDERS
  // ═══════════════════════════════════════
  async function loadOrders() {
    const r = await apiFetch('/orders?limit=100');
    allOrders = r.ok ? (r.data?.data?.orders || r.data?.data || []) : [];
    renderOrdersTable(allOrders);
  }

  function filterOrders(status) {
    renderOrdersTable(status ? allOrders.filter(o => o.status === status) : allOrders);
    // Highlight active filter btn
    ['','PENDING_PAYMENT','PROCESSING','SHIPPED','COMPLETED','CANCELLED'].forEach(s => {
      const btn = document.getElementById(`order-filter-${s || 'all'}`);
      if (btn) btn.className = `text-xs ${status === s ? 'btn-primary' : 'btn-secondary'}`;
    });
  }

  function renderOrdersTable(orders) {
    const tbody = document.getElementById('orders-table-body');
    if (!orders.length) { tbody.innerHTML = '<tr><td colspan="7" class="px-5 py-10 text-center text-slate-400">No orders found.</td></tr>'; return; }
    tbody.innerHTML = orders.map(o => `
      <tr class="hover:bg-slate-50 transition-colors cursor-pointer admin-order-row" onclick="openOrderDrawer(${inlineJs(o.id)})">
        <td data-label="Order" class="px-5 py-3 font-mono font-black text-slate-900 text-xs">
          <span class="order-id-badge">#${escHtml((o.orderNumber || String(o.id).slice(0,8)).toUpperCase())}</span>
        </td>
        <td data-label="Customer" class="px-5 py-3">
          <div class="order-customer-cell flex items-center gap-2.5">
            <div class="order-customer-avatar w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center justify-center shrink-0">
              ${escHtml((o.customerName || 'G').trim().slice(0, 1).toUpperCase())}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-bold text-slate-900 truncate">${escHtml(o.customerName || 'Guest')}</p>
              <p class="text-xs text-slate-400 truncate">${escHtml(o.customerEmail || 'No email')}</p>
            </div>
          </div>
        </td>
        <td data-label="Items" class="px-5 py-3 text-xs text-slate-500">
          <span class="order-items-badge inline-flex items-center gap-1 font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full text-[11px]">
            ${(o.items || o.orderItems || []).length} item(s)
          </span>
        </td>
        <td data-label="Total" class="px-5 py-3 font-black text-slate-900 text-sm">
          <div class="order-total-cell">
            <span class="order-total-label hidden text-xs font-semibold text-slate-500 mr-1">Total:</span>
            <span class="order-total-val font-black text-emerald-700 text-sm">${fmt(o.totalAmount || 0)}</span>
          </div>
        </td>
        <td data-label="Payment" class="px-5 py-3">
          <div class="order-payment-box flex items-center justify-between gap-2">
            <span class="order-payment-method text-[11px] font-bold text-slate-700">${o.paymentMethod === 'CASH_ON_DELIVERY' ? 'Pay on delivery' : 'M-Pesa'}</span>
            <span class="text-[10px] font-black px-2 py-0.5 rounded-full border ${o.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}">${escHtml(o.paymentStatus || 'UNPAID')}</span>
          </div>
        </td>
        <td data-label="Status" class="px-5 py-3">
          <div class="order-status-wrap">
            ${statusBadge(o.status)}
          </div>
        </td>
        <td data-label="Update" class="px-5 py-3 text-right" onclick="event.stopPropagation()">
          <div class="order-update-wrap">
            ${o.status === 'COMPLETED'
              ? '<span class="text-[10px] font-semibold text-slate-400">Customer confirmed</span>'
              : `<select onchange="updateOrderStatus('${escHtml(o.id)}', this.value)" class="order-status-select text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white shadow-sm">
                  ${['PROCESSING','SHIPPED','CANCELLED'].map(s => `<option ${o.status===s?'selected':''} value="${s}">${s}</option>`).join('')}
                </select>`}
          </div>
        </td>
      </tr>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  async function updateOrderStatus(orderId, newStatus) {
    const r = await apiFetch(`/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
    if (r.ok) {
      showToast(`Order updated to ${newStatus}`);
      const o = allOrders.find(x=>x.id===orderId);
      if (o) {
        o.status = newStatus;
        if (r.data?.data?.paymentStatus) o.paymentStatus = r.data.data.paymentStatus;
      }
      renderOrdersTable(allOrders);
    }
    else showToast(apiErrorMessage(r, 'Failed to update status.'), false);
  }

  async function markOrderPaid(orderId) {
    const r = await apiFetch(`/orders/${orderId}/payment-status`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentStatus: 'PAID' })
    });
    if (!r.ok) {
      showToast(apiErrorMessage(r, 'Could not record this payment.'), false);
      return;
    }

    const order = allOrders.find(item => item.id === orderId);
    if (order) order.paymentStatus = 'PAID';
    showToast('Cash payment recorded.');
    renderOrdersTable(allOrders);
    openOrderDrawer(orderId);
  }

  async function showOrderPaymentInstructions(orderId) {
    const r = await apiFetch(`/orders/${orderId}/payment-instructions`, { method: 'POST' });
    if (!r.ok) {
      showToast(apiErrorMessage(r, 'Could not enable payment instructions.'), false);
      return;
    }

    const instruction = r.data?.data;
    const paymentType = instruction?.shortcodeType === 'PAYBILL' ? 'Paybill' : 'Till';
    showToast(`${paymentType} instructions are now visible in the customer account.`);
    const order = allOrders.find(item => item.id === orderId);
    if (order) {
      order.fulfillmentDetails = {
        ...(order.fulfillmentDetails || {}),
        paymentInstructionsVisible: true
      };
    }
    openOrderDrawer(orderId);
  }

  async function sendOrderPaymentPrompt(orderId) {
    const r = await apiFetch(`/orders/${orderId}/payment-prompt`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    if (!r.ok) {
      showToast(apiErrorMessage(r, 'Could not send the M-Pesa prompt.'), false);
      return;
    }

    showToast(r.data?.message || 'M-Pesa prompt sent.');
  }

  function openOrderDrawer(id) {
    const o = allOrders.find(x => x.id === id);
    if (!o) return;
    const drawer = document.getElementById('order-drawer');
    const items = o.items || o.orderItems || [];
    const deliveryAddress = typeof o.shippingAddress?.address === 'string'
      ? o.shippingAddress.address
      : o.deliveryAddress;
    document.getElementById('order-drawer-content').innerHTML = `
      <div class="bg-slate-50 rounded-2xl p-4">
        <div class="flex justify-between items-start">
          <div>
            <p class="font-black text-slate-900 font-mono">#${escHtml((o.orderNumber||o.id.slice(0,8)).toUpperCase())}</p>
            <p class="text-xs text-slate-500 mt-0.5">${new Date(o.createdAt).toLocaleString('en-KE')}</p>
          </div>
          ${statusBadge(o.status)}
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 p-4">
        <p class="text-xs font-black text-slate-500 uppercase mb-3">Customer</p>
        <p class="font-bold text-slate-900">${escHtml(o.customerName || 'Guest')}</p>
        ${o.customerEmail ? `<p class="text-xs text-slate-500">${escHtml(o.customerEmail)}</p>` : ''}
        ${o.customerPhone ? `<p class="text-xs text-slate-500"><a href="tel:${escHtml(o.customerPhone)}" class="text-emerald-600 font-semibold hover:underline">${escHtml(o.customerPhone)}</a></p>` : ''}
        ${deliveryAddress ? `<p class="text-xs text-slate-600 mt-2"><strong>Delivery address:</strong> ${escHtml(deliveryAddress)}</p>` : ''}
        <p class="text-xs text-slate-600 mt-2"><strong>Payment:</strong> ${o.paymentMethod === 'CASH_ON_DELIVERY' ? 'Cash on delivery' : 'M-Pesa'} · ${escHtml(o.paymentStatus || 'PENDING')}</p>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 p-4">
        <p class="text-xs font-black text-slate-500 uppercase mb-3">Items (${items.length})</p>
        <div class="space-y-2">
          ${items.map(it => `
            <div class="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
              <div>
                <p class="text-sm font-bold text-slate-900">${escHtml(it.title || it.itemTitle || 'Item')}</p>
                <p class="text-xs text-slate-400">Qty: ${it.quantity || 1}</p>
              </div>
              <p class="font-black text-slate-900 text-sm">${fmt((it.unitPrice||it.price||0) * (it.quantity||1))}</p>
            </div>
          `).join('')}
        </div>
        <div class="flex justify-between items-center mt-3 pt-3 border-t border-slate-200">
          <p class="font-black text-slate-900">Total</p>
          <p class="font-black text-emerald-700 text-lg">${fmt(o.totalAmount||0)}</p>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 p-4">
        ${o.status === 'COMPLETED'
          ? '<p class="text-xs font-black text-emerald-700 uppercase">Delivery confirmed by customer</p>'
          : `<p class="text-xs font-black text-slate-500 uppercase mb-3">Update Status</p>
            <div class="grid grid-cols-2 gap-2">
              ${['PROCESSING','SHIPPED','CANCELLED'].map(s => `
                <button onclick="updateOrderStatus(${inlineJs(o.id)},'${s}'); document.getElementById('order-drawer').classList.add('hidden');" class="py-2 text-xs font-black rounded-xl border ${o.status===s ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 text-slate-700 hover:bg-slate-50'} transition-all">${s}</button>
              `).join('')}
            </div>`}
      </div>
      ${o.paymentMethod === 'CASH_ON_DELIVERY' && o.paymentStatus !== 'PAID' && o.status !== 'CANCELLED' ? `
        ${o.status === 'COMPLETED' ? `
          <div class="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-2">
            <p class="text-xs font-black text-indigo-900">Collect payment</p>
            <button onclick="showOrderPaymentInstructions(${inlineJs(o.id)})" class="w-full py-2.5 bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold rounded-xl transition-colors">
              Show customer M-Pesa instructions
            </button>
            <button onclick="sendOrderPaymentPrompt(${inlineJs(o.id)})" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors">
              Send M-Pesa prompt to ${escHtml(o.customerPhone || 'customer')}
            </button>
            ${o.status === 'COMPLETED' ? `
              <button onclick="markOrderPaid(${inlineJs(o.id)})" class="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors">
                Record payment received · ${fmt(o.totalAmount || 0)}
              </button>
            ` : ''}
          </div>
        ` : o.status === 'SHIPPED'
          ? '<p class="text-[11px] text-slate-500">Waiting for the customer to confirm delivery before collecting payment.</p>'
          : '<p class="text-[11px] text-slate-500">Mark this order as shipped so the customer can confirm delivery.</p>'}
      ` : ''}
    `;
    drawer.classList.remove('hidden');
    lucide.createIcons();
  }

  // ═══════════════════════════════════════
