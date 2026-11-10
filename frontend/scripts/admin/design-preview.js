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
  const templateSelect = document.getElementById("settings-storefront-template");
  const template = templates.find((entry) => entry.id === templateSelect?.value) || templates[0];
  if (!template) return;

  const primary = template.colors?.primary || "#15803d";
  const background = template.colors?.background || "#edf5ee";

  const defaults = template.defaults || {};
  const storeName = document.getElementById("settings-name")?.value.trim() || currentStoreDesign.name || "Your Store";
  stage.dataset.template = template.id;
  stage.style.setProperty("--preview-primary", primary);
  stage.style.setProperty("--preview-bg", background);
  stage.style.setProperty("--preview-ink", "#0f172a");
  stage.style.setProperty("--preview-on-primary", "#ffffff");
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
  if (descEl) descEl.textContent = `${template.name} · ${template.mood || "Self-contained template"} · your products and prices`;
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
