// SUPER ADMIN API & FORMATTERS
// ═══════════════════════════════════════

const superAdminApiBase =
  ["localhost", "127.0.0.1"].includes(window.location.hostname) ||
  window.location.hostname.endsWith(".localhost")
    ? "http://localhost:8787"
    : window.location.origin;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

const formatCategory = (value) =>
  String(value || "Independent business").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric" }).format(date);
};

const money = (value) => `KES ${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const formatTemplateName = (id) => {
  const map = {
    "fashion-and-design": "Fashion and Design",
    "cosmetics": "Cosmetics",
    "electronics": "Electronics",
    "houses-and-rentals": "Houses and Rentals",
    "real-estate": "Real Estate",
    "food-and-groceries": "Food and Groceries",
    "hardware-and-autoparts": "Hardware and Spare Parts",
    "furniture-and-decor": "Furniture and Home Decor",
  };
  return map[id] || (id ? id.replace(/-/g, " ") : "Fashion and Design");
};

async function platformApiFetch(path, options = {}) {
  try {
    const response = await fetch(`${superAdminApiBase}/api/platform/admin${path}`, {
      ...options,
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: { message: "Could not connect to Store254. Check your connection and try again." } } };
  }
}

function setAdminNotice(message, isError = false) {
  const noticeEl = document.getElementById("notice");
  if (!noticeEl) return;
  noticeEl.textContent = message;
  noticeEl.classList.toggle("is-error", isError);
  noticeEl.hidden = !message;
}

function confirmDialog(title, message, isDanger = false) {
  const modal = document.getElementById("confirm-modal");
  if (!modal) return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  const titleEl = document.getElementById("confirm-modal-title");
  const msgEl = document.getElementById("confirm-modal-message");
  const okBtn = document.getElementById("confirm-ok-btn");
  const cancelBtn = document.getElementById("confirm-cancel-btn");
  const iconEl = document.getElementById("confirm-modal-icon");

  titleEl.textContent = title;
  msgEl.textContent = message;
  iconEl.textContent = isDanger ? "⚠️" : "✅";
  okBtn.className = isDanger ? "modal-btn danger" : "modal-btn primary";
  okBtn.textContent = isDanger ? "Yes, suspend" : "Yes, approve";
  modal.hidden = false;

  return new Promise((resolve) => {
    const cleanup = (confirmed) => {
      modal.hidden = true;
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      resolve(confirmed);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  });
}
