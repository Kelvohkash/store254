async function handleOnboardSubmit(e) {
      e.preventDefault();
      const btn = document.getElementById("btn-onboard");
      btn.disabled = true;
      btn.textContent = "Submitting...";

      const payload = {
        storeName: document.getElementById("onboard-name").value.trim(),
        subdomain: document.getElementById("onboard-subdomain").value.trim(),
        businessType: document.getElementById("onboard-type").value,
        storefrontTemplate: document.getElementById("onboard-storefront-template")?.value || "market-modern",
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
