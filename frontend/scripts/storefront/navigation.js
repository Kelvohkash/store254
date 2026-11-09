// Navigation & Drawer Menus

function togglePlatformMobileMenu(show) {
  const menu = document.getElementById("mobile-platform-menu");
  const toggle = document.getElementById("mobile-menu-toggle");
  if (!menu) return;

  const nextState = show ?? menu.hidden;
  menu.hidden = !nextState;
  menu.classList.toggle("is-open", nextState);
  toggle?.setAttribute("aria-expanded", String(nextState));
  document.body.classList.toggle("overflow-hidden", nextState);
  renderIcons();
}

function toggleStorefrontMenu() {
  const menu = document.getElementById("fashion-mobile-menu");
  const toggle = document.getElementById("storefront-menu-toggle");
  if (!menu) return;

  const willOpen = menu.hidden;
  menu.hidden = !willOpen;
  toggle?.setAttribute("aria-expanded", String(willOpen));
  const icon = toggle?.querySelector("[data-lucide]");
  if (icon) {
    icon.setAttribute("data-lucide", willOpen ? "x" : "menu");
    renderIcons();
  }
}

// UI Drawer Toggles
function toggleDrawer(id, show) {
  const el = document.getElementById(id);
  if (!el) return;

  if (show) {
    el.classList.remove("hidden");
    if (id === "cart-drawer") {
      renderCartDrawer();
      void refreshCheckoutCustomerProfile();
      void maybePromptGuestSignIn("cart");
    }
    if (id === "orders-drawer") loadMyOrders();
  } else {
    el.classList.add("hidden");
    if (id === "mpesa-pin-modal") stopPaymentStatusPolling();
  }
  renderIcons();
}
