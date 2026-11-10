// Storefront Public Template Gallery

let activeTemplateVibeFilter = "all";
let storefrontTemplateCatalogForOnboarding = { templates: [] };

function getTemplateVibeCategory(templateId) {
  if (templateId === "food-and-groceries") return "food";
  if (["fashion-and-design", "cosmetics"].includes(templateId)) return "fashion";
  if (templateId === "electronics") return "tech";
  if (["houses-and-rentals", "real-estate", "furniture-and-decor"].includes(templateId)) return "luxury";
  if (templateId === "hardware-and-autoparts") return "bold";
  return "fashion";
}

async function renderPublicTemplateGallery() {
  const gallery = document.getElementById("public-template-gallery");
  if (!gallery) return;

  const catalog = await loadStorefrontTemplateCatalog();
  storefrontTemplateCatalogForOnboarding = catalog;
  gallery.replaceChildren();

  // Setup vibe filter tabs
  document.querySelectorAll(".template-filter-tab").forEach((tab) => {
    tab.onclick = () => {
      activeTemplateVibeFilter = tab.dataset.vibeFilter || "all";
      document.querySelectorAll(".template-filter-tab").forEach((t) => t.classList.toggle("is-active", t === tab));
      filterGalleryCards();
    };
  });

  const templates = catalog?.templates || [];
  if (templates.length === 0) {
    gallery.innerHTML = `<p class="col-span-full text-center text-sm text-slate-500 py-12">Templates catalog currently unavailable.</p>`;
    return;
  }

  templates.forEach((template, index) => {
    const card = document.createElement("article");
    card.className = "template-gallery-card";
    card.dataset.template = template.id;
    card.dataset.vibe = getTemplateVibeCategory(template.id);

    const visual = document.createElement("div");
    visual.className = "template-gallery-art";
    visual.dataset.template = template.id;
    visual.innerHTML = buildMiniPreviewHtml(template);

    const caption = document.createElement("div");
    caption.className = "template-gallery-card-caption";
    const indexLabel = document.createElement("span");
    indexLabel.className = "template-gallery-index";
    indexLabel.textContent = String(index + 1).padStart(2, "0");

    const details = document.createElement("div");
    details.className = "template-gallery-details";

    const headerRow = document.createElement("div");
    headerRow.className = "template-gallery-header-row";
    const name = document.createElement("strong");
    name.textContent = template.name;
    headerRow.append(name);

    if (template.mood) {
      const moodBadge = document.createElement("span");
      moodBadge.className = "template-gallery-mood-badge";
      moodBadge.textContent = template.mood;
      headerRow.append(moodBadge);
    }

    const description = document.createElement("small");
    description.textContent = template.description || "A ready-to-use Store254 storefront design.";
    details.append(headerRow, description);
    caption.append(indexLabel, details);

    const actionRow = document.createElement("div");
    actionRow.className = "template-gallery-action-row";

    const action = document.createElement("button");
    action.type = "button";
    action.className = "template-gallery-start";
    action.textContent = "Start with this theme";
    action.addEventListener("click", () => startWithStorefrontTemplate(template.id));

    const previewLink = document.createElement("a");
    previewLink.className = "template-gallery-preview-link";
    previewLink.href = `/templates/${template.preview || `${template.id}/preview.html`}`;
    previewLink.target = "_blank";
    previewLink.rel = "noopener noreferrer";
    previewLink.title = `Open ${template.name} live template preview`;
    previewLink.innerHTML = "<span>Live preview</span> ↗";

    actionRow.append(action, previewLink);
    card.append(visual, caption, actionRow);
    gallery.append(card);
  });

  filterGalleryCards();
  renderIcons();
}

function filterGalleryCards() {
  document.querySelectorAll(".template-gallery-card").forEach((card) => {
    const cardVibe = card.dataset.vibe || "all";
    const show = activeTemplateVibeFilter === "all" || cardVibe === activeTemplateVibeFilter;
    card.style.display = show ? "" : "none";
  });
}

function startWithStorefrontTemplate(templateId) {
  const catalog = storefrontTemplateCatalogForOnboarding;
  const template = catalog?.templates?.find((entry) => entry.id === templateId)
    || catalog?.templates?.find((entry) => entry.id === "fashion-and-design");
  if (!template) return;
  const selectedTemplate = document.getElementById("onboard-storefront-template");
  const selectedLabel = document.getElementById("onboard-selected-theme");
  if (selectedTemplate) selectedTemplate.value = template.id;
  if (selectedLabel) selectedLabel.textContent = `Starting theme: ${template.name}`;
  const previewBadge = document.getElementById("onboard-template-selected-badge");
  if (previewBadge) {
    previewBadge.textContent = `Selected: ${template.name}`;
    previewBadge.classList.remove("hidden");
  }
  toggleDrawer("onboard-modal", true);
}

// Ensure the gallery renders independently of stores API
window.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("public-template-gallery")) {
    renderPublicTemplateGallery();
  }
});
