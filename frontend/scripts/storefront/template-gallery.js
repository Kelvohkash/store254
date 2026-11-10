// Storefront Public Template Gallery

function safeShowcaseImageUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function getTemplateVibeCategory(templateId) {
  if (["market-modern", "tech-home"].includes(templateId)) return "catalog";
  if (["cute-boutique", "food-local", "editorial-boutique", "fashion-beauty-cosmetics"].includes(templateId)) return "lifestyle";
  if (["luxury-atelier", "premium-maker", "service-studio"].includes(templateId)) return "maker";
  if (["brutalist-studio", "bazaar-vibrant"].includes(templateId)) return "bold";
  return "all";
}

async function renderPublicTemplateGallery() {
  const gallery = document.getElementById("public-template-gallery");
  if (!gallery) return;

  const catalog = await loadStorefrontTemplateCatalog();
  const templates = catalog.templates || [];
  if (templates.length === 0) {
    gallery.innerHTML = `<p class="col-span-full text-center text-sm text-slate-500 py-12">Templates catalog currently unavailable.</p>`;
    return;
  }

  gallery.innerHTML = templates.map((t) => {
    const defaults = t.defaults || {};
    const archetype = defaults.archetype || "modern-retailer";
    const vibe = getTemplateVibeCategory(t.id);
    const miniPreview = buildMiniPreviewHtml(t);

    return `
      <article class="template-gallery-card group" data-template-id="${escapeHtml(t.id)}" data-vibe="${vibe}" data-archetype="${escapeHtml(archetype)}">
        <!-- Interactive Miniature Store Mockup -->
        <div class="template-gallery-preview-wrapper" data-template-preview="${escapeHtml(t.id)}">
          <div class="template-mini-canvas">
            ${miniPreview}
          </div>
        </div>

        <!-- Card Meta Info -->
        <div class="template-gallery-meta p-5 flex flex-col flex-1 justify-between bg-white border-t border-slate-100">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                ${escapeHtml(archetype.replace(/-/g, " "))}
              </span>
              <span class="text-[11px] font-medium text-slate-400 capitalize">
                ${escapeHtml(defaults.font || "modern")} &bull; ${escapeHtml(defaults.hero || "split")}
              </span>
            </div>
            <h3 class="text-base font-bold text-slate-900 mb-1 group-hover:text-emerald-700 transition-colors">
              ${escapeHtml(t.name)}
            </h3>
            <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">
              ${escapeHtml(t.description || "Designed for Kenyan commerce with responsive mobile navigation and M-Pesa readiness.")}
            </p>
          </div>

          <div class="template-gallery-actions mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <a href="/templates/${escapeHtml(t.preview || "preview.html")}" target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-slate-600 hover:text-emerald-700 inline-flex items-center gap-1 transition-colors">
              <span>Full preview</span>
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            </a>
            <button type="button" onclick="startWithStorefrontTemplate('${escapeHtml(t.id)}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all">
              <span>Start with this</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  renderIcons();
}

function filterGalleryCards() {
  const activeTab = document.querySelector(".template-tab-pill.is-active");
  const vibe = activeTab ? activeTab.dataset.vibeCategory : "all";
  document.querySelectorAll(".template-gallery-card").forEach((card) => {
    const match = vibe === "all" || card.dataset.vibe === vibe;
    card.classList.toggle("hidden", !match);
  });
}

function startWithStorefrontTemplate(templateId) {
  const templateSelect = document.getElementById("onboard-storefront-template");
  if (templateSelect) {
    templateSelect.value = templateId;
  }
  const preview = document.getElementById("onboard-template-selected-badge");
  if (preview) {
    preview.textContent = `Selected: ${templateId}`;
    preview.classList.remove("hidden");
  }
  toggleDrawer("onboard-modal", true);
}
