// Customer Order Tracking & Delivery Confirmation

async function confirmOrderDelivered(orderId, orderNumber, phoneNumber) {
  if (!window.confirm(`Confirm that order #${orderNumber} has been delivered to you?`)) return;

  const result = await apiFetch(`/api/orders/${orderId}/confirm-delivery`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!result.ok || !result.data?.success) {
    showToast(result.data?.error?.message || "Could not confirm delivery. Please try again.", "error");
    return;
  }

  await loadMyOrders();
  const payment = result.data.data;
  if (payment?.checkoutRequestId) {
    toggleDrawer("orders-drawer", false);
    openMpesaPinModal(
      payment.checkoutRequestId,
      payment.orderNumber || orderNumber,
      payment.totalAmount,
      payment.phoneNumber || phoneNumber,
      payment.paymentStatusToken
    );
    return;
  }
  showToast(result.data.message || "Delivery confirmed.");
}

async function loadMyOrders() {
  const container = document.getElementById("my-orders-container");
  if (!container) return;
  renderCustomerAuth();

  let profileRes = await apiFetch("/api/auth/me");
  if (state.customerToken && profileRes.status === 401) {
    clearCustomerSession();
    profileRes = await apiFetch("/api/auth/me");
  }
  if (!profileRes.ok || !profileRes.data?.success || profileRes.data.data?.role !== "CUSTOMER") {
    const invalidSession = [401, 404].includes(profileRes.status) ||
      (profileRes.ok && profileRes.data?.success && profileRes.data.data?.role !== "CUSTOMER");
    if (invalidSession) {
      clearCustomerSession();
      state.myOrders = [];
      renderCustomerAuth();
      void initializeGoogleSignIn();
      container.innerHTML = `
        <p class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Sign in with Google to view your order history.
        </p>
      `;
    } else {
      container.innerHTML = `
        <p class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          We couldn't verify your profile right now. Check your connection and try again.
        </p>
      `;
    }
    return;
  }

  const profile = profileRes.data.data;
  if (!profile || profile.role !== "CUSTOMER") {
    container.innerHTML = `
      <p class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
        The customer profile response was invalid. Please try again.
      </p>
    `;
    return;
  }
  persistCustomerSession(profile, state.customerToken || null);
  renderCustomerAuth();

  const res = await apiFetch("/api/orders/my-orders");
  if (res.ok && res.data.success) {
    state.myOrders = res.data.data;
    renderCustomerAuth();
    if (state.myOrders.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center text-slate-400">
          <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-300">
            <i data-lucide="package-check" class="w-6 h-6"></i>
          </div>
          <p class="text-xs font-semibold text-slate-600">No past orders found.</p>
        </div>
      `;
      renderIcons();
      return;
    }

    let html = "";
    for (const order of state.myOrders) {
      html += `
        <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-2.5 text-xs">
          <div class="flex justify-between items-center mb-1.5">
            <span class="font-bold font-mono text-slate-900">#${escapeHtml(order.orderNumber)}</span>
            <span class="px-2 py-0.5 rounded font-bold text-[10px] ${
              order.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
            }">${order.status === "COMPLETED" ? "DELIVERED" : escapeHtml(order.status)}</span>
          </div>
          <p class="text-slate-600">Total: <strong>KES ${Number(order.totalAmount).toLocaleString()}</strong></p>
          <p class="text-slate-600 mt-1">
            Payment: <strong>${order.paymentMethod === "CASH_ON_DELIVERY" ? "Cash on delivery" : "M-Pesa"} · ${order.paymentStatus === "PAID" ? "Paid" : "Payment due"}</strong>
          </p>
          ${
            order.status === "SHIPPED"
              ? `<button type="button" onclick="confirmOrderDelivered('${escapeHtml(order.id)}', '${escapeHtml(order.orderNumber)}', '${escapeHtml(order.customerPhone || "")}')" class="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-700">
                  <i data-lucide="package-check" class="mr-1 inline h-4 w-4 align-text-bottom"></i>
                  I received this order · Confirm delivery
                </button>`
              : ""
          }
          ${
            order.paymentInstructions
              ? `<div class="mt-3 p-3 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900">
                  <p class="font-bold">M-Pesa payment instructions</p>
                  <p class="mt-1">${order.paymentInstructions.method === "PAYBILL" ? "Paybill" : "Till"}: <strong>${escapeHtml(order.paymentInstructions.shortcode)}</strong></p>
                  ${
                    order.paymentInstructions.accountReference
                      ? `<p>Account number: <strong>${escapeHtml(order.paymentInstructions.accountReference)}</strong></p>`
                      : ""
                  }
                  <p>Amount: <strong>${escapeHtml(order.paymentInstructions.currency)} ${Number(order.paymentInstructions.amount).toLocaleString()}</strong></p>
                </div>`
              : ""
          }
          ${
            order.fulfillmentDetails?.trackingNumber
              ? `<p class="text-emerald-700 mt-2 flex items-center gap-1.5">
                  <i data-lucide="truck" class="w-3.5 h-3.5"></i>
                  <span>Tracking: <strong>${escapeHtml(order.fulfillmentDetails.trackingNumber)}</strong> (${escapeHtml(order.fulfillmentDetails.courierName || "Courier")})</span>
                </p>`
              : ""
          }
        </div>
      `;
    }
    container.innerHTML = html;
    renderIcons();
  } else {
    if (res.status === 401) {
      clearCustomerSession();
      state.myOrders = [];
      renderCustomerAuth();
      void initializeGoogleSignIn();
    }
    container.innerHTML = `
      <p class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
        ${res.data?.error?.message || "Could not load your orders. Please try again."}
      </p>
    `;
  }
}
