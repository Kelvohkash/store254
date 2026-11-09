// Customer Authentication & Profile Management

async function initializeGoogleSignIn(containerId = "google-signin-button") {
  const container = document.getElementById(containerId);
  if (!container || !state.activeTenant) return;
  const config = await apiFetch("/api/auth/google/config");
  if (!config.ok || !config.data?.success) {
    renderGoogleSignInUnavailable(container, config.data?.error?.message || "Google sign-in is currently unavailable.");
    return;
  }
  if (!config.data.data?.enabled || !config.data.data?.loginUrl) {
    renderGoogleSignInUnavailable(container, "Google sign-in is not set up for this store yet.");
    return;
  }

  let loginUrl;
  try {
    loginUrl = new URL(config.data.data.loginUrl);
    if (loginUrl.protocol !== "https:" || loginUrl.hostname !== "store254.co.ke" ||
        loginUrl.pathname !== "/auth/google/login") {
      throw new Error("Unexpected centralized sign-in URL.");
    }
  } catch (error) {
    console.error("[Google sign-in] Invalid centralized login URL:", error);
    renderGoogleSignInUnavailable(container, "Google sign-in is currently unavailable.");
    return;
  }

  loginUrl.searchParams.set("return_to", window.location.href);
  container.replaceChildren();
  const link = document.createElement("a");
  link.href = loginUrl.toString();
  link.className = "customer-google-link";
  link.innerHTML = '<span class="customer-google-g" aria-hidden="true">G</span><span>Continue with Google</span>';
  container.appendChild(link);
}

function renderGoogleSignInUnavailable(container, message) {
  container.replaceChildren();
  const status = document.createElement("p");
  status.className = "text-xs text-slate-600";
  status.textContent = message;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "customer-google-retry mt-2 text-xs font-semibold hover:underline";
  retry.textContent = "Try again";
  retry.addEventListener("click", () => initializeGoogleSignIn(container.id));
  container.append(status, retry);
}

async function maybePromptGuestSignIn(context) {
  if (!state.activeTenant || state.customerUser?.role === "CUSTOMER") return;
  const promptKey = `store254_signin_prompt_${state.activeTenantSlug || "store"}`;
  if (sessionStorage.getItem(promptKey)) return;

  const modal = document.getElementById("shopping-signin-modal");
  if (!modal) return;
  const copy = document.getElementById("shopping-signin-copy");
  if (copy) {
    copy.textContent = context === "wishlist"
      ? "Sign in with Google to keep your wishlist with your account. You can continue browsing as a guest."
      : "Sign in with Google to keep your cart and orders with your account. You can continue shopping as a guest.";
  }
  sessionStorage.setItem(promptKey, "shown");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  renderIcons();
  void initializeGoogleSignIn("shopping-google-signin");

  const profile = await apiFetch("/api/auth/me");
  if (profile.ok && profile.data?.success && profile.data.data?.role === "CUSTOMER") {
    persistCustomerSession(profile.data.data, state.customerToken || null);
    renderCustomerAuth();
    closeShoppingSignInPrompt();
  }
}

function closeShoppingSignInPrompt() {
  const modal = document.getElementById("shopping-signin-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

async function signOutCustomer() {
  const result = await apiFetch("/api/auth/logout", { method: "POST" });
  if (!result.ok) {
    showToast(result.data?.error?.message || "Could not sign out. Please try again.", "error");
    return;
  }
  clearCustomerSession();
  state.myOrders = [];
  showToast("You have been signed out.", "info");
  await loadMyOrders();
}

function renderCustomerAuth() {
  const section = document.getElementById("customer-auth-section");
  const signedOut = document.getElementById("customer-signed-out");
  const signedIn = document.getElementById("customer-signed-in");
  if (!section || !signedOut || !signedIn) return;

  section.classList.toggle("hidden", !state.activeTenant);
  const isSignedIn = Boolean(state.customerUser);
  signedOut.classList.toggle("hidden", isSignedIn);
  signedIn.classList.toggle("hidden", !isSignedIn);
  document.getElementById("customer-orders-section")?.classList.toggle("hidden", !isSignedIn);
  section.classList.toggle("customer-auth-guest", !isSignedIn);
  const signInTitle = document.getElementById("customer-signin-title");
  if (signInTitle) signInTitle.textContent = `Sign in to ${state.activeTenant?.name || "your store"}`;
  if (!isSignedIn) return;

  document.getElementById("customer-account-name").textContent =
    state.customerUser.fullName || "Store customer";
  document.getElementById("customer-account-email").textContent =
    state.customerUser.email || "";
  const avatar = document.getElementById("customer-avatar");
  if (state.customerUser.avatarUrl) {
    avatar.src = state.customerUser.avatarUrl;
    avatar.classList.remove("hidden");
    document.getElementById("customer-avatar-fallback")?.classList.add("hidden");
  } else {
    avatar.removeAttribute("src");
    avatar.classList.add("hidden");
    document.getElementById("customer-avatar-fallback")?.classList.remove("hidden");
  }
  const orderCount = document.getElementById("customer-order-count");
  const wishlistCount = document.getElementById("customer-wishlist-count");
  if (orderCount) orderCount.textContent = String(state.myOrders.length);
  if (wishlistCount) wishlistCount.textContent = String(state.wishlist.length);
  const memberSince = document.getElementById("customer-member-since");
  if (memberSince) {
    const createdAt = state.customerUser.createdAt ? new Date(state.customerUser.createdAt) : null;
    memberSince.textContent = createdAt && !Number.isNaN(createdAt.getTime())
      ? `Store member since ${createdAt.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`
      : "";
  }
}
