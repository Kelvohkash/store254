(function initStore254Pwa() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const DISMISS_KEY = "store254_pwa_dismissed_until";
  const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  let deferredInstallPrompt = null;

  function isAdminPage() {
    const path = (window.location.pathname || "").toLowerCase();
    return path.startsWith("/admin") || path.startsWith("/super-admin");
  }

  function isTenantSubdomainHost() {
    if (document.documentElement.dataset.storefront === "true") return true;
    const params = new URLSearchParams(window.location.search);
    if (params.has("store") || params.has("subdomain")) return true;
    const host = (window.location.hostname || "").toLowerCase();
    if (host.endsWith(".store254.co.ke")) {
      const sub = host.slice(0, -".store254.co.ke".length);
      return Boolean(sub && sub !== "www" && sub !== "api");
    }
    if (host.endsWith(".localhost")) {
      const sub = host.slice(0, -".localhost".length);
      return Boolean(sub && sub !== "www" && sub !== "api");
    }
    const isRootOrLocal =
      host === "store254.co.ke" ||
      host === "www.store254.co.ke" ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".workers.dev") ||
      host.endsWith(".pages.dev");
    return !isRootOrLocal;
  }

  function getMainPlatformInstallUrl() {
    const host = (window.location.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) {
      const port = window.location.port ? `:${window.location.port}` : "";
      return `${window.location.protocol}//localhost${port}/?install_app=1`;
    }
    return "https://store254.co.ke/?install_app=1";
  }

  function isStandaloneMode() {
    return (
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true
    );
  }

  function isDismissedRecently() {
    try {
      const raw = window.localStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      const until = Number(raw);
      return Number.isFinite(until) && Date.now() < until;
    } catch {
      return false;
    }
  }

  function clearDismissed() {
    try {
      window.localStorage.removeItem(DISMISS_KEY);
    } catch {
      // Ignore storage failures.
    }
  }

  function markDismissed() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_TTL_MS));
    } catch {
      // Ignore storage failures in private browsing.
    }
  }

  function isIosSafari() {
    const ua = window.navigator.userAgent || "";
    const isIos = /iPad|iPhone|iPod/i.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
    const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
    return isIos && isSafari;
  }

  function removeBanner() {
    const existing = document.getElementById("pwa-install-banner");
    if (existing) existing.remove();
  }

  function getAppLabel() {
    return "Store254";
  }

  // Never expose a subdomain- or admin-scoped manifest link to browser install menus.
  if (isAdminPage() || isTenantSubdomainHost()) {
    document.querySelector('link[rel="manifest"]')?.remove();
  }

  function renderInstallBanner(mode) {
    if (isAdminPage()) return;
    if (isStandaloneMode() || isDismissedRecently()) return;
    removeBanner();

    const isSubdomain = isTenantSubdomainHost();
    const appLabel = getAppLabel();
    const banner = document.createElement("aside");
    banner.id = "pwa-install-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", `Install ${appLabel}`);

    const isMobileViewport = window.innerWidth < 1024;
    const hasBottomNav = Boolean(document.getElementById("platform-mobile-bottom-nav")) && !isSubdomain;
    banner.style.position = "fixed";
    banner.style.zIndex = "45";
    banner.style.bottom = isMobileViewport && hasBottomNav ? "5.25rem" : "1rem";
    banner.style.right = "0.75rem";
    banner.style.left = isMobileViewport ? "0.75rem" : "auto";
    banner.style.maxWidth = isMobileViewport ? "none" : "24rem";
    banner.style.background = "#ffffff";
    banner.style.border = "1px solid #bbf7d0";
    banner.style.borderRadius = "1rem";
    banner.style.boxShadow = "0 18px 36px -14px rgba(15, 23, 42, 0.25)";
    banner.style.padding = "0.75rem 0.875rem";
    banner.style.display = "flex";
    banner.style.alignItems = "center";
    banner.style.gap = "0.75rem";

    const icon = document.createElement("img");
    icon.src = "/assets/pwa-icon-192.png";
    icon.alt = appLabel;
    icon.width = 40;
    icon.height = 40;
    icon.style.width = "2.5rem";
    icon.style.height = "2.5rem";
    icon.style.borderRadius = "0.75rem";
    icon.style.flexShrink = "0";

    const copy = document.createElement("div");
    copy.style.flex = "1";
    copy.style.minWidth = "0";

    const title = document.createElement("p");
    title.style.margin = "0";
    title.style.fontSize = "0.875rem";
    title.style.fontWeight = "700";
    title.style.color = "#0f172a";
    title.textContent = isSubdomain ? "Get the Store254 App" : `Install ${appLabel}`;

    const subtitle = document.createElement("p");
    subtitle.style.margin = "0.125rem 0 0";
    subtitle.style.fontSize = "0.75rem";
    subtitle.style.color = "#475569";
    if (isSubdomain) {
      subtitle.textContent = "Install the main Store254 app so all stores & your pinned shops stay in one place.";
    } else if (mode === "ios") {
      subtitle.textContent = "Tap Share, then Add to Home Screen for app access.";
    } else if (mode === "main-guide" && !deferredInstallPrompt) {
      subtitle.textContent = "Tap your browser menu (⋮ or Share) and choose Install app / Add to Home screen.";
    } else {
      subtitle.textContent = "Fast home-screen access to every store and your pinned shops.";
    }

    copy.append(title, subtitle);
    banner.appendChild(icon);
    banner.appendChild(copy);

    if (isSubdomain) {
      const redirectBtn = document.createElement("a");
      redirectBtn.id = "pwa-install-btn";
      redirectBtn.href = getMainPlatformInstallUrl();
      redirectBtn.textContent = "Install App";
      redirectBtn.style.background = "#0f7a44";
      redirectBtn.style.color = "#ffffff";
      redirectBtn.style.border = "none";
      redirectBtn.style.borderRadius = "9999px";
      redirectBtn.style.padding = "0.45rem 0.9rem";
      redirectBtn.style.fontSize = "0.8125rem";
      redirectBtn.style.fontWeight = "700";
      redirectBtn.style.textDecoration = "none";
      redirectBtn.style.flexShrink = "0";
      banner.appendChild(redirectBtn);
    } else if (deferredInstallPrompt) {
      const installBtn = document.createElement("button");
      installBtn.type = "button";
      installBtn.id = "pwa-install-btn";
      installBtn.textContent = "Install";
      installBtn.style.background = "#0f7a44";
      installBtn.style.color = "#ffffff";
      installBtn.style.border = "none";
      installBtn.style.borderRadius = "9999px";
      installBtn.style.padding = "0.45rem 0.9rem";
      installBtn.style.fontSize = "0.8125rem";
      installBtn.style.fontWeight = "700";
      installBtn.style.cursor = "pointer";
      installBtn.style.flexShrink = "0";
      installBtn.addEventListener("click", async () => {
        if (!deferredInstallPrompt) return;
        const promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice.catch(() => null);
        removeBanner();
        if (choice && choice.outcome !== "accepted") {
          markDismissed();
        }
      });
      banner.appendChild(installBtn);
    }

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Dismiss install prompt");
    closeBtn.textContent = "×";
    closeBtn.style.background = "transparent";
    closeBtn.style.border = "none";
    closeBtn.style.color = "#64748b";
    closeBtn.style.fontSize = "1.25rem";
    closeBtn.style.lineHeight = "1";
    closeBtn.style.padding = "0.25rem";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.flexShrink = "0";
    closeBtn.addEventListener("click", () => {
      markDismissed();
      removeBanner();
    });
    banner.appendChild(closeBtn);

    document.body.appendChild(banner);
  }

  // Live network connection banner so in-page drops never leave users confused.
  let onlineDismissTimer = null;
  function renderNetworkBanner(isOffline) {
    const existing = document.getElementById("pwa-network-banner");
    window.clearTimeout(onlineDismissTimer);
    if (!isOffline) {
      if (!existing) return;
      existing.style.background = "#065f46";
      existing.style.borderColor = "#34d399";
      const msgEl = existing.querySelector("[data-network-msg]");
      if (msgEl) msgEl.textContent = "Back online! Your connection is restored.";
      const retryBtn = existing.querySelector("[data-network-retry]");
      if (retryBtn) retryBtn.style.display = "none";
      onlineDismissTimer = window.setTimeout(() => {
        existing.remove();
      }, 3200);
      return;
    }

    if (existing) return;
    const bar = document.createElement("div");
    bar.id = "pwa-network-banner";
    bar.setAttribute("role", "status");
    bar.setAttribute("aria-live", "polite");
    bar.style.position = "fixed";
    bar.style.top = "0.75rem";
    bar.style.left = "50%";
    bar.style.transform = "translateX(-50%)";
    bar.style.zIndex = "120";
    bar.style.width = "min(calc(100% - 1.5rem), 32rem)";
    bar.style.background = "#1e293b";
    bar.style.color = "#ffffff";
    bar.style.border = "1px solid #475569";
    bar.style.borderRadius = "0.95rem";
    bar.style.padding = "0.65rem 0.85rem";
    bar.style.display = "flex";
    bar.style.alignItems = "center";
    bar.style.justifyContent = "space-between";
    bar.style.gap = "0.75rem";
    bar.style.boxShadow = "0 16px 34px -12px rgba(15, 23, 42, 0.45)";
    bar.style.fontSize = "0.78rem";
    bar.style.fontWeight = "600";

    const msg = document.createElement("span");
    msg.setAttribute("data-network-msg", "1");
    msg.textContent = "You're offline — showing saved data. Reconnecting automatically…";
    msg.style.flex = "1";
    msg.style.minWidth = "0";

    const retry = document.createElement("button");
    retry.type = "button";
    retry.setAttribute("data-network-retry", "1");
    retry.textContent = "Retry";
    retry.style.background = "#10b981";
    retry.style.color = "#ffffff";
    retry.style.border = "none";
    retry.style.borderRadius = "9999px";
    retry.style.padding = "0.32rem 0.72rem";
    retry.style.fontSize = "0.74rem";
    retry.style.fontWeight = "800";
    retry.style.cursor = "pointer";
    retry.style.flexShrink = "0";
    retry.addEventListener("click", () => window.location.reload());

    bar.append(msg, retry);
    document.body.appendChild(bar);
  }

  window.addEventListener("offline", () => {
    renderNetworkBanner(true);
  });

  window.addEventListener("online", () => {
    renderNetworkBanner(false);
  });

  if (window.navigator && window.navigator.onLine === false) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => renderNetworkBanner(true), { once: true });
    } else {
      renderNetworkBanner(true);
    }
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Registration errors are non-fatal on unsupported embedded browsers.
      });
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    if (isAdminPage()) {
      deferredInstallPrompt = null;
      return;
    }
    // Never install a subdomain-scoped PWA; redirect install requests to main store254.co.ke.
    if (isTenantSubdomainHost()) {
      deferredInstallPrompt = null;
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => renderInstallBanner("redirect"), { once: true });
      } else {
        renderInstallBanner("redirect");
      }
      return;
    }

    deferredInstallPrompt = event;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => renderInstallBanner("prompt"), { once: true });
    } else {
      renderInstallBanner("prompt");
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    removeBanner();
    if (typeof window.showToast === "function") {
      window.showToast(`${getAppLabel()} installed on your device`, "success");
    }
  });

  // Handle ?install_app=1 redirects from subdomains to the main Store254 platform domain.
  if (!isAdminPage() && !isTenantSubdomainHost()) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("install_app") === "1") {
      clearDismissed();
      params.delete("install_app");
      const query = params.toString();
      const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
      const showMainInstall = () => {
        renderInstallBanner(deferredInstallPrompt ? "prompt" : (isIosSafari() ? "ios" : "main-guide"));
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", showMainInstall, { once: true });
      } else {
        showMainInstall();
      }
    }
  }

  if (isIosSafari() && !isAdminPage() && !isStandaloneMode() && !isDismissedRecently()) {
    window.setTimeout(() => {
      if (!deferredInstallPrompt && !document.getElementById("pwa-install-banner")) {
        renderInstallBanner(isTenantSubdomainHost() ? "redirect" : "ios");
      }
    }, 2500);
  }
})();
