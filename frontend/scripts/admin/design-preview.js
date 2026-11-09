// DESIGN PREVIEW & SELECTION UI
// ═══════════════════════════════════════

function renderTemplateChoices() {
  const grid = document.getElementById("template-choice-grid");
  if (!grid) return;
  grid.replaceChildren();
  (storefrontTemplateCatalog.templates || []).forEach((template) => {
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
    if (template.mood) {
      const moodBadge = document.createElement("em");
      moodBadge.className = "template-mood-badge";
      moodBadge.textContent = template.mood;
      button.append(image, moodBadge, name);
    } else {
      button.append(image, name);
    }
    const description = document.createElement("small");
    description.textContent = template.description || "Storefront template";
    button.append(description);
    button.addEventListener("click", () => {
      if (typeof selectStoreTemplate === "function") selectStoreTemplate(template.id);
    });
    grid.append(button);
  });
}

function renderPaletteChoices() {
  const group = document.getElementById("template-palette-choices");
  if (!group) return;
  group.replaceChildren();
  (storefrontTemplateCatalog.palettes || []).forEach((palette) => {
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
    button.addEventListener("click", () => {
      if (typeof selectThemePalette === "function") selectThemePalette(palette.id);
    });
    group.append(button);
  });
}

function selectCustomStoreColors(foregroundColor, backgroundColor) {
  const fg = /^#[0-9a-f]{6}$/i.test(foregroundColor || "") ? foregroundColor.toLowerCase() : "#15803d";
  const bg = /^#[0-9a-f]{6}$/i.test(backgroundColor || "") ? backgroundColor.toLowerCase() : "#edf5ee";
  const fgInput = document.getElementById("settings-primary-color");
  const bgInput = document.getElementById("settings-background-color");
  if (fgInput) fgInput.value = fg;
  if (bgInput) bgInput.value = bg;
  const fgPicker = document.getElementById("settings-primary-color-picker");
  const bgPicker = document.getElementById("settings-background-color-picker");
  const fgHex = document.getElementById("foreground-color-hex");
  const bgHex = document.getElementById("background-color-hex");
  if (fgPicker) fgPicker.value = fg;
  if (bgPicker) bgPicker.value = bg;
  if (fgHex) fgHex.textContent = fg;
  if (bgHex) bgHex.textContent = bg;

  const matchedPalette = (storefrontTemplateCatalog.palettes || []).find(
    (entry) => entry.primary.toLowerCase() === fg && entry.background.toLowerCase() === bg
  );
  document.querySelectorAll(".template-palette-choice").forEach((button) => {
    const selected = Boolean(matchedPalette && button.dataset.palette === matchedPalette.id);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const paletteLabel = document.getElementById("selected-palette-name");
  if (paletteLabel) {
    paletteLabel.textContent = matchedPalette ? matchedPalette.name : "Custom (Auto-Contrast)";
  }
  updateDesignPreview();
}

function setDesignPreviewSize(size, button) {
  const stage = document.getElementById("design-preview-stage");
  if (stage) stage.dataset.previewSize = size;
  document.querySelectorAll(".design-preview-controls button").forEach((item) => {
    item.classList.toggle("is-active", item === button);
    item.setAttribute("aria-pressed", String(item === button));
  });
}

function updateDesignPreview() {
  const stage = document.getElementById("design-preview-stage");
  if (!stage) return;
  const templates = storefrontTemplateCatalog?.templates || [];
  const palettes = storefrontTemplateCatalog?.palettes || [];
  const templateSelect = document.getElementById("settings-storefront-template");
  const paletteSelect = document.getElementById("settings-theme-palette");
  const template = templates.find((entry) => entry.id === templateSelect?.value) || templates[0];
  const palette = palettes.find((entry) => entry.id === paletteSelect?.value) || palettes[0];
  if (!template || !palette) return;

  const rawPrimary = document.getElementById("settings-primary-color")?.value || palette.primary;
  const rawBg = document.getElementById("settings-background-color")?.value || palette.background;
  const resolved = typeof resolveAdminColorTokens === "function"
    ? resolveAdminColorTokens(rawPrimary, rawBg)
    : { primary: rawPrimary, background: rawBg, ink: "#0f172a", onPrimary: "#ffffff", wasAdjusted: false };

  const defaults = template.defaults || {};
  const storeName = document.getElementById("settings-name")?.value.trim() || currentStoreDesign.name || "Your Store";
  stage.dataset.template = template.id;
  stage.style.setProperty("--preview-primary", resolved.primary);
  stage.style.setProperty("--preview-bg", resolved.background);
  stage.style.setProperty("--preview-ink", resolved.ink);
  stage.style.setProperty("--preview-on-primary", resolved.onPrimary);
  const contrastNote = document.getElementById("design-contrast-note");
  if (contrastNote) {
    contrastNote.textContent = resolved.wasAdjusted
      ? `Visibility Guardrail Active: ${rawPrimary} on ${rawBg} was automatically balanced to ${resolved.primary} so all text and buttons remain 100% readable.`
      : `High-contrast pair verified (${resolved.primary} on ${resolved.background}). All text, surfaces, and buttons are automatically styled.`;
    contrastNote.classList.toggle("is-warning", resolved.wasAdjusted);
  }
  stage.dataset.headingFont = defaults.font || "modern";
  stage.dataset.heroStyle = defaults.hero || "split";
  stage.dataset.cardStyle = defaults.card || "grid-card";
  stage.dataset.headerVariant = defaults.header || "compact-search-first";
  const storeEl = document.getElementById("design-preview-store");
  if (storeEl) storeEl.textContent = storeName;
  const headingEl = document.getElementById("design-preview-heading");
  if (headingEl) headingEl.textContent = template.name;
  const markEl = document.getElementById("design-preview-mark");
  if (markEl) markEl.textContent = storeName.trim().slice(0, 1).toUpperCase() || "S";
  const kickerEl = document.getElementById("design-preview-kicker");
  if (kickerEl) kickerEl.textContent = defaults.kicker || "YOUR COLLECTION";
  const titleEl = document.getElementById("design-preview-title");
  if (titleEl) titleEl.textContent = (defaults.title || "Good things,<br>chosen well.").replace(/<br\s*\/?>/gi, " ");
  const btnEl = document.getElementById("design-preview-button");
  if (btnEl) btnEl.textContent = defaults.cta || "Explore collection";
  const descEl = document.getElementById("design-preview-description");
  if (descEl) descEl.textContent = `${template.name} · ${palette.name} palette · your products and prices`;
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
