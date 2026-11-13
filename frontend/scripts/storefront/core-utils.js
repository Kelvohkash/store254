// Helper to safely render Lucide icons
function renderIcons(target) {
  if (typeof lucide !== "undefined" && lucide.createIcons) {
    if (target && (target instanceof Element || target instanceof DocumentFragment)) {
      lucide.createIcons({ root: target });
    } else {
      lucide.createIcons();
    }
  }
}

// Toast Notifications
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  const bgClass =
    type === "success"
      ? "bg-emerald-600 text-white"
      : type === "error"
      ? "bg-rose-600 text-white"
      : "bg-slate-800 text-white";

  const iconName = type === "success" ? "check-circle-2" : type === "error" ? "alert-circle" : "info";

  toast.className = `flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold transition-all transform duration-300 ease-out ${bgClass}`;
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  renderIcons();

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-8px)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function inlineJs(value) {
  const encoded = JSON.stringify(String(value ?? "")).slice(1, -1);
  return `'${encoded.replace(/'/g, "\\'").replace(/[<>&\u2028\u2029]/g, (character) => ({
    "<": "\\u003c",
    ">": "\\u003e",
    "&": "\\u0026",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029",
  })[character])}'`;
}

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  for (const modalId of ["item-details-modal", "cart-drawer", "orders-drawer", "onboard-modal", "recovery-modal", "mpesa-pin-modal"]) {
    const el = document.getElementById(modalId);
    if (el && !el.classList.contains("hidden") && typeof toggleDrawer === "function") {
      toggleDrawer(modalId, false);
    }
  }
});

function parseInitialStorefrontRoute() {
  const path = window.location.pathname || "/";
  const catMatch = path.match(/^\/category\/([^/]+)\/?$/);
  const itemMatch = path.match(/^\/item\/([^/]+)\/?$/);
  const params = new URLSearchParams(window.location.search);
  let categorySlug = "";
  let itemSlug = "";
  try {
    if (catMatch) categorySlug = decodeURIComponent(catMatch[1]);
    if (itemMatch) itemSlug = decodeURIComponent(itemMatch[1]);
  } catch {}
  return {
    categorySlug,
    itemSlug,
    query: (params.get("q") || "").trim(),
  };
}

function getStorefrontRouteUrl(options = {}) {
  const { categorySlug = "", itemSlug = "" } = options;
  const params = new URLSearchParams(window.location.search);
  const explicitStore = params.get("store") || params.get("subdomain") || "";
  let path = "/";
  if (itemSlug) {
    path = `/item/${encodeURIComponent(itemSlug)}`;
  } else if (categorySlug) {
    path = `/category/${encodeURIComponent(categorySlug)}`;
  }
  const nextParams = new URLSearchParams();
  if (explicitStore) nextParams.set("store", explicitStore);
  const qs = nextParams.toString();
  return `${path}${qs ? `?${qs}` : ""}`;
}
