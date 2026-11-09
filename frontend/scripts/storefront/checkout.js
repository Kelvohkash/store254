// 12. Cart Management
function addToCart(id, title, price, image, itemType = "PHYSICAL") {
  const existing = state.cart.find((i) => i.itemId === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      itemId: id,
      title,
      price,
      image,
      itemType,
      quantity: 1,
    });
  }

  saveCart();
  updateCartBadge();
  showToast(`Added "${title}" to your cart!`);
  void maybePromptGuestSignIn("cart");
}

function updateCartQuantity(index, delta) {
  state.cart[index].quantity += delta;
  if (state.cart[index].quantity <= 0) {
    state.cart.splice(index, 1);
  }
  saveCart();
  renderCartDrawer();
  updateCartBadge();
}

function saveCart() {
  const key = `store254_cart_${state.activeTenantSlug || "platform"}`;
  localStorage.setItem(key, JSON.stringify(state.cart));
}

function updateCartBadge() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById("cart-count-badge");
  const mobileBadge = document.getElementById("mobile-cart-badge");
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle("hidden", count === 0);
  }
  if (mobileBadge) {
    mobileBadge.textContent = count;
    mobileBadge.classList.toggle("hidden", count === 0);
  }
}

// 13. Render Cart & Checkout Drawer
function renderCartDrawer() {
  populateCheckoutCustomerDetails();
  const container = document.getElementById("cart-items-container");
  const subtotalEl = document.getElementById("cart-subtotal");
  const discountRow = document.getElementById("cart-discount-row");
  const discountEl = document.getElementById("cart-discount");
  const totalEl = document.getElementById("cart-total");
  const serviceBookingSection = document.getElementById("service-booking-section");

  if (!container) return;

  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="py-16 text-center text-slate-400">
        <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-300">
          <i data-lucide="shopping-cart" class="w-6 h-6"></i>
        </div>
        <p class="text-sm font-semibold text-slate-700">Your cart is empty</p>
        <p class="text-xs text-slate-500 mt-1">Explore our catalog to add items!</p>
      </div>
    `;
    if (subtotalEl) subtotalEl.textContent = "KES 0";
    if (discountRow) discountRow.classList.add("hidden");
    if (totalEl) totalEl.textContent = "KES 0";
    if (serviceBookingSection) serviceBookingSection.classList.add("hidden");
    renderIcons();
    return;
  }

  // Check if any cart item is a SERVICE
  const hasService = state.cart.some((i) => i.itemType === "SERVICE");
  if (serviceBookingSection) {
    serviceBookingSection.classList.toggle("hidden", !hasService);
  }

  let subtotal = 0;
  let html = "";

  state.cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;

    html += `
      <div class="flex items-center gap-3 py-3 border-b border-slate-100 text-xs">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="w-14 h-14 object-contain rounded-lg bg-slate-50 p-1 border border-slate-100">
        <div class="flex-1 min-w-0">
          <h4 class="font-bold text-slate-900 truncate">${escapeHtml(item.title)}</h4>
          <span class="text-slate-500 font-mono">KES ${item.price.toLocaleString()}</span>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="updateCartQuantity(${index}, -1)" class="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700">-</button>
          <span class="font-bold text-slate-900 w-4 text-center">${item.quantity}</span>
          <button onclick="updateCartQuantity(${index}, 1)" class="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700">+</button>
        </div>
        <span class="font-bold text-slate-900 min-w-[70px] text-right">KES ${itemTotal.toLocaleString()}</span>
      </div>
    `;
  });

  container.innerHTML = html;

  let discountAmount = 0;
  if (state.appliedCoupon) {
    if (state.appliedCoupon.type === "PERCENTAGE") {
      discountAmount = Math.round((subtotal * state.appliedCoupon.value) / 100);
    } else {
      discountAmount = state.appliedCoupon.value;
    }
  }

  const finalTotal = Math.max(1, subtotal - discountAmount);

  if (subtotalEl) subtotalEl.textContent = `KES ${subtotal.toLocaleString()}`;
  if (discountRow) {
    discountRow.classList.toggle("hidden", discountAmount === 0);
    if (discountEl) discountEl.textContent = `- KES ${discountAmount.toLocaleString()}`;
  }
  if (totalEl) totalEl.textContent = `KES ${finalTotal.toLocaleString()}`;
  renderIcons();
}

function populateCheckoutCustomerDetails() {
  const nameInput = document.getElementById("checkout-name");
  const emailInput = document.getElementById("checkout-email");
  if (!nameInput || !emailInput) return;

  const customer = state.customerUser?.role === "CUSTOMER" ? state.customerUser : null;
  if (customer) {
    if (customer.fullName) nameInput.value = customer.fullName;
    if (customer.email) emailInput.value = customer.email;
    nameInput.readOnly = Boolean(customer.fullName);
    emailInput.readOnly = Boolean(customer.email);
    nameInput.dataset.accountPrefilled = String(Boolean(customer.fullName));
    emailInput.dataset.accountPrefilled = String(Boolean(customer.email));
    return;
  }

  if (nameInput.dataset.accountPrefilled === "true") nameInput.value = "";
  if (emailInput.dataset.accountPrefilled === "true") emailInput.value = "";
  nameInput.readOnly = false;
  emailInput.readOnly = false;
  delete nameInput.dataset.accountPrefilled;
  delete emailInput.dataset.accountPrefilled;
}

async function refreshCheckoutCustomerProfile() {
  const profileRes = await apiFetch("/api/auth/me");
  if (profileRes.ok && profileRes.data?.success && profileRes.data.data?.role === "CUSTOMER") {
    persistCustomerSession(profileRes.data.data, state.customerToken || null);
    populateCheckoutCustomerDetails();
  }
}

// 14. Apply Promotion / Coupon
async function applyCoupon() {
  const codeInput = document.getElementById("coupon-code-input");
  if (!codeInput) return;
  const code = codeInput.value.trim().toUpperCase();

  if (!code) {
    showToast("Please enter a promotion code", "error");
    return;
  }

  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const res = await apiFetch("/api/offers/validate-coupon", {
    method: "POST",
    body: JSON.stringify({
      code,
      cartTotal: subtotal,
      cartItems: state.cart.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
    }),
  });

  if (res.ok && res.data.success) {
    state.appliedCoupon = res.data.data;
    showToast(`Coupon "${code}" applied: ${res.data.data.discountDescription}`);
    renderCartDrawer();
  } else {
    showToast(res.data.error?.message || "Invalid or expired coupon", "error");
    state.appliedCoupon = null;
    renderCartDrawer();
  }
}

// 15. Initiate Checkout with M-Pesa STK Push
async function initiateMpesaCheckout() {
  await submitCheckout("MPESA");
}

async function initiateCashOnDeliveryCheckout() {
  await submitCheckout("CASH_ON_DELIVERY");
}

async function submitCheckout(paymentMethod) {
  if (!state.activeTenantSlug) {
    showToast("Please visit a store to complete your checkout.", "error");
    return;
  }
  populateCheckoutCustomerDetails();
  const name = document.getElementById("checkout-name").value.trim();
  const email = document.getElementById("checkout-email").value.trim();
  const phone = document.getElementById("checkout-phone").value.trim();
  const deliveryAddress = document.getElementById("checkout-address").value.trim();
  const mpesaButton = document.getElementById("btn-pay-mpesa");
  const deliveryButton = document.getElementById("btn-pay-delivery");

  if (!name || !email || !phone) {
    showToast("Please fill in your name, email, and phone number", "error");
    return;
  }

  if (paymentMethod === "CASH_ON_DELIVERY" && deliveryAddress.length < 5) {
    showToast("Enter a delivery address and nearby landmark for pay on delivery", "error");
    document.getElementById("checkout-address").focus();
    return;
  }

  if (state.cart.length === 0) {
    showToast("Your cart is empty", "error");
    return;
  }

  // Booking details for services
  let bookingDetails = undefined;
  const hasService = state.cart.some((i) => i.itemType === "SERVICE");
  if (hasService) {
    const bookingDate = document.getElementById("booking-date")?.value;
    const timeSlot = document.getElementById("booking-time")?.value;
    bookingDetails = {
      bookingDate: bookingDate || new Date().toISOString().split("T")[0],
      timeSlot: timeSlot || "Morning (9am - 12pm)",
    };
  }

  const selectedButton = paymentMethod === "MPESA" ? mpesaButton : deliveryButton;
  mpesaButton.disabled = true;
  deliveryButton.disabled = true;
  selectedButton.innerHTML = paymentMethod === "MPESA"
    ? `<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full spin-slow mr-2"></div> Initiating STK Push...`
    : `<div class="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full spin-slow mr-2"></div> Placing order...`;

  const payload = {
    customerName: name,
    customerEmail: email,
    customerPhone: phone,
    paymentMethod,
    deliveryAddress: deliveryAddress || undefined,
    items: state.cart.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
    couponCode: state.appliedCoupon?.code,
    bookingDetails,
  };

  const res = await apiFetch("/api/orders/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  mpesaButton.disabled = false;
  deliveryButton.disabled = false;
  mpesaButton.innerHTML = `<i data-lucide="smartphone" class="w-4 h-4"></i><span>Pay with M-Pesa STK Push</span>`;
  deliveryButton.innerHTML = `<i data-lucide="truck" class="w-4 h-4"></i><span>Place Order · Pay on Delivery</span>`;
  renderIcons();

  if (res.ok && res.data.success) {
    const orderData = res.data.data;

    // Clear cart on successful order creation
    state.cart = [];
    saveCart();
    updateCartBadge();
    toggleDrawer("cart-drawer", false);

    if (paymentMethod === "CASH_ON_DELIVERY") {
      showToast(`Order #${orderData.orderNumber} placed. Pay KES ${Number(orderData.totalAmount).toLocaleString()} on delivery.`);
    } else {
      // Open live PIN prompt modal
      openMpesaPinModal(
        orderData.checkoutRequestId,
        orderData.orderNumber,
        orderData.totalAmount,
        phone,
        orderData.paymentStatusToken
      );
    }
  } else {
    showToast(
      res.data.error?.message || (paymentMethod === "MPESA"
        ? "Checkout failed. Please check M-Pesa configuration."
        : "Could not place your order. Please try again."),
      "error"
    );
  }
}

// 16. Real-Time M-Pesa PIN Prompt & Status Polling
function stopPaymentStatusPolling() {
  if (state.activePollInterval) clearInterval(state.activePollInterval);
  state.activePollInterval = null;
  state.activePaymentStatusToken = null;
}

function openMpesaPinModal(checkoutRequestId, orderNumber, amount, phone, paymentStatusToken) {
  const modal = document.getElementById("mpesa-pin-modal");
  if (!modal) return;

  document.getElementById("mpesa-modal-phone").textContent = phone;
  document.getElementById("mpesa-modal-amount").textContent = `KES ${amount.toLocaleString()}`;
  document.getElementById("mpesa-modal-order").textContent = orderNumber;
  document.getElementById("mpesa-status-text").textContent = "Prompt sent! Check your phone and enter M-Pesa PIN...";

  modal.classList.remove("hidden");
  renderIcons();

  stopPaymentStatusPolling();
  state.activePaymentStatusToken = paymentStatusToken || null;

  let attempts = 0;
  state.activePollInterval = setInterval(async () => {
    attempts++;
    if (attempts > 30) {
      stopPaymentStatusPolling();
      document.getElementById("mpesa-status-text").textContent = "Timed out. If you completed payment, check your order history.";
      return;
    }

    const res = await apiFetch(`/api/payments/mpesa/status/${checkoutRequestId}`, {
      headers: { "X-Payment-Status-Token": state.activePaymentStatusToken || "" },
    });
    if (res.ok && res.data.success) {
      const statusData = res.data.data;
      if (statusData.status === "COMPLETED") {
        stopPaymentStatusPolling();
        document.getElementById("mpesa-modal-icon").innerHTML = `<i data-lucide="check-circle" class="w-8 h-8 text-emerald-600"></i>`;
        document.getElementById("mpesa-status-text").innerHTML = `
          <strong class="text-emerald-600 block text-base mb-1">Payment Successful!</strong>
          M-Pesa Receipt: <span class="font-mono font-bold">${escapeHtml(statusData.mpesaReceiptNumber || "CONFIRMED")}</span>
        `;
        showToast("Payment received! Order confirmed.");
        renderIcons();
      } else if (statusData.status === "FAILED") {
        stopPaymentStatusPolling();
        document.getElementById("mpesa-modal-icon").innerHTML = `<i data-lucide="alert-circle" class="w-8 h-8 text-rose-600"></i>`;
        document.getElementById("mpesa-status-text").textContent = "Payment cancelled or insufficient funds.";
        renderIcons();
      }
    }
  }, 2500);
}

