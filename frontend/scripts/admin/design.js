// SETTINGS
  // ═══════════════════════════════════════
  function getLayoutDefaults(archetype) {
    return {
      'modern-retailer': ['compact-search-first', 'grid-card'],
      'lifestyle-boutique': ['centered-brand', 'grid-card'],
      'single-product-maker': ['centered-brand', 'grid-card'],
      'service-portfolio': ['minimal-nav', 'service-card']
    }[archetype] || ['compact-search-first', 'grid-card'];
  }

  function updateLayoutDefaults() {
    const [header, card] = getLayoutDefaults(document.getElementById('settings-storefront-archetype').value);
    document.getElementById('settings-header-variant').value = header;
    document.getElementById('settings-product-card-style').value = card;
    updateDesignPreview();
  }

  const templateDefaults = {
    'market-modern': { archetype: 'modern-retailer', header: 'compact-search-first', card: 'grid-card', hero: 'split', font: 'modern', kicker: 'MADE FOR EVERY DAY', cta: 'Explore collection' },
    'editorial-boutique': { archetype: 'lifestyle-boutique', header: 'centered-brand', card: 'grid-card', hero: 'editorial', font: 'editorial', kicker: 'A CONSIDERED EDIT', cta: 'Discover the edit' },
    'premium-maker': { archetype: 'single-product-maker', header: 'centered-brand', card: 'horizontal-list-row', hero: 'minimal', font: 'editorial', kicker: 'MADE WITH INTENTION', cta: 'Meet the collection' },
    'tech-home': { archetype: 'modern-retailer', header: 'compact-search-first', card: 'grid-card', hero: 'split', font: 'modern', kicker: 'SMARTER LIVING STARTS HERE', cta: 'Shop essentials' },
    'service-studio': { archetype: 'service-portfolio', header: 'minimal-nav', card: 'service-card', hero: 'minimal', font: 'modern', kicker: 'PERSONAL SERVICE, BEAUTIFULLY DONE', cta: 'View services' },
    'food-local': { archetype: 'modern-retailer', header: 'centered-brand', card: 'grid-card', hero: 'editorial', font: 'rounded', kicker: 'FRESH FROM OUR KITCHEN', cta: 'Order something good' },
  };

  function selectStoreTemplate(template, applyDefaults = true) {
    const selected = templateDefaults[template] ? template : 'market-modern';
    document.getElementById('settings-storefront-template').value = selected;
    document.querySelectorAll('.template-choice').forEach((button) => {
      const active = button.dataset.template === selected;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (applyDefaults) {
      const defaults = templateDefaults[selected];
      document.getElementById('settings-storefront-archetype').value = defaults.archetype;
      document.getElementById('settings-header-variant').value = defaults.header;
      document.getElementById('settings-product-card-style').value = defaults.card;
      document.getElementById('settings-hero-style').value = defaults.hero;
      document.getElementById('settings-heading-font').value = defaults.font;
    }
    updateDesignPreview();
  }

  function setDesignPreviewSize(size, button) {
    const stage = document.getElementById('design-preview-stage');
    stage.dataset.previewSize = size;
    document.querySelectorAll('.design-preview-controls button').forEach((item) => item.classList.toggle('is-active', item === button));
  }

  function updateDesignPreview() {
    const stage = document.getElementById('design-preview-stage');
    if (!stage) return;
    const template = document.getElementById('settings-storefront-template').value || 'market-modern';
    const defaults = templateDefaults[template] || templateDefaults['market-modern'];
    const name = document.getElementById('settings-name').value.trim() || 'Your Store';
    const primary = document.getElementById('settings-primary-color').value || '#15803d';
    const bg = document.getElementById('settings-background-custom').checked
      ? document.getElementById('settings-background-color').value
      : backgroundColors[document.getElementById('settings-theme-palette').value] || '#f5f5f0';
    const ink = getContrastTextColor(bg);
    const primaryInk = getContrastTextColor(primary);
    stage.dataset.template = template;
    stage.style.setProperty('--preview-primary', primary);
    stage.style.setProperty('--preview-bg', bg);
    stage.style.setProperty('--preview-ink', ink);
    stage.style.setProperty('--preview-on-primary', primaryInk);
    stage.dataset.headingFont = document.getElementById('settings-heading-font').value;
    stage.dataset.imageRatio = document.getElementById('settings-image-ratio').value;
    stage.dataset.density = document.getElementById('settings-card-density').value;
    stage.dataset.heroStyle = document.getElementById('settings-hero-style').value;
    stage.dataset.cardStyle = document.getElementById('settings-product-card-style').value;
    stage.dataset.headerVariant = document.getElementById('settings-header-variant').value;
    stage.dataset.heroFocalPoint = document.getElementById('settings-hero-focal').value;
    document.getElementById('design-preview-store').textContent = name;
    document.querySelector('.design-preview-mark').textContent = name.slice(0, 1).toUpperCase();
    const previewArt = document.querySelector('.design-preview-hero-art');
    previewArt.classList.remove('has-custom-art');
    previewArt.style.backgroundImage = '';
    try {
      const bannerUrl = new URL(document.getElementById('settings-banner').value.trim());
      if (['https:', 'http:'].includes(bannerUrl.protocol)) {
        previewArt.style.backgroundImage = `linear-gradient(180deg,rgba(20,30,22,.05),rgba(20,30,22,.22)),url("${bannerUrl.href}")`;
        previewArt.classList.add('has-custom-art');
      }
    } catch { /* Keep the template artwork until a complete image URL is entered. */ }
    previewArt.style.backgroundPosition = ({ left: "28% center", right: "72% center", top: "center 28%", center: "center" })[stage.dataset.heroFocalPoint] || "center";
    document.getElementById('design-preview-title').innerHTML = ({
      'editorial-boutique': 'A little more<br>beautiful, every day.',
      'premium-maker': 'Made slowly.<br>Kept forever.',
      'tech-home': 'A smarter home<br>starts here.',
      'service-studio': 'Good care,<br>made personal.',
      'food-local': 'A little joy,<br>made fresh.',
      'market-modern': 'Good things,<br>chosen well.',
    })[template];
    document.getElementById('design-preview-kicker').textContent = defaults.kicker;
    document.getElementById('design-preview-button').textContent = defaults.cta;
    const ratio = document.getElementById('settings-image-ratio').value;
    document.getElementById('design-preview-description').textContent = `${defaults.kicker.toLowerCase()} · ${ratio} product photography · ${document.getElementById('settings-card-density').value} card spacing`;
    const contrastNote = document.getElementById('design-contrast-note');
    const contrast = getContrastRatio(primary, primaryInk);
    const surfaceContrast = getContrastRatio(bg, ink);
    const needsContrastHelp = contrast < 4.5 || surfaceContrast < 4.5;
    contrastNote.classList.toggle('is-warning', needsContrastHelp);
    contrastNote.textContent = needsContrastHelp
      ? 'Some text may be hard to read against these colours. Adjust the brand or background shade.'
      : 'Your button text and backgrounds meet the readability check.';
  }

  function getContrastRatio(background, foreground) {
    const luminance = (hex) => {
      const value = hex.replace('#', '');
      const normalized = value.length === 3 ? [...value].map((digit) => digit + digit).join('') : value;
      const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
      return channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
        .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    };
    const values = [luminance(background), luminance(foreground)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  }

  function updatePrimaryColorFromPalette() {
    const accents = {
      'trust-forest': '#15803d',
      'sapphire-blue': '#0284c7',
      'organic-sage': '#2d6a4f',
      'modern-onyx': '#059669',
      'sunset-amber': '#d97706'
    };
    document.getElementById('settings-primary-color').value =
      accents[document.getElementById('settings-theme-palette').value] || accents['trust-forest'];
    if (!document.getElementById('settings-background-custom').checked) {
      document.getElementById('settings-background-color').value =
        backgroundColors[document.getElementById('settings-theme-palette').value] || backgroundColors['trust-forest'];
    }
    updateBackgroundColorPreview();
    updateDesignPreview();
  }

  const backgroundColors = {
    'trust-forest': '#edf5ee',
    'sapphire-blue': '#e9f2f9',
    'organic-sage': '#f4efe4',
    'modern-onyx': '#e6ecf2',
    'sunset-amber': '#fef3e2'
  };

  function getContrastTextColor(hex) {
    const value = hex.replace('#', '');
    const normalized = value.length === 3 ? [...value].map((digit) => digit + digit).join('') : value;
    const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
    const luminance = channels
      .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    return luminance > 0.179 ? '#0f172a' : '#f8fafc';
  }

  function updateBackgroundColorPreview() {
    const enabled = document.getElementById('settings-background-custom').checked;
    const colorInput = document.getElementById('settings-background-color');
    const preview = document.getElementById('settings-background-preview');
    const color = enabled
      ? colorInput.value
      : backgroundColors[document.getElementById('settings-theme-palette').value] || backgroundColors['trust-forest'];
    colorInput.disabled = !enabled;
    preview.style.backgroundColor = color;
    preview.style.color = getContrastTextColor(color);
  }

  async function loadSettings() {
    const r = await apiFetch('/store');
    if (!r.ok || !r.data?.data) return;
    const s = r.data.data;
    document.getElementById('settings-name').value = s.name || '';
    document.getElementById('settings-tagline').value = s.settings?.tagline || '';
    document.getElementById('settings-description').value = s.settings?.description || '';
    document.getElementById('settings-email').value = s.settings?.contactEmail || '';
    document.getElementById('settings-phone').value = s.settings?.contactPhone || '';
    document.getElementById('settings-address').value = s.settings?.physicalAddress || '';
    document.getElementById('settings-logo').value = s.settings?.logoUrl || '';
    document.getElementById('settings-banner').value = s.settings?.bannerUrl || '';
    document.getElementById('settings-theme-palette').value = s.settings?.themePalette || 'trust-forest';
    const selectedPalette = s.settings?.themePalette || 'trust-forest';
    const archetype = s.settings?.storefrontArchetype || 'modern-retailer';
    const paletteAccents = {
      'trust-forest': '#15803d',
      'sapphire-blue': '#0284c7',
      'organic-sage': '#2d6a4f',
      'modern-onyx': '#059669',
      'sunset-amber': '#d97706'
    };
    const [defaultHeader, defaultCard] = getLayoutDefaults(archetype);
    document.getElementById('settings-storefront-archetype').value = archetype;
    document.getElementById('settings-header-variant').value = s.settings?.headerVariant || defaultHeader;
    document.getElementById('settings-product-card-style').value = s.settings?.productCardStyle || defaultCard;
    document.getElementById('settings-primary-color').value = /^#(?:[0-9a-f]{3}){1,2}$/i.test(s.settings?.primaryColor || '')
      ? s.settings.primaryColor
      : paletteAccents[s.settings?.themePalette] || paletteAccents['trust-forest'];
    document.getElementById('settings-background-custom').checked =
      /^#(?:[0-9a-f]{3}){1,2}$/i.test(s.settings?.backgroundColor || '');
    document.getElementById('settings-background-color').value =
      s.settings?.backgroundColor || backgroundColors[selectedPalette] || backgroundColors['trust-forest'];
    updateBackgroundColorPreview();
    document.getElementById('settings-instagram').value = s.settings?.socialLinks?.instagram || '';
    document.getElementById('settings-whatsapp').value = s.settings?.socialLinks?.whatsapp || '';
    document.getElementById('settings-facebook').value = s.settings?.socialLinks?.facebook || '';
    document.getElementById('settings-tiktok').value = s.settings?.socialLinks?.tiktok || '';
    document.getElementById('settings-heading-font').value = s.settings?.headingFont || 'modern';
    document.getElementById('settings-image-ratio').value = s.settings?.productImageRatio || 'square';
    document.getElementById('settings-hero-style').value = s.settings?.heroStyle || 'split';
    document.getElementById('settings-hero-focal').value = s.settings?.heroFocalPoint || 'center';
    document.getElementById('settings-card-density').value = s.settings?.cardDensity || 'comfortable';
    document.getElementById('settings-section-intro').checked = s.settings?.sectionVisibility?.collectionIntro !== false;
    document.getElementById('settings-section-social').checked = s.settings?.sectionVisibility?.socialLinks !== false;
    document.getElementById('settings-section-contact').checked = s.settings?.sectionVisibility?.contactActions !== false;
    const savedTemplate = s.settings?.storefrontTemplate || ({ 'lifestyle-boutique': 'editorial-boutique', 'single-product-maker': 'premium-maker', 'service-portfolio': 'service-studio' }[archetype] || 'market-modern');
    selectStoreTemplate(savedTemplate, false);
    const draftKey = `store254_design_draft_${tenantSlug || 'store'}`;
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (draft?.settings) {
        document.getElementById('settings-name').value = draft.name || document.getElementById('settings-name').value;
        document.getElementById('settings-tagline').value = draft.settings.tagline || '';
        document.getElementById('settings-description').value = draft.settings.description || '';
        document.getElementById('settings-email').value = draft.settings.contactEmail || '';
        document.getElementById('settings-phone').value = draft.settings.contactPhone || '';
        document.getElementById('settings-address').value = draft.settings.physicalAddress || '';
        document.getElementById('settings-logo').value = draft.settings.logoUrl || '';
        document.getElementById('settings-banner').value = draft.settings.bannerUrl || '';
        document.getElementById('settings-storefront-archetype').value = draft.settings.storefrontArchetype || archetype;
        document.getElementById('settings-storefront-template').value = draft.settings.storefrontTemplate || savedTemplate;
        document.getElementById('settings-header-variant').value = draft.settings.headerVariant || defaultHeader;
        document.getElementById('settings-product-card-style').value = draft.settings.productCardStyle || defaultCard;
        document.getElementById('settings-theme-palette').value = draft.settings.themePalette || selectedPalette;
        document.getElementById('settings-primary-color').value = draft.settings.primaryColor || document.getElementById('settings-primary-color').value;
        document.getElementById('settings-background-custom').checked = Boolean(draft.settings.backgroundColor);
        document.getElementById('settings-background-color').value = draft.settings.backgroundColor || document.getElementById('settings-background-color').value;
        document.getElementById('settings-heading-font').value = draft.settings.headingFont || 'modern';
        document.getElementById('settings-image-ratio').value = draft.settings.productImageRatio || 'square';
        document.getElementById('settings-hero-style').value = draft.settings.heroStyle || 'split';
        document.getElementById('settings-hero-focal').value = draft.settings.heroFocalPoint || 'center';
        document.getElementById('settings-card-density').value = draft.settings.cardDensity || 'comfortable';
        document.getElementById('settings-section-intro').checked = draft.settings.sectionVisibility?.collectionIntro !== false;
        document.getElementById('settings-section-social').checked = draft.settings.sectionVisibility?.socialLinks !== false;
        document.getElementById('settings-section-contact').checked = draft.settings.sectionVisibility?.contactActions !== false;
        for (const platform of ['instagram', 'whatsapp', 'facebook', 'tiktok']) {
          document.getElementById(`settings-${platform}`).value = draft.settings.socialLinks?.[platform] || '';
        }
        selectStoreTemplate(document.getElementById('settings-storefront-template').value, false);
        document.getElementById('design-draft-status').textContent = 'Draft restored from this device.';
      }
    } catch { localStorage.removeItem(draftKey); }
    updateBackgroundColorPreview();
    updateDesignPreview();
  }

  function collectStoreSettingsPayload() {
    return {
      name: document.getElementById('settings-name').value.trim(),
      settings: {
        tagline: document.getElementById('settings-tagline').value.trim(),
        description: document.getElementById('settings-description').value.trim(),
        contactEmail: document.getElementById('settings-email').value.trim(),
        contactPhone: document.getElementById('settings-phone').value.trim(),
        physicalAddress: document.getElementById('settings-address').value.trim(),
        logoUrl: document.getElementById('settings-logo').value.trim() || undefined,
        bannerUrl: document.getElementById('settings-banner').value.trim() || undefined,
        themePalette: document.getElementById('settings-theme-palette').value,
        storefrontArchetype: document.getElementById('settings-storefront-archetype').value,
        storefrontTemplate: document.getElementById('settings-storefront-template').value,
        storefrontTemplateVersion: 1,
        headerVariant: document.getElementById('settings-header-variant').value,
        productCardStyle: document.getElementById('settings-product-card-style').value,
        headingFont: document.getElementById('settings-heading-font').value,
        productImageRatio: document.getElementById('settings-image-ratio').value,
        heroStyle: document.getElementById('settings-hero-style').value,
        heroFocalPoint: document.getElementById('settings-hero-focal').value,
        cardDensity: document.getElementById('settings-card-density').value,
        sectionVisibility: {
          collectionIntro: document.getElementById('settings-section-intro').checked,
          socialLinks: document.getElementById('settings-section-social').checked,
          contactActions: document.getElementById('settings-section-contact').checked,
        },
        primaryColor: document.getElementById('settings-primary-color').value,
        backgroundColor: document.getElementById('settings-background-custom').checked
          ? document.getElementById('settings-background-color').value
          : '',
        socialLinks: {
          instagram: document.getElementById('settings-instagram').value.trim(),
          whatsapp: document.getElementById('settings-whatsapp').value.trim(),
          facebook: document.getElementById('settings-facebook').value.trim(),
          tiktok: document.getElementById('settings-tiktok').value.trim(),
        }
      }
    };
  }

  function saveStoreDesignDraft() {
    const draftKey = `store254_design_draft_${tenantSlug || 'store'}`;
    localStorage.setItem(draftKey, JSON.stringify(collectStoreSettingsPayload()));
    document.getElementById('design-draft-status').textContent = 'Draft saved on this device.';
  }

  async function saveStoreSettings(e) {
    e.preventDefault();
    const body = collectStoreSettingsPayload();
    const r = await apiFetch('/store/settings', { method: 'PATCH', body: JSON.stringify(body) });
    if (r.ok) {
      localStorage.removeItem(`store254_design_draft_${tenantSlug || 'store'}`);
      document.getElementById('design-draft-status').textContent = 'Published just now.';
      showToast('Your storefront design is live!');
    }
    else showToast(apiErrorMessage(r, 'Failed to save settings.'), false);
  }

  // ═══════════════════════════════════════
  