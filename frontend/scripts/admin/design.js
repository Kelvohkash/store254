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
