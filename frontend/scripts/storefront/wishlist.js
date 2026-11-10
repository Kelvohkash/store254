// Storefront Wishlist Management

function updateWishlistButton() {
  const count = document.getElementById("wishlist-count");
  if (count) {
    count.textContent = String(state.wishlist.length);
    count.classList.toggle("hidden", state.wishlist.length === 0);
  }
  const mobileCount = document.getElementById("mobile-wishlist-count");
  if (mobileCount) {
    mobileCount.textContent = String(state.wishlist.length);
    mobileCount.classList.toggle("hidden", state.wishlist.length === 0);
  }
  const toggle = document.getElementById("wishlist-toggle");
  if (toggle) {
    toggle.classList.toggle("hidden", !state.activeTenant);
    toggle.setAttribute("aria-pressed", String(state.showWishlistOnly));
    toggle.classList.toggle("is-active", state.showWishlistOnly);
    const label = toggle.querySelector("[data-wishlist-label]");
    if (label) label.textContent = state.showWishlistOnly ? "All Products" : "Wishlist";
  }
  const mobileToggle = document.getElementById("mobile-wishlist-toggle");
  if (mobileToggle) {
    mobileToggle.classList.toggle("hidden", !state.activeTenant);
    mobileToggle.classList.toggle("flex", Boolean(state.activeTenant));
    mobileToggle.setAttribute("aria-pressed", String(state.showWishlistOnly));
    const label = mobileToggle.querySelector("[data-wishlist-label]");
    if (label) label.textContent = state.showWishlistOnly ? "Shop" : "Saved";
  }
  document.getElementById("customer-profile-toggle")?.classList.toggle("hidden", !state.activeTenant);
  document.getElementById("mobile-customer-profile-toggle")?.classList.toggle("hidden", !state.activeTenant);
  const profileOrderCount = document.getElementById("customer-order-count");
  const profileWishlistCount = document.getElementById("customer-wishlist-count");
  if (profileOrderCount) profileOrderCount.textContent = String(state.myOrders.length);
  if (profileWishlistCount) profileWishlistCount.textContent = String(state.wishlist.length);
  renderIcons();
}

function toggleWishlistView(show = !state.showWishlistOnly) {
  void maybePromptGuestSignIn("wishlist");
  state.showWishlistOnly = show;
  state.selectedCategory = "";
  state.activeFilters = {};
  const search = document.getElementById("search-input");
  const mobileSearch = document.getElementById("mobile-search-input");
  if (search) search.value = "";
  if (mobileSearch) mobileSearch.value = "";
  updateWishlistButton();
  loadCategories();
  loadItems();
}

function toggleWishlist(itemId, button) {
  void maybePromptGuestSignIn("wishlist");
  const index = state.wishlist.indexOf(itemId);
  if (index >= 0) {
    state.wishlist.splice(index, 1);
  } else {
    state.wishlist.push(itemId);
  }
  localStorage.setItem(`store254_wishlist_${state.activeTenantSlug || "platform"}`, JSON.stringify(state.wishlist));
  const isWishlisted = state.wishlist.includes(itemId);
  document.querySelectorAll(`[data-wishlist-item="${CSS.escape(itemId)}"]`).forEach((wishlistButton) => {
    wishlistButton.classList.toggle("is-wishlisted", isWishlisted);
    wishlistButton.setAttribute("aria-pressed", String(isWishlisted));
    wishlistButton.setAttribute("aria-label", `${isWishlisted ? "Remove from" : "Add to"} wishlist`);
  });
  updateWishlistButton();
  showToast(isWishlisted ? "Added to your wishlist." : "Removed from your wishlist.", "info");
  if (state.showWishlistOnly) loadItems();
}
