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

  const returnUrl = new URL(window.location.href);
  returnUrl.searchParams.delete("_customer_login");
  loginUrl.searchParams.set("return_to", returnUrl.toString());
  container.replaceChildren();
  const link = document.createElement("a");
  link.href = loginUrl.toString();
  link.className = "customer-google-link";
  link.innerHTML = '<span class="customer-google-g" aria-hidden="true">G</span><span>Continue with Google</span>';
  container.appendChild(link);
}

function escapeProfileHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildStore254StoreUrls(subdomain) {
  const safeSlug = encodeURIComponent(String(subdomain || "").trim());
  const { protocol, hostname, port } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost")) {
    const portPart = port ? `:${port}` : "";
    const storefrontUrl = `${protocol}//${safeSlug}.localhost${portPart}`;
    return { storefrontUrl, adminUrl: `${storefrontUrl}/admin.html` };
  }
  const storefrontUrl = `https://${safeSlug}.store254.co.ke`;
  return { storefrontUrl, adminUrl: `${storefrontUrl}/admin.html` };
}

function buildActiveStoreProfileHtml(activeStore, stores = []) {
  if (!activeStore || !activeStore.subdomain) return "";
  const { storefrontUrl, adminUrl } = buildStore254StoreUrls(activeStore.subdomain);
  const locParts = [
    activeStore.locationName || activeStore.locationLabel || "",
    activeStore.constituencyName || "",
    activeStore.countyName || "",
  ].filter(Boolean);
  const uniqueLocParts = [...new Set(locParts)];
  const locationText = uniqueLocParts.join(", ") || "Location not set yet";
  const addressLine = activeStore.physicalAddress ? `${locationText} · ${activeStore.physicalAddress}` : locationText;

  const statusColors = {
    ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
    PENDING: "bg-amber-100 text-amber-800 border-amber-200",
    SUSPENDED: "bg-rose-100 text-rose-800 border-rose-200",
  };
  const statusCls = statusColors[activeStore.status] || "bg-slate-100 text-slate-700 border-slate-200";
  const roleLabel = activeStore.userRole === "OWNER" ? "Store Owner" : activeStore.userRole === "ADMIN" ? "Store Admin" : "Store Staff";
  const extraCount = Array.isArray(stores) ? Math.max(0, stores.length - 1) : 0;

  return `
    <div class="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-2.5">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">My Active Store</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-800">${escapeProfileHtml(roleLabel)}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCls}">${escapeProfileHtml(activeStore.status || "ACTIVE")}</span>
          </div>
          <p class="mt-1 text-sm font-extrabold text-slate-900 truncate">${escapeProfileHtml(activeStore.name)}</p>
          <p class="text-[11px] font-medium text-slate-500 truncate">${escapeProfileHtml(activeStore.subdomain)}.store254.co.ke</p>
        </div>
      </div>
      <div class="flex items-start gap-1.5 text-xs text-slate-700">
        <i data-lucide="map-pin" class="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5"></i>
        <span class="leading-snug">${escapeProfileHtml(addressLine)}</span>
      </div>
      ${extraCount > 0 ? `<p class="text-[11px] font-semibold text-emerald-800">+${extraCount} more store${extraCount === 1 ? "" : "s"} linked to this account</p>` : ""}
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <a href="${escapeProfileHtml(storefrontUrl)}" class="inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 text-[11px] font-bold text-white transition">Visit Storefront</a>
        <a href="${escapeProfileHtml(adminUrl)}" class="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800 transition">Manage Store Admin</a>
      </div>
    </div>
  `;
}

window.buildStore254StoreUrls = buildStore254StoreUrls;
window.buildActiveStoreProfileHtml = buildActiveStoreProfileHtml;

async function hydrateStorefrontCustomerSession() {
  if (!state.activeTenant) return false;
  try {
    const profileRes = await apiFetch("/api/auth/me");
    if (profileRes.ok && profileRes.data?.success && profileRes.data.data?.role === "CUSTOMER") {
      persistCustomerSession(profileRes.data.data, state.customerToken || null);
      renderCustomerAuth();
      closeShoppingSignInPrompt();
      return true;
    }
    if (profileRes.status === 401 || profileRes.status === 403 || profileRes.status === 404) {
      clearCustomerSession();
      renderCustomerAuth();
    }
  } catch {}
  return false;
}

window.hydrateStorefrontCustomerSession = hydrateStorefrontCustomerSession;

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
  if (!isSignedIn) {
    const activeStoreCard = document.getElementById("customer-active-store-card");
    if (activeStoreCard) {
      activeStoreCard.innerHTML = "";
      activeStoreCard.classList.add("hidden");
    }
    const btnContainer = document.getElementById("google-signin-button");
    if (state.activeTenant && btnContainer && !btnContainer.querySelector(".customer-google-link")) {
      void initializeGoogleSignIn("google-signin-button");
    }
    return;
  }

  closeShoppingSignInPrompt();
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
  const activeStoreCard = document.getElementById("customer-active-store-card");
  if (activeStoreCard) {
    const activeStore = state.customerUser?.activeStore || state.customerActiveStore || null;
    const stores = state.customerUser?.stores || state.customerUserStores || [];
    const cardHtml = buildActiveStoreProfileHtml(activeStore, stores);
    activeStoreCard.innerHTML = cardHtml;
    activeStoreCard.classList.toggle("hidden", !cardHtml);
    if (cardHtml && typeof renderIcons === "function") renderIcons();
  }
}

// Password Recovery & Reset Handlers
let recoveryEmailState = "";

function showRecoveryStep(step) {
  const step1 = document.getElementById("form-recovery-step1");
  const step2 = document.getElementById("form-recovery-step2");
  if (!step1 || !step2) return;
  if (step === 1) {
    step1.classList.remove("hidden");
    step2.classList.add("hidden");
  } else {
    step1.classList.add("hidden");
    step2.classList.remove("hidden");
    const sentEmailEl = document.getElementById("recovery-sent-email");
    if (sentEmailEl) sentEmailEl.textContent = recoveryEmailState;
  }
}

async function handleRequestOtp(e) {
  e.preventDefault();
  const emailInput = document.getElementById("recovery-email");
  const email = emailInput ? emailInput.value.trim() : "";
  if (!email) return;

  const btn = document.getElementById("btn-request-otp");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Sending code...";
  }

  const endpoint = state.activeTenantSlug
    ? "/api/auth/forgot-password"
    : "/api/platform/forgot-password";

  try {
    const res = await apiFetch(endpoint, {
      method: "POST",
      body: JSON.stringify({ email }),
    });

    if (res.ok && res.data?.success) {
      recoveryEmailState = email;
      showRecoveryStep(2);
      showToast("OTP sent to your email.", "info");
    } else {
      showToast(res.data?.error?.message || "Failed to send recovery code", "error");
    }
  } catch (err) {
    showToast("Network error. Please try again.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="mail" class="w-4 h-4"></i> <span>Send Recovery Code (OTP)</span>`;
      renderIcons();
    }
  }
}

async function handleResetPassword(e) {
  e.preventDefault();
  const otp = document.getElementById("recovery-otp")?.value.trim();
  const newPassword = document.getElementById("recovery-new-password")?.value;
  const email = recoveryEmailState || document.getElementById("recovery-email")?.value.trim();

  if (!email || !otp || !newPassword) return;

  const btn = document.getElementById("btn-reset-password");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Verifying...";
  }

  const endpoint = state.activeTenantSlug
    ? "/api/auth/reset-password"
    : "/api/platform/reset-password";

  try {
    const res = await apiFetch(endpoint, {
      method: "POST",
      body: JSON.stringify({ email, otp, newPassword }),
    });

    if (res.ok && res.data?.success) {
      showToast("Password updated successfully! Please log in with your new password.", "info");
      toggleDrawer("recovery-modal", false);
      showRecoveryStep(1);
    } else {
      showToast(res.data?.error?.message || "Failed to reset password", "error");
    }
  } catch (err) {
    showToast("Network error. Please try again.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> <span>Verify & Update Password</span>`;
      renderIcons();
    }
  }
}
