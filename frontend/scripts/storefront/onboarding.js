let subdomainCheckTimer = null;

function checkSubdomainAvailability(rawVal) {
  const statusEl = document.getElementById("onboard-subdomain-status");
  if (!statusEl) return;

  const subdomain = String(rawVal || "").toLowerCase().trim().replace(/[^a-z0-9-]/g, "");
  const inputEl = document.getElementById("onboard-subdomain");
  if (inputEl && inputEl.value !== subdomain) {
    inputEl.value = subdomain;
  }

  if (subdomainCheckTimer) clearTimeout(subdomainCheckTimer);

  if (subdomain.length < 3) {
    statusEl.textContent = subdomain.length > 0 ? "Subdomain must be at least 3 characters." : "";
    statusEl.className = "mt-1 text-[11px] font-semibold text-slate-400";
    statusEl.classList.toggle("hidden", subdomain.length === 0);
    return;
  }

  statusEl.textContent = "Checking availability…";
  statusEl.className = "mt-1 text-[11px] font-semibold text-slate-500";
  statusEl.classList.remove("hidden");

  subdomainCheckTimer = setTimeout(async () => {
    const res = await apiFetch(`/api/platform/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`);
    if (res.ok && res.data?.data) {
      if (res.data.data.available) {
        statusEl.textContent = `✓ ${subdomain}.store254.co.ke is available!`;
        statusEl.className = "mt-1 text-[11px] font-semibold text-emerald-600";
      } else {
        statusEl.textContent = `✕ ${res.data.data.reason || `${subdomain}.store254.co.ke is already taken.`}`;
        statusEl.className = "mt-1 text-[11px] font-semibold text-rose-600";
      }
    }
  }, 300);
}

async function handleOnboardSubmit(e) {
      e.preventDefault();
      const btn = document.getElementById("btn-onboard");
      btn.disabled = true;
      btn.textContent = "Submitting...";

      const payload = {
        storeName: document.getElementById("onboard-name").value.trim(),
        subdomain: document.getElementById("onboard-subdomain").value.trim(),
        businessType: document.getElementById("onboard-type").value,
        primaryColor: "#9a3412",
        ownerFullName: document.getElementById("onboard-owner-name").value.trim(),
        ownerEmail: document.getElementById("onboard-email").value.trim(),
        ownerPassword: document.getElementById("onboard-password").value,
      };

      const res = await apiFetch("/api/platform/register-store", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4"></i> <span>Submit Store Application</span>`;
      renderIcons();

      if (res.ok && res.data.success) {
        showToast("Application submitted! Pending Super Admin review.");
        toggleDrawer("onboard-modal", false);
      } else {
        showToast(res.data.error?.message || "Registration failed", "error");
      }
    }
