// Navigation & Drawer Menus

function togglePlatformMobileMenu(show) {
  const menu = document.getElementById("platform-mobile-menu");
  const toggle = document.getElementById("mobile-menu-toggle");
  const icon = document.getElementById("mobile-menu-icon");
  if (!menu) return;

  const nextState = typeof show === "boolean" ? show : menu.hidden;
  menu.hidden = !nextState;
  menu.classList.toggle("is-open", nextState);
  toggle?.setAttribute("aria-expanded", String(nextState));
  toggle?.setAttribute("aria-label", nextState ? "Close navigation menu" : "Open navigation menu");
  if (icon) {
    icon.setAttribute("data-lucide", nextState ? "x" : "menu");
  }
  document.body.classList.toggle("overflow-hidden", nextState);
  renderIcons();
}

function toggleStorefrontMenu() {
  if (!state?.activeTenantSlug) {
    togglePlatformMobileMenu();
    return;
  }
  const menu = document.getElementById("fashion-mobile-menu");
  const toggle = document.getElementById("mobile-menu-toggle");
  const icon = document.getElementById("mobile-menu-icon");
  if (!menu) return;

  const willOpen = menu.hidden;
  menu.hidden = !willOpen;
  toggle?.setAttribute("aria-expanded", String(willOpen));
  toggle?.setAttribute("aria-label", willOpen ? "Close store menu" : "Open store menu");
  if (icon) {
    icon.setAttribute("data-lucide", willOpen ? "x" : "menu");
  }
  renderIcons();
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
