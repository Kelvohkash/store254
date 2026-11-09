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

function renderTemplateChoices() {
  const grid = document.getElementById("template-choice-grid");
  grid.replaceChildren();
  storefrontTemplateCatalog.templates.forEach((template) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "template-choice";
    button.dataset.template = template.id;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `${template.name}. ${template.description || "Storefront template"}`);

    const image = document.createElement("span");
    image.className = "template-thumb";
    image.dataset.template = template.id;
    image.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 3; index += 1) image.append(document.createElement("i"));

    const name = document.createElement("strong");
    name.textContent = template.name;
    const description = document.createElement("small");
    description.textContent = template.description || "Storefront template";
    button.append(image, name, description);
    button.addEventListener("click", () => selectStoreTemplate(template.id));
    grid.append(button);
  });
}

function renderPaletteChoices() {
  const group = document.getElementById("template-palette-choices");
  group.replaceChildren();
  storefrontTemplateCatalog.palettes.forEach((palette) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "template-palette-choice";
    button.dataset.palette = palette.id;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `${palette.name} colour palette`);
    button.title = palette.name;
    button.style.setProperty("--palette-color", palette.primary);
    const swatch = document.createElement("span");
    swatch.className = "template-palette-swatch";
    const label = document.createElement("span");
    label.textContent = palette.name;
    button.append(swatch, label);
    button.addEventListener("click", () => selectThemePalette(palette.id));
    group.append(button);
  });
}

function selectStoreTemplate(templateId) {
  const template = storefrontTemplateCatalog.templates.find((entry) => entry.id === templateId)
    || storefrontTemplateCatalog.templates[0];
  if (!template) return;
  document.getElementById("settings-storefront-template").value = template.id;
  document.querySelectorAll(".template-choice").forEach((button) => {
    const selected = button.dataset.template === template.id;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const defaults = template.defaults || {};
  document.getElementById("settings-storefront-archetype").value = defaults.archetype || "modern-retailer";
  document.getElementById("settings-header-variant").value = defaults.header || "compact-search-first";
  document.getElementById("settings-product-card-style").value = defaults.card || "grid-card";
  document.getElementById("settings-hero-style").value = defaults.hero || "split";
  document.getElementById("settings-heading-font").value = defaults.font || "modern";
  updateDesignPreview();
}

function selectThemePalette(paletteId) {
  const palette = storefrontTemplateCatalog.palettes.find((entry) => entry.id === paletteId)
    || storefrontTemplateCatalog.palettes[0];
  if (!palette) return;
  document.getElementById("settings-theme-palette").value = palette.id;
  document.getElementById("settings-primary-color").value = palette.primary;
  document.getElementById("settings-background-color").value = palette.background;
  document.querySelectorAll(".template-palette-choice").forEach((button) => {
    const selected = button.dataset.palette === palette.id;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  document.getElementById("selected-palette-name").textContent = palette.name;
  updateDesignPreview();
}

function setDesignPreviewSize(size, button) {
  const stage = document.getElementById("design-preview-stage");
  stage.dataset.previewSize = size;
  document.querySelectorAll(".design-preview-controls button").forEach((item) => {
    item.classList.toggle("is-active", item === button);
    item.setAttribute("aria-pressed", String(item === button));
  });
}

function updateDesignPreview() {
  const stage = document.getElementById("design-preview-stage");
  if (!stage) return;
  const template = storefrontTemplateCatalog.templates.find((entry) => entry.id === document.getElementById("settings-storefront-template").value)
    || storefrontTemplateCatalog.templates[0];
  const palette = storefrontTemplateCatalog.palettes.find((entry) => entry.id === document.getElementById("settings-theme-palette").value)
    || storefrontTemplateCatalog.palettes[0];
  if (!template || !palette) return;

  const defaults = template.defaults || {};
  const storeName = currentStoreDesign.name || "Your Store";
  stage.dataset.template = template.id;
  stage.style.setProperty("--preview-primary", palette.primary);
  stage.style.setProperty("--preview-bg", palette.background);
  stage.style.setProperty("--preview-ink", getContrastTextColor(palette.background));
  stage.style.setProperty("--preview-on-primary", getContrastTextColor(palette.primary));
  stage.dataset.headingFont = defaults.font || "modern";
  stage.dataset.heroStyle = defaults.hero || "split";
  stage.dataset.cardStyle = defaults.card || "grid-card";
  stage.dataset.headerVariant = defaults.header || "compact-search-first";
  document.getElementById("design-preview-store").textContent = storeName;
  document.getElementById("design-preview-heading").textContent = template.name;
  document.getElementById("design-preview-mark").textContent = storeName.trim().slice(0, 1).toUpperCase() || "S";
  document.getElementById("design-preview-kicker").textContent = defaults.kicker || "YOUR COLLECTION";
  document.getElementById("design-preview-title").textContent = (defaults.title || "Good things,<br>chosen well.").replace(/<br\s*\/?>/gi, " ");
  document.getElementById("design-preview-button").textContent = defaults.cta || "Explore collection";
  document.getElementById("design-preview-description").textContent = `${template.name} · ${palette.name} palette · your products and prices`;
}

function getContrastTextColor(hex) {
  const value = String(hex || "#ffffff").replace("#", "");
  const normalized = value.length === 3 ? [...value].map((digit) => digit + digit).join("") : value;
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const luminance = channels
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.179 ? "#0f172a" : "#ffffff";
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
  renderTemplateChoices();
  renderPaletteChoices();
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
  status.textContent = "Applying your storefront settings…";
  const response = await apiFetch("/store/settings", {
    method: "PATCH",
    body: JSON.stringify({ name, settings }),
  });
  if (response.ok) {
    currentStoreDesign.name = name;
    currentStoreDesign.settings = { ...currentStoreDesign.settings, ...settings };
    document.getElementById("sidebar-store-name").textContent = name;
    status.textContent = "Your store profile and design are live.";
    showToast("Store settings saved!");
  } else {
    status.textContent = "We could not save those settings. Try again.";
    showToast(apiErrorMessage(response, "Failed to save store settings."), false);
  }
}

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

window.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("template-choice-grid");
  grid?.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const choices = [...grid.querySelectorAll(".template-choice")];
    const currentIndex = choices.indexOf(document.activeElement);
    if (currentIndex < 0) return;
    event.preventDefault();
    choices[(currentIndex + (event.key === "ArrowRight" ? 1 : -1) + choices.length) % choices.length]?.focus();
  });
});
