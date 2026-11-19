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

const normalizePhoneComparable = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length === 10 && (digits[1] === "7" || digits[1] === "1")) {
    return `254${digits.slice(1)}`;
  }
  if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) {
    return `254${digits}`;
  }
  return digits;
};

const sanitizeTelHref = (phone) => {
  const trimmed = String(phone || "").trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 6) return "";
  return `tel:${hasPlus ? "+" : ""}${digits}`;
};

const buildWhatsappHref = (rawWhatsapp, fallbackPhone) => {
  const input = String(rawWhatsapp || "").trim();
  if (input && /^https?:\/\//i.test(input)) {
    try {
      const parsed = new URL(input);
      const host = parsed.hostname.toLowerCase();
      if (
        (parsed.protocol === "https:" || parsed.protocol === "http:") &&
        (host === "wa.me" || host === "whatsapp.com" || host.endsWith(".whatsapp.com"))
      ) {
        return parsed.href;
      }
      return "";
    } catch {
      return "";
    }
  }
  const safeInput = input && !/^[a-z][a-z\d+.-]*:/i.test(input) ? input : "";
  const source = safeInput || String(fallbackPhone || "").trim();
  let digits = source.replace(/\D/g, "");
  if (digits.length < 6) return "";
  if (digits.startsWith("0") && digits.length === 10 && (digits[1] === "7" || digits[1] === "1")) {
    digits = `254${digits.slice(1)}`;
  } else if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) {
    digits = `254${digits}`;
  }
  return `https://wa.me/${digits}`;
};

const resolveStorePhones = (store) => {
  const data = store && typeof store === "object" ? store : {};
  const clean = (val) => (typeof val === "string" ? val.trim() : "");
  const whatsappRaw = clean(data.whatsapp);
  const nonUrlWhatsapp =
    whatsappRaw &&
    !/^[a-z][a-z\d+.-]*:/i.test(whatsappRaw) &&
    whatsappRaw.replace(/\D/g, "").length >= 6
      ? whatsappRaw
      : "";
  const primaryPhone =
    [clean(data.phone), clean(data.contactPhone), clean(data.ownerPhone), nonUrlWhatsapp].find(Boolean) || "";
  const telHref = sanitizeTelHref(primaryPhone);
  const whatsappHref = buildWhatsappHref(whatsappRaw, primaryPhone);
  const ownerPhone = clean(data.ownerPhone);
  const primaryComp = normalizePhoneComparable(primaryPhone);
  const ownerComp = normalizePhoneComparable(ownerPhone);
  const secondaryOwnerPhone =
    ownerPhone && ownerComp && ownerComp !== primaryComp ? ownerPhone : "";
  const secondaryOwnerTelHref = sanitizeTelHref(secondaryOwnerPhone);
  return {
    primaryPhone,
    telHref,
    whatsappHref,
    secondaryOwnerPhone,
    secondaryOwnerTelHref,
  };
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

let adminToastTimer = null;

function showAdminToast(message, isError = false) {
  const toastEl = document.getElementById("admin-toast");
  if (!toastEl || !message) return;
  toastEl.textContent = message;
  toastEl.classList.toggle("is-error", isError);
  toastEl.hidden = false;
  if (adminToastTimer) window.clearTimeout(adminToastTimer);
  adminToastTimer = window.setTimeout(() => {
    toastEl.hidden = true;
  }, 4200);
}

function setAdminNotice(message, isError = false) {
  const noticeEl = document.getElementById("notice");
  if (!noticeEl) return;
  noticeEl.textContent = message;
  noticeEl.classList.toggle("is-error", isError);
  noticeEl.hidden = !message;
  if (message) showAdminToast(message, isError);
}

function confirmDialog(titleOrOpts, messageArg, isDangerArg = false) {
  const opts = typeof titleOrOpts === "object" && titleOrOpts !== null
    ? titleOrOpts
    : { title: titleOrOpts, message: messageArg, isDanger: isDangerArg };

  const modal = document.getElementById("confirm-modal");
  if (!modal) return Promise.resolve(window.confirm(`${opts.title}\n\n${opts.message}`));

  const titleEl = document.getElementById("confirm-modal-title");
  const msgEl = document.getElementById("confirm-modal-message");
  const okBtn = document.getElementById("confirm-ok-btn");
  const cancelBtn = document.getElementById("confirm-cancel-btn");
  const iconEl = document.getElementById("confirm-modal-icon");
  const typedWrap = document.getElementById("confirm-typed-wrap");
  const typedLabel = document.getElementById("confirm-typed-label");
  const typedInput = document.getElementById("confirm-typed-input");
  const typedError = document.getElementById("confirm-typed-error");

  const requiredMatch = typeof opts.requireTypedValue === "string"
    ? opts.requireTypedValue.trim().toLowerCase()
    : "";

  titleEl.textContent = opts.title || "Confirm Action";
  msgEl.textContent = opts.message || "";
  iconEl.textContent = opts.isDanger ? "⚠️" : "✅";
  okBtn.className = opts.isDanger ? "modal-btn danger" : "modal-btn primary";
  okBtn.textContent = opts.confirmText || (opts.isDanger ? "Yes, suspend" : "Yes, approve");

  if (typedWrap && typedInput && typedLabel && typedError) {
    if (requiredMatch) {
      typedWrap.hidden = false;
      typedLabel.textContent = opts.typedPromptLabel || `Type "${requiredMatch}" to confirm`;
      typedInput.value = "";
      typedInput.placeholder = requiredMatch;
      typedError.hidden = true;
      okBtn.disabled = true;
    } else {
      typedWrap.hidden = true;
      typedInput.value = "";
      typedError.hidden = true;
      okBtn.disabled = false;
    }
  }

  modal.hidden = false;
  if (requiredMatch && typedInput) {
    window.setTimeout(() => typedInput.focus(), 20);
  }

  return new Promise((resolve) => {
    const syncTypedState = () => {
      if (!requiredMatch || !typedInput) return;
      const matches = typedInput.value.trim().toLowerCase() === requiredMatch;
      okBtn.disabled = !matches;
      if (typedError) typedError.hidden = matches || typedInput.value.trim().length === 0;
    };

    const cleanup = (confirmed) => {
      modal.hidden = true;
      okBtn.disabled = false;
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      typedInput?.removeEventListener("input", syncTypedState);
      window.removeEventListener("keydown", onKeyDown);
      resolve(confirmed);
    };

    const onOk = () => {
      if (requiredMatch && typedInput?.value.trim().toLowerCase() !== requiredMatch) {
        if (typedError) {
          typedError.textContent = `Please type "${requiredMatch}" exactly to confirm.`;
          typedError.hidden = false;
        }
        return;
      }
      cleanup(true);
    };
    const onCancel = () => cleanup(false);
    const onKeyDown = (event) => {
      if (event.key === "Escape") cleanup(false);
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    typedInput?.addEventListener("input", syncTypedState);
    window.addEventListener("keydown", onKeyDown);
  });
}
