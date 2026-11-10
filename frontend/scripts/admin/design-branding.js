// BRANDING MEDIA UPLOAD & CUSTOM DOMAIN SETTINGS
// ═══════════════════════════════════════

async function uploadStoreBrandingImage(targetInputId, fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return;
  showToast("Uploading image...");
  const formData = new FormData();
  formData.append("file", file);
  const r = await apiFetch("/store/settings/media", { method: "POST", body: formData });
  fileInput.value = "";
  if (r.ok && r.data?.data?.url) {
    const input = document.getElementById(targetInputId);
    if (input) input.value = r.data.data.url;
    showToast("Image uploaded! Click Save & Apply to publish.");
  } else {
    showToast(apiErrorMessage(r, "Failed to upload image."), false);
  }
}

async function saveCustomDomain(event) {
  event.preventDefault();
  const domainInput = document.getElementById("settings-custom-domain");
  const dnsBox = document.getElementById("custom-domain-dns-box");
  const customDomain = domainInput?.value.trim().toLowerCase();
  if (!customDomain) return;

  const r = await apiFetch("/store/settings/custom-domain", {
    method: "PUT",
    body: JSON.stringify({ customDomain }),
  });
  if (!r.ok) {
    showToast(apiErrorMessage(r, "Could not map custom domain."), false);
    return;
  }
  const dns = r.data?.data?.dnsInstructions;
  if (dns && dnsBox) {
    dnsBox.innerHTML = `
      <p class="font-bold text-slate-900">DNS Configuration Required:</p>
      <p>Type: <strong class="font-mono">${escHtml(dns.recordType)}</strong> · Host: <strong class="font-mono">${escHtml(dns.host)}</strong> → Points to: <strong class="font-mono text-emerald-700">${escHtml(dns.pointsTo)}</strong></p>
    `;
    dnsBox.classList.remove("hidden");
  }
  showToast("Custom domain saved!");
}
