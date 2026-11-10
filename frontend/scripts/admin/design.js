// Store appearance: shared catalog, template choice, palette choice, and preview.
let storefrontTemplateCatalog = { templates: [], palettes: [] };
let currentStoreDesign = { name: "Your Store", settings: {} };

async function fetchStorefrontTemplateCatalog() {
  const response = await fetch("/templates/catalog.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("Could not load the storefront template catalog.");
  const catalog = await response.json();
  if (!Array.isArray(catalog.templates) || !Array.isArray(catalog.palettes)) {
    throw new Error("The storefront template catalog is not valid.");
  }
  storefrontTemplateCatalog = catalog;
}

function selectStoreTemplate(templateId) {
  const template = (storefrontTemplateCatalog.templates || []).find((entry) => entry.id === templateId)
    || storefrontTemplateCatalog.templates?.[0];
  if (!template) return;
  const tplInput = document.getElementById("settings-storefront-template");
  if (tplInput) tplInput.value = template.id;
  document.querySelectorAll(".template-choice").forEach((button) => {
    const selected = button.dataset.template === template.id;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const defaults = template.defaults || {};
  const setIfExist = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  setIfExist("settings-storefront-archetype", defaults.archetype || "modern-retailer");
  setIfExist("settings-header-variant", defaults.header || "compact-search-first");
  setIfExist("settings-product-card-style", defaults.card || "grid-card");
  setIfExist("settings-hero-style", defaults.hero || "split");
  setIfExist("settings-heading-font", defaults.font || "modern");
  if (typeof updateDesignPreview === "function") updateDesignPreview();
}

function setDesignPreviewSize(size, button) {
  const stage = document.getElementById("design-preview-stage");
  if (stage) stage.dataset.previewSize = size;
  document.querySelectorAll(".design-preview-controls button").forEach((item) => {
    item.classList.toggle("is-active", item === button);
    item.setAttribute("aria-pressed", String(item === button));
  });
}

function selectThemePalette(paletteId) {
  const palette = (storefrontTemplateCatalog.palettes || []).find((entry) => entry.id === paletteId)
    || storefrontTemplateCatalog.palettes?.[0];
  if (!palette) return;
  const palInput = document.getElementById("settings-theme-palette");
  const priInput = document.getElementById("settings-primary-color");
  const bgInput = document.getElementById("settings-background-color");
  if (palInput) palInput.value = palette.id;
  if (priInput) priInput.value = palette.primary;
  if (bgInput) bgInput.value = palette.background;
  const fgPicker = document.getElementById("settings-primary-color-picker");
  const bgPicker = document.getElementById("settings-background-color-picker");
  const fgHex = document.getElementById("foreground-color-hex");
  const bgHex = document.getElementById("background-color-hex");
  if (fgPicker) fgPicker.value = palette.primary;
  if (bgPicker) bgPicker.value = palette.background;
  if (fgHex) fgHex.textContent = palette.primary;
  if (bgHex) bgHex.textContent = palette.background;
  document.querySelectorAll(".template-palette-choice").forEach((button) => {
    const selected = button.dataset.palette === palette.id;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const palNameEl = document.getElementById("selected-palette-name");
  if (palNameEl) palNameEl.textContent = palette.name;
  if (typeof updateDesignPreview === "function") updateDesignPreview();
}

async function loadSettings() {
  const [catalogResult, storeResult] = await Promise.allSettled([
    fetchStorefrontTemplateCatalog(),
    apiFetch("/store"),
  ]);
  if (catalogResult.status === "rejected") {
    showToast("Could not load storefront templates. Refresh and try again.", false);
    return;
  }
  if (typeof renderTemplateChoices === "function") renderTemplateChoices();
  if (typeof renderPaletteChoices === "function") renderPaletteChoices();
  if (storeResult.status !== "fulfilled" || !storeResult.value.ok || !storeResult.value.data?.data) {
    selectStoreTemplate("market-modern");
    selectThemePalette("trust-forest");
    return;
  }

  currentStoreDesign = storeResult.value.data.data;
  const settings = currentStoreDesign.settings || {};
  const socials = settings.socialLinks || {};

  // Populate store profile, branding, contact, and social fields
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? "";
  };
  setVal("settings-name", currentStoreDesign.name || "");
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

  const savedTemplate = storefrontTemplateCatalog.templates.some((entry) => entry.id === settings.storefrontTemplate)
    ? settings.storefrontTemplate
    : "market-modern";
  const savedPalette = storefrontTemplateCatalog.palettes.some((entry) => entry.id === settings.themePalette)
    ? settings.themePalette
    : "trust-forest";
  selectStoreTemplate(savedTemplate);
  selectThemePalette(savedPalette);
  if (settings.primaryColor || settings.backgroundColor) {
    const paletteObj = storefrontTemplateCatalog.palettes.find((p) => p.id === savedPalette) || storefrontTemplateCatalog.palettes[0];
    if (typeof selectCustomStoreColors === "function") {
      selectCustomStoreColors(
        settings.primaryColor || paletteObj.primary,
        settings.backgroundColor || paletteObj.background
      );
    }
  }
}

async function saveStoreSettings(event) {
  event.preventDefault();
  const status = document.getElementById("design-draft-status");
  const name = document.getElementById("settings-name")?.value.trim() || currentStoreDesign.name;
  const settings = {
    storefrontTemplate: document.getElementById("settings-storefront-template").value,
    storefrontTemplateVersion: 1,
    themePalette: document.getElementById("settings-theme-palette").value,
    primaryColor: document.getElementById("settings-primary-color").value,
    backgroundColor: document.getElementById("settings-background-color").value,
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
  const response = await apiFetch("/store/settings", {
    method: "PATCH",
    body: JSON.stringify({ name, settings }),
  });
  if (response.ok) {
    currentStoreDesign.name = name;
    currentStoreDesign.settings = { ...currentStoreDesign.settings, ...settings };
    const sideName = document.getElementById("sidebar-store-name");
    if (sideName) sideName.textContent = name;
    if (status) status.textContent = "Your store profile and design are live.";
    showToast("Store settings saved!");
  } else {
    if (status) status.textContent = "We could not save those settings. Try again.";
    showToast(apiErrorMessage(response, "Failed to save store settings."), false);
  }
}
