// Navigation & Drawer Menus

function togglePlatformMobileMenu(show) {
  const menu = document.getElementById("platform-mobile-menu");
  const backdrop = document.getElementById("platform-mobile-backdrop");
  const toggle = document.getElementById("mobile-menu-toggle");
  const icon = document.getElementById("mobile-menu-icon");
  if (!menu) return;

  const nextState = typeof show === "boolean" ? show : menu.hidden;
  menu.hidden = !nextState;
  menu.classList.toggle("is-open", nextState);
  if (backdrop) {
    backdrop.hidden = !nextState;
  }
  toggle?.setAttribute("aria-expanded", String(nextState));
  toggle?.setAttribute("aria-label", nextState ? "Close navigation menu" : "Open navigation menu");
  if (icon) {
    icon.setAttribute("data-lucide", nextState ? "x" : "menu");
  }
  document.body.classList.toggle("overflow-hidden", nextState);
  document.body.classList.toggle("platform-mobile-menu-open", nextState);
  renderIcons();
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("platform-mobile-menu-open")) {
    togglePlatformMobileMenu(false);
  }
});

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
function toggleDrawer(id, show, options = {}) {
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
    if (id === "item-details-modal") {
      state.currentItemId = null;
      state.currentItemSlug = null;
      document.getElementById("ssr-item-detail")?.remove();
      if (state.activeTenant?.name) {
        document.title = `${state.activeTenant.name} • Store254`;
      }
      if (
        !options?.skipHistory &&
        window.location.pathname.startsWith("/item/") &&
        typeof getStorefrontRouteUrl === "function"
      ) {
        const backUrl = getStorefrontRouteUrl({ categorySlug: state.selectedCategory || "" });
        const currentHistoryState =
          window.history.state && typeof window.history.state === "object"
            ? window.history.state
            : {};
        window.history.replaceState(
          { ...currentHistoryState, __storefrontCategory: state.selectedCategory || "", __storefrontItem: "" },
          "",
          backUrl
        );
      }
    }
  }
  renderIcons();
}
