// Cart Management & Checkout Drawer

function getCartComposition() {
  const list = Array.isArray(state.cart) ? state.cart : [];
  const hasService = list.some((i) => i.itemType === "SERVICE");
  const hasPhysical = list.some((i) => i.itemType === "PHYSICAL" || !i.itemType);
  const isServiceOnly = hasService && !hasPhysical;
  return { hasService, hasPhysical, isServiceOnly };
}

function syncCheckoutDeliveryAndBookingUI() {
  const { hasService, hasPhysical, isServiceOnly } = getCartComposition();
  const titleEl = document.getElementById("cart-drawer-title-text");
  const bookingSection = document.getElementById("service-booking-section");
  const bookingMode = document.getElementById("booking-mode")?.value || "IN_PERSON_SHOP";
  const addrGroup = document.getElementById("checkout-address-group");
  const addrLabel = document.getElementById("checkout-address-label");
  const addrInput = document.getElementById("checkout-address");
  const detailsHeading = document.getElementById("checkout-section-heading");
  const detailsHelp = document.getElementById("checkout-section-help");
  const payHelp = document.getElementById("checkout-payment-help");
  const deliveryBtn = document.getElementById("btn-pay-delivery");

  if (bookingSection) bookingSection.classList.toggle("hidden", !hasService);
  if (titleEl) titleEl.textContent = isServiceOnly ? "Service Booking" : hasService ? "Cart & Service Booking" : "Shopping Cart & Checkout";

  const needsVisitAddress = hasPhysical || (isServiceOnly && bookingMode === "ON_SITE_CLIENT");
  if (addrGroup) addrGroup.classList.toggle("hidden", !needsVisitAddress);

  if (isServiceOnly) {
    if (detailsHeading) detailsHeading.textContent = "Booking Contact Details";
    if (detailsHelp) detailsHelp.textContent = "Enter your contact details for appointment confirmation.";
    if (addrLabel) {
      addrLabel.innerHTML = 'Service Visit Location <span class="font-normal text-slate-500">(required for on-site visits)</span>';
    }
    if (addrInput) addrInput.placeholder = "Estate, building, floor, and landmark where the service will happen";
    if (payHelp) payHelp.textContent = "Pay now with M-Pesa or pay in person when your service takes place.";
    if (deliveryBtn && !deliveryBtn.disabled) {
      deliveryBtn.innerHTML = '<i data-lucide="calendar-check" class="w-4 h-4"></i><span>Confirm Booking · Pay at Appointment</span>';
    }
  } else {
    if (detailsHeading) detailsHeading.textContent = hasService ? "Customer, Delivery & Booking Details" : "Customer & Delivery Details";
    if (detailsHelp) detailsHelp.textContent = "Your account name and email fill in automatically when you sign in. Enter your phone number and delivery address below.";
    if (addrLabel) {
      addrLabel.innerHTML = 'Delivery Address <span class="font-normal text-slate-500">(required for pay on delivery)</span>';
    }
    if (addrInput) addrInput.placeholder = "Estate, street, building, and nearby landmark";
    if (payHelp) payHelp.textContent = "Pay now with M-Pesa or pay the delivery person when your order arrives.";
    if (deliveryBtn && !deliveryBtn.disabled) {
      deliveryBtn.innerHTML = '<i data-lucide="truck" class="w-4 h-4"></i><span>Place Order · Pay on Delivery</span>';
    }
  }
}

function addToCart(id, title, price, image, itemType = "PHYSICAL", variantId = undefined, qty = 1) {
  const quantityToAdd = Math.max(1, parseInt(qty, 10) || 1);
  const safeImage = image || (typeof getItemFallbackArtwork === "function" ? getItemFallbackArtwork({ id, title, itemType }).dataUri : "");
  const existing = state.cart.find((i) => i.itemId === id && (i.variantId || undefined) === (variantId || undefined));
  if (existing) {
    existing.quantity += quantityToAdd;
  } else {
    state.cart.push({ itemId: id, variantId: variantId || undefined, title, price, image: safeImage, itemType, quantity: quantityToAdd });
  }
  saveCart();
  updateCartBadge();
  showToast(itemType === "SERVICE" ? `Added "${title}" to your booking!` : `Added "${title}" to your cart!`);
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
    if (totalEl) totalEl.textContent = "KES 0";
    if (serviceBookingSection) serviceBookingSection.classList.add("hidden");
    syncCheckoutDeliveryAndBookingUI();
    renderIcons();
    return;
  }

  syncCheckoutDeliveryAndBookingUI();

  let subtotal = 0;
  let html = "";
  state.cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    const isSvcLine = item.itemType === "SERVICE";
    const lineImg = item.image || (typeof getItemFallbackArtwork === "function" ? getItemFallbackArtwork(item).dataUri : "");
    html += `
      <div class="flex items-center gap-3 py-3 border-b border-slate-100 text-xs">
        <img src="${escapeHtml(lineImg)}" alt="${escapeHtml(item.title)}" class="w-14 h-14 object-contain rounded-lg bg-slate-50 p-1 border border-slate-100">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <h4 class="font-bold text-slate-900 truncate">${escapeHtml(item.title)}</h4>
            <span class="shrink-0 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${isSvcLine ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"}">${isSvcLine ? "Service" : "Product"}</span>
          </div>
          <span class="text-slate-500 font-mono">KES ${item.price.toLocaleString()}${isSvcLine ? " / session" : ""}</span>
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

  if (subtotalEl) subtotalEl.textContent = `KES ${subtotal.toLocaleString()}`;
  if (totalEl) totalEl.textContent = `KES ${subtotal.toLocaleString()}`;
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
