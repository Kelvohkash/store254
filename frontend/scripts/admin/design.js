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
  const settings = {
    storefrontTemplate: document.getElementById("settings-storefront-template").value,
    storefrontTemplateVersion: 1,
    themePalette: document.getElementById("settings-theme-palette").value,
    primaryColor: document.getElementById("settings-primary-color").value,
    backgroundColor: document.getElementById("settings-background-color").value,
  };
  status.textContent = "Applying your storefront look…";
  const response = await apiFetch("/store/settings", { method: "PATCH", body: JSON.stringify({ settings }) });
  if (response.ok) {
    currentStoreDesign.settings = { ...currentStoreDesign.settings, ...settings };
    status.textContent = "Your storefront look is live.";
    showToast("Your storefront look is live!");
  } else {
    status.textContent = "We could not apply that look. Try again.";
    showToast(apiErrorMessage(response, "Failed to apply storefront look."), false);
  }
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
