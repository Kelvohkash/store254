// BRANDING MEDIA UPLOAD & CUSTOM DOMAIN SETTINGS
// ═══════════════════════════════════════

function updateBrandingMediaPreview(targetInputId, url) {
  const wrap = document.getElementById(`${targetInputId}-preview-wrap`);
  const img = document.getElementById(`${targetInputId}-preview`);
  if (!wrap || !img) return;
  const cleanUrl = String(url || "").trim();
  if (!cleanUrl) {
    img.removeAttribute("src");
    wrap.classList.add("hidden");
    return;
  }
  img.src = cleanUrl;
  img.onerror = () => {
    wrap.classList.add("hidden");
  };
  wrap.classList.remove("hidden");
}

async function persistBrandingMediaField(targetInputId, url) {
  const fieldKey = String(targetInputId || "").toLowerCase().includes("logo") ? "logoUrl" : "bannerUrl";
  const cleanUrl = String(url || "").trim();
  const r = await apiFetch("/store/settings", {
    method: "PATCH",
    body: JSON.stringify({ settings: { [fieldKey]: cleanUrl } }),
  });
  if (r.ok) {
    if (typeof currentStoreDesign === "object" && currentStoreDesign) {
      currentStoreDesign.settings = { ...(currentStoreDesign.settings || {}), [fieldKey]: cleanUrl };
    }
    const status = document.getElementById("design-draft-status");
    if (status) {
      status.textContent = cleanUrl
        ? `Your ${fieldKey === "logoUrl" ? "logo" : "hero banner"} is live on your storefront.`
        : `Your ${fieldKey === "logoUrl" ? "logo" : "hero banner"} was removed from your storefront.`;
    }
    return true;
  }
  return false;
}

async function clearStoreBrandingImage(targetInputId) {
  const input = document.getElementById(targetInputId);
  if (input) input.value = "";
  updateBrandingMediaPreview(targetInputId, "");
  const saved = await persistBrandingMediaField(targetInputId, "");
  if (saved) {
    showToast("Image removed from your storefront!");
  } else {
    showToast("Cleared locally. Click Save & Apply to publish.");
  }
}

async function uploadStoreBrandingImage(targetInputId, fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return;
  const presetKind = String(targetInputId || "").toLowerCase().includes("logo") ? "logo" : "banner";
  const optimizer = window.StoreMediaOptimizer;

  showToast("Optimizing & uploading image...");
  let uploadFile = file;
  let resultMeta = null;
  if (optimizer?.optimizeImageFileForUpload) {
    resultMeta = await optimizer.optimizeImageFileForUpload(file, presetKind);
    uploadFile = resultMeta.file || file;
  }

  const formData = new FormData();
  formData.append("file", uploadFile);
  const r = await apiFetch("/store/settings/media", { method: "POST", body: formData });
  fileInput.value = "";
  if (r.ok && r.data?.data?.url) {
    const uploadedUrl = r.data.data.url;
    const input = document.getElementById(targetInputId);
    if (input) input.value = uploadedUrl;
    updateBrandingMediaPreview(targetInputId, uploadedUrl);
    const saved = await persistBrandingMediaField(targetInputId, uploadedUrl);
    if (resultMeta?.wasOptimized && optimizer?.formatImageBytes && resultMeta.optimizedBytes < resultMeta.originalBytes) {
      const savedBytes = `${optimizer.formatImageBytes(resultMeta.originalBytes)} → ${optimizer.formatImageBytes(resultMeta.optimizedBytes)}`;
      showToast(saved ? `Image optimized (${savedBytes}) & published live!` : `Image optimized (${savedBytes}) & uploaded! Click Save & Apply to publish.`);
    } else {
      showToast(saved ? "Image uploaded and published live!" : "Image uploaded! Click Save & Apply to publish.");
    }
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
