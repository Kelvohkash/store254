// Cart Management & Checkout Drawer

function addToCart(id, title, price, image, itemType = "PHYSICAL", variantId = undefined, qty = 1) {
  const quantityToAdd = Math.max(1, parseInt(qty, 10) || 1);
  const existing = state.cart.find((i) => i.itemId === id && (i.variantId || undefined) === (variantId || undefined));
  if (existing) {
    existing.quantity += quantityToAdd;
  } else {
    state.cart.push({ itemId: id, variantId: variantId || undefined, title, price, image, itemType, quantity: quantityToAdd });
  }
  saveCart();
  updateCartBadge();
  showToast(`Added "${title}" to your cart!`);
  void maybePromptGuestSignIn("cart");
}

function updateCartQuantity(index, delta) {
  state.cart[index].quantity += delta;
  if (state.cart[index].quantity <= 0) state.cart.splice(index, 1);
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
      </div>`;
    if (subtotalEl) subtotalEl.textContent = "KES 0";
    if (discountRow) discountRow.classList.add("hidden");
    if (totalEl) totalEl.textContent = "KES 0";
    if (serviceBookingSection) serviceBookingSection.classList.add("hidden");
    renderIcons();
    return;
  }

  const hasService = state.cart.some((i) => i.itemType === "SERVICE");
  if (serviceBookingSection) serviceBookingSection.classList.toggle("hidden", !hasService);

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
      </div>`;
  });
  container.innerHTML = html;

  let discountAmount = 0;
  if (state.appliedCoupon) {
    discountAmount = state.appliedCoupon.type === "PERCENTAGE"
      ? Math.round((subtotal * state.appliedCoupon.value) / 100)
      : state.appliedCoupon.value;
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

async function applyCoupon() {
  const codeInput = document.getElementById("coupon-code-input");
  if (!codeInput) return;
  const code = codeInput.value.trim().toUpperCase();
  if (!code) {
    showToast("Please enter a promotion code", "error");
    return;
  }

  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (subtotal <= 0) {
    showToast("Add items to your cart before applying a coupon", "error");
    return;
  }

  const res = await apiFetch("/api/offers/validate-coupon", {
    method: "POST",
    body: JSON.stringify({ code, orderAmount: subtotal, itemIds: state.cart.map((i) => i.itemId) }),
  });

  if (res.ok && res.data.success) {
    const d = res.data.data;
    state.appliedCoupon = {
      code: d.couponCode || code,
      type: d.discountType,
      value: d.discountValue,
      discountAmount: d.discountAmount,
      title: d.title,
    };
    showToast(`Coupon "${state.appliedCoupon.code}" applied (-KES ${Number(d.discountAmount || 0).toLocaleString()})`);
    renderCartDrawer();
  } else {
    showToast(res.data.error?.message || "Invalid or expired coupon", "error");
    state.appliedCoupon = null;
    renderCartDrawer();
  }
}
