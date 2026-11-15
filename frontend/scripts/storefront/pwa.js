(function initStore254Pwa() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const DISMISS_KEY = "store254_pwa_dismissed_until";
  const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  let deferredInstallPrompt = null;

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
    const metaTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    const candidate = metaTitle && metaTitle.getAttribute("content");
    return candidate && candidate.trim() ? candidate.trim() : "Store254";
  }

  function renderInstallBanner(mode) {
    if (isStandaloneMode() || isDismissedRecently()) return;
    if (document.getElementById("pwa-install-banner")) return;

    const appLabel = getAppLabel();
    const banner = document.createElement("aside");
    banner.id = "pwa-install-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", `Install ${appLabel}`);

    const isMobileViewport = window.innerWidth < 1024;
    const hasBottomNav = Boolean(document.getElementById("platform-mobile-bottom-nav"));
    banner.style.position = "fixed";
    banner.style.zIndex = "45";
    banner.style.bottom = isMobileViewport && hasBottomNav ? "5.25rem" : "1rem";
    banner.style.right = "0.75rem";
    banner.style.left = isMobileViewport ? "0.75rem" : "auto";
    banner.style.maxWidth = isMobileViewport ? "none" : "23rem";
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
    title.textContent = `Install ${appLabel}`;

    const subtitle = document.createElement("p");
    subtitle.style.margin = "0.125rem 0 0";
    subtitle.style.fontSize = "0.75rem";
    subtitle.style.color = "#475569";
    subtitle.textContent =
      mode === "ios"
        ? "Tap Share, then Add to Home Screen for app access."
        : "Fast home-screen access and instant loading.";

    copy.append(title, subtitle);
    banner.appendChild(icon);
    banner.appendChild(copy);

    if (mode === "prompt" && deferredInstallPrompt) {
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

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Registration errors are non-fatal on unsupported embedded browsers.
      });
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
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

  if (isIosSafari() && !isStandaloneMode() && !isDismissedRecently()) {
    window.setTimeout(() => {
      if (!deferredInstallPrompt) {
        renderInstallBanner("ios");
      }
    }, 2500);
  }
})();
