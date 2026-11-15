// Store appearance: profile fields and accent colour.
let currentStoreDesign = { name: "Your Store", settings: {} };

async function loadSettings() {
  const result = await apiFetch("/store");
  if (!result.ok || !result.data?.data) return;
  currentStoreDesign = result.data.data;
  const settings = currentStoreDesign.settings || {};
  const socials = settings.socialLinks || {};
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? "";
  };
  setVal("settings-name", currentStoreDesign.name || "");
  const accentColors = ["#2563eb", "#0284c7", "#16805a", "#0d9488", "#8b3fa5", "#4f46e5", "#9a3412", "#d97706", "#0f172a"];
  setVal("settings-primary-color", accentColors.includes(settings.primaryColor) ? settings.primaryColor : "#2563eb");
  setVal("settings-product-card-style", settings.productCardStyle || "grid-card");
  setVal("settings-tagline", settings.tagline || "");
  setVal("settings-description", settings.description || "");
  setVal("settings-logo", settings.logoUrl || "");
  setVal("settings-banner", settings.bannerUrl || "");
  setVal("settings-phone", settings.contactPhone || "");
  setVal("settings-whatsapp", socials.whatsapp || "");
  setVal("settings-email", settings.contactEmail || "");
  setVal("settings-address", settings.physicalAddress || "");
  setVal("settings-instagram", socials.instagram || "");
  setVal("settings-facebook", socials.facebook || "");
  setVal("settings-tiktok", socials.tiktok || "");
  setVal("settings-custom-domain", currentStoreDesign.customDomain || "");
}

async function saveStoreSettings(event) {
  event.preventDefault();
  const status = document.getElementById("design-draft-status");
  const name = document.getElementById("settings-name")?.value.trim() || currentStoreDesign.name;
  const settings = {
    primaryColor: document.getElementById("settings-primary-color")?.value || "#9a3412",
    productCardStyle: document.getElementById("settings-product-card-style")?.value || "grid-card",
    tagline: document.getElementById("settings-tagline")?.value.trim() || undefined,
    description: document.getElementById("settings-description")?.value.trim() || undefined,
    logoUrl: document.getElementById("settings-logo")?.value.trim() || "",
    bannerUrl: document.getElementById("settings-banner")?.value.trim() || "",
    contactPhone: document.getElementById("settings-phone")?.value.trim() || undefined,
    contactEmail: document.getElementById("settings-email")?.value.trim() || "",
    physicalAddress: document.getElementById("settings-address")?.value.trim() || undefined,
    socialLinks: {
      whatsapp: document.getElementById("settings-whatsapp")?.value.trim() || undefined,
      instagram: document.getElementById("settings-instagram")?.value.trim() || undefined,
      facebook: document.getElementById("settings-facebook")?.value.trim() || undefined,
      tiktok: document.getElementById("settings-tiktok")?.value.trim() || undefined,
    },
  };
  if (status) status.textContent = "Applying your storefront settings…";
  const response = await apiFetch("/store/settings", { method: "PATCH", body: JSON.stringify({ name, settings }) });
  if (response.ok) {
    currentStoreDesign.name = name;
    currentStoreDesign.settings = { ...currentStoreDesign.settings, ...settings };
    const sideName = document.getElementById("sidebar-store-name");
    if (sideName) sideName.textContent = name;
    if (status) status.textContent = "Your store profile and accent colour are live.";
    showToast("Store settings saved!");
  } else {
    if (status) status.textContent = "We could not save those settings. Try again.";
    showToast(apiErrorMessage(response, "Failed to save store settings."), false);
  }
}

const STAFF_PERMISSION_OPTIONS = [
  { key: "manage_products", label: "Add & edit products" },
  { key: "manage_categories", label: "Categories & filters" },
  { key: "manage_orders", label: "View & fulfill orders" },
  { key: "delete_orders", label: "Delete unpaid orders" },
  { key: "manage_settings", label: "Store profile & design" },
  { key: "manage_payments", label: "M-Pesa & subscription" },
];

let cachedStaffAccounts = [];

function escapeDesignHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setAdminInlineFeedback(elId, message, isError = false) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!message) {
    el.textContent = "";
    el.className = "hidden rounded-xl px-4 py-2.5 text-xs font-semibold border";
    return;
  }
  el.textContent = message;
  el.className = isError
    ? "rounded-xl px-4 py-2.5 text-xs font-semibold border bg-red-50 border-red-200 text-red-700"
    : "rounded-xl px-4 py-2.5 text-xs font-semibold border bg-emerald-50 border-emerald-200 text-emerald-800";
}

async function handleChangeStorePassword(event) {
  event.preventDefault();
  const currentPassword = document.getElementById("settings-current-password")?.value || "";
  const newPassword = document.getElementById("settings-new-password")?.value || "";
  const confirmPassword = document.getElementById("settings-confirm-password")?.value || "";
  const btn = document.getElementById("settings-password-save-btn");

  setAdminInlineFeedback("settings-password-feedback", "");
  if (newPassword.length < 8) {
    setAdminInlineFeedback("settings-password-feedback", "New password must be at least 8 characters.", true);
    return;
  }
  if (newPassword !== confirmPassword) {
    setAdminInlineFeedback("settings-password-feedback", "New password and confirmation do not match.", true);
    return;
  }

  if (btn) btn.disabled = true;
  const r = await apiFetch("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (btn) btn.disabled = false;

  if (!r.ok) {
    setAdminInlineFeedback("settings-password-feedback", apiErrorMessage(r, "Could not update password."), true);
    return;
  }

  ["settings-current-password", "settings-new-password", "settings-confirm-password"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });
  setAdminInlineFeedback("settings-password-feedback", r.data?.message || "Store password updated successfully.", false);
  showToast("Store password updated!");
}

async function loadStaffAccounts() {
  const listEl = document.getElementById("staff-accounts-list");
  if (!listEl || currentAdminUser?.role !== "OWNER") return;
  listEl.innerHTML = '<p class="text-xs text-slate-400 py-2">Loading staff accounts…</p>';

  const r = await apiFetch("/auth/staff");
  if (!r.ok || !r.data?.data) {
    listEl.innerHTML = `<p class="text-xs text-red-600 py-2">${escapeDesignHtml(apiErrorMessage(r, "Failed to load staff accounts."))}</p>`;
    return;
  }

  cachedStaffAccounts = Array.isArray(r.data.data.staff) ? r.data.data.staff : [];
  renderStaffAccounts();
}

function renderStaffAccounts() {
  const listEl = document.getElementById("staff-accounts-list");
  if (!listEl) return;

  if (!cachedStaffAccounts.length) {
    listEl.innerHTML = '<p class="text-xs text-slate-500 rounded-xl border border-dashed border-slate-200 p-4 text-center">No staff accounts created yet. Add one above to give team members a separate password and selected rights.</p>';
    return;
  }

  listEl.innerHTML = cachedStaffAccounts
    .map((staff) => {
      const perms = new Set(Array.isArray(staff.permissions) ? staff.permissions : []);
      const isSuspended = staff.status === "SUSPENDED";
      const safeId = escapeDesignHtml(staff.id);
      return `
        <div class="rounded-2xl border border-slate-200 bg-white p-4 space-y-3" data-staff-card="${safeId}">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm font-extrabold text-slate-900">${escapeDesignHtml(staff.fullName || staff.email)}</p>
                <span class="text-[10px] font-black px-2 py-0.5 rounded-full ${isSuspended ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800"}">${escapeDesignHtml(staff.status || "ACTIVE")}</span>
              </div>
              <p class="text-xs text-slate-500 font-mono truncate mt-0.5">${escapeDesignHtml(staff.email)}</p>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <button type="button" onclick="toggleStaffPasswordReset('${safeId}')" class="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-bold text-slate-700">Set Password</button>
              <button type="button" onclick="handleToggleStaffStatus('${safeId}', '${isSuspended ? "ACTIVE" : "SUSPENDED"}')" class="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700">${isSuspended ? "Activate" : "Suspend"}</button>
              <button type="button" onclick="handleDeleteStaffAccount('${safeId}')" class="px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[11px] font-bold text-red-700">Remove</button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs font-semibold text-slate-700">
            ${STAFF_PERMISSION_OPTIONS.map(
              (opt) => `
              <label class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 cursor-pointer">
                <input type="checkbox" data-staff-perm="${safeId}" value="${opt.key}" ${perms.has(opt.key) ? "checked" : ""} class="rounded border-slate-300 text-emerald-600" />
                <span>${escapeDesignHtml(opt.label)}</span>
              </label>
            `
            ).join("")}
          </div>

          <div id="staff-reset-wrap-${safeId}" class="hidden rounded-xl border border-amber-200 bg-amber-50/70 p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input id="staff-reset-input-${safeId}" type="password" minlength="8" class="input text-xs flex-1 bg-white" placeholder="New staff password (min 8 characters)" />
            <button type="button" onclick="handleResetStaffPassword('${safeId}')" class="btn-primary text-xs py-2 px-3 shrink-0">Save Password</button>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-slate-100">
            <span class="text-[11px] text-slate-400">Updated rights apply immediately on staff requests.</span>
            <button type="button" onclick="handleSaveStaffPermissions('${safeId}')" class="btn-secondary text-xs py-1.5 px-3">Save Rights</button>
          </div>
        </div>
      `;
    })
    .join("");
  if (window.lucide?.createIcons) lucide.createIcons();
}

async function handleCreateStaffAccount(event) {
  event.preventDefault();
  const fullName = document.getElementById("staff-full-name")?.value.trim() || "";
  const email = document.getElementById("staff-email")?.value.trim() || "";
  const password = document.getElementById("staff-password")?.value || "";
  const permissions = Array.from(document.querySelectorAll('#staff-account-form input[name="staff-perm"]:checked')).map((el) => el.value);
  const btn = document.getElementById("staff-create-btn");

  setAdminInlineFeedback("staff-form-feedback", "");
  if (permissions.length === 0) {
    setAdminInlineFeedback("staff-form-feedback", "Select at least one permission for this staff account.", true);
    return;
  }

  if (btn) btn.disabled = true;
  const r = await apiFetch("/auth/staff", {
    method: "POST",
    body: JSON.stringify({
      fullName,
      email: email || undefined,
      password,
      permissions,
    }),
  });
  if (btn) btn.disabled = false;

  if (!r.ok) {
    setAdminInlineFeedback("staff-form-feedback", apiErrorMessage(r, "Could not create staff account."), true);
    return;
  }

  const createdEmail = r.data?.data?.email || "";
  ["staff-full-name", "staff-email", "staff-password"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  setAdminInlineFeedback(
    "staff-form-feedback",
    `Staff account ready! Login ID: ${createdEmail || fullName}`,
    false
  );
  showToast("Staff account created!");
  await loadStaffAccounts();
}

async function handleSaveStaffPermissions(staffId) {
  const checked = Array.from(document.querySelectorAll(`input[data-staff-perm="${CSS.escape(staffId)}"]:checked`)).map((el) => el.value);
  if (checked.length === 0) {
    showToast("Select at least one right for this staff account.", false);
    return;
  }
  const r = await apiFetch(`/auth/staff/${encodeURIComponent(staffId)}`, {
    method: "PATCH",
    body: JSON.stringify({ permissions: checked }),
  });
  if (!r.ok) {
    showToast(apiErrorMessage(r, "Failed to update staff rights."), false);
    return;
  }
  showToast("Staff access rights updated!");
  await loadStaffAccounts();
}

function toggleStaffPasswordReset(staffId) {
  const wrap = document.getElementById(`staff-reset-wrap-${staffId}`);
  if (!wrap) return;
  wrap.classList.toggle("hidden");
  if (!wrap.classList.contains("hidden")) {
    document.getElementById(`staff-reset-input-${staffId}`)?.focus();
  }
}

async function handleResetStaffPassword(staffId) {
  const input = document.getElementById(`staff-reset-input-${staffId}`);
  const password = input?.value || "";
  if (password.length < 8) {
    showToast("Staff password must be at least 8 characters.", false);
    return;
  }
  const r = await apiFetch(`/auth/staff/${encodeURIComponent(staffId)}`, {
    method: "PATCH",
    body: JSON.stringify({ password }),
  });
  if (!r.ok) {
    showToast(apiErrorMessage(r, "Failed to update staff password."), false);
    return;
  }
  if (input) input.value = "";
  document.getElementById(`staff-reset-wrap-${staffId}`)?.classList.add("hidden");
  showToast("Staff password updated!");
}

async function handleToggleStaffStatus(staffId, nextStatus) {
  const r = await apiFetch(`/auth/staff/${encodeURIComponent(staffId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: nextStatus }),
  });
  if (!r.ok) {
    showToast(apiErrorMessage(r, "Could not update staff status."), false);
    return;
  }
  showToast(nextStatus === "SUSPENDED" ? "Staff account suspended." : "Staff account activated!");
  await loadStaffAccounts();
}

async function handleDeleteStaffAccount(staffId) {
  if (!window.confirm("Remove this staff account? They will no longer be able to sign in.")) return;
  const r = await apiFetch(`/auth/staff/${encodeURIComponent(staffId)}`, { method: "DELETE" });
  if (!r.ok) {
    showToast(apiErrorMessage(r, "Could not remove staff account."), false);
    return;
  }
  showToast("Staff account removed.");
  await loadStaffAccounts();
}
