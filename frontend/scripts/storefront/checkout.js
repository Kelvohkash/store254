// Checkout Submission & Real-Time M-Pesa STK Push Polling

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
    items: state.cart.map((i) => ({
      itemId: i.itemId,
      variantId: i.variantId || undefined,
      quantity: i.quantity,
    })),
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
