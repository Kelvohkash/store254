/**
 * Store254 Web Application Client Engine - Core Color & Catalog Loader
 */

function normalizeHexColor(input, fallback = "#15803d") {
  const match = String(input || "").trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return fallback;
  const raw = match[1].toLowerCase();
  return `#${raw.length === 3 ? [...raw].map((c) => c + c).join("") : raw}`;
}

function hexToRgbChannels(hex) {
  const normalized = normalizeHexColor(hex, "#000000").slice(1);
  return [parseInt(normalized.slice(0, 2), 16), parseInt(normalized.slice(2, 4), 16), parseInt(normalized.slice(4, 6), 16)];
}

function rgbChannelsToHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

function mixHexColors(hexA, hexB, weightA = 0.5) {
  const a = hexToRgbChannels(hexA);
  const b = hexToRgbChannels(hexB);
  const w = Math.max(0, Math.min(1, weightA));
  return rgbChannelsToHex([a[0] * w + b[0] * (1 - w), a[1] * w + b[1] * (1 - w), a[2] * w + b[2] * (1 - w)]);
}

function getHexLuminance(color) {
  const [r, g, b] = hexToRgbChannels(color).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getHexContrastRatio(hexA, hexB) {
  const lumA = getHexLuminance(hexA);
  const lumB = getHexLuminance(hexB);
  return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05);
}

/**
 * Automatically derives a complete set of contrast-safe storefront tokens from
 * ANY user-selected foreground color and background color (including dark+dark
 * or light+light combinations) so visibility is never compromised.
 */
function resolveStorefrontColorTokens(foregroundHex, backgroundHex) {
  const rawPrimary = normalizeHexColor(foregroundHex, "#15803d");
  const rawBackground = normalizeHexColor(backgroundHex, "#edf5ee");
  const bgLuminance = getHexLuminance(rawBackground);
  const isDark = bgLuminance <= 0.18;

  // 1. Page canvas & elevated card surface
  const paper = bgLuminance > 0.96 ? mixHexColors(rawBackground, rawPrimary, 0.96) : rawBackground;
  const white = isDark ? mixHexColors(paper, "#ffffff", 0.88) : "#ffffff";
  const surfaceSubtle = isDark ? mixHexColors(paper, "#ffffff", 0.93) : mixHexColors(paper, "#ffffff", 0.45);

  // 2. Ensure foreground/primary color is always visible against both paper and card surface
  let primary = rawPrimary;
  let wasAdjusted = false;
  const minAccentContrast = 4.5;
  if (getHexContrastRatio(primary, paper) < minAccentContrast || getHexContrastRatio(primary, white) < minAccentContrast) {
    wasAdjusted = true;
    const pole = isDark ? "#ffffff" : "#000000";
    for (let step = 0.04; step <= 0.96; step += 0.04) {
      const candidate = mixHexColors(rawPrimary, pole, 1 - step);
      if (getHexContrastRatio(candidate, paper) >= minAccentContrast && getHexContrastRatio(candidate, white) >= minAccentContrast) {
        primary = candidate;
        break;
      }
    }
    if (getHexContrastRatio(primary, paper) < 3.5 || getHexContrastRatio(primary, white) < 3.5) {
      primary = isDark ? "#f8fafc" : "#0f172a";
    }
  }

  // 3. Button text on primary (--store-on-primary)
  const onPrimary = getHexContrastRatio("#ffffff", primary) >= getHexContrastRatio("#090d16", primary) ? "#ffffff" : "#090d16";

  // 4. Primary hover, subtle wash, and glow
  const primaryHover = isDark ? mixHexColors(primary, "#ffffff", 0.82) : mixHexColors(primary, "#000000", 0.82);
  const primarySubtle = isDark ? mixHexColors(paper, primary, 0.78) : mixHexColors("#ffffff", primary, 0.88);
  const [pr, pg, pb] = hexToRgbChannels(primary);
  const primaryGlow = `rgba(${pr}, ${pg}, ${pb}, ${isDark ? 0.36 : 0.26})`;

  // 5. High-contrast body ink & muted secondary copy
  const ink = isDark ? mixHexColors("#f8fafc", primary, 0.92) : mixHexColors("#0f172a", primary, 0.92);
  let muted = isDark ? mixHexColors("#cbd5e1", primary, 0.90) : mixHexColors("#475569", primary, 0.90);
  if (getHexContrastRatio(muted, white) < 4.5) muted = isDark ? "#cbd5e1" : "#334155";

  // 6. Borders & media frame backdrop
  const line = isDark ? mixHexColors(paper, "#ffffff", 0.78) : mixHexColors(paper, "#0f172a", 0.84);
  const mediaBg = isDark ? mixHexColors(paper, "#ffffff", 0.92) : mixHexColors(paper, "#ffffff", 0.55);

  return {
    rawPrimary,
    rawBackground,
    primary,
    primaryHover,
    primarySubtle,
    primaryGlow,
    onPrimary,
    paper,
    white,
    surfaceSubtle,
    ink,
    muted,
    line,
    mediaBg,
    isDark,
    wasAdjusted,
    contrastOnPaper: Number(getHexContrastRatio(primary, paper).toFixed(2)),
    contrastOnSurface: Number(getHexContrastRatio(primary, white).toFixed(2)),
  };
}

if (typeof window !== "undefined") {
  window.resolveStorefrontColorTokens = resolveStorefrontColorTokens;
  window.getHexContrastRatio = getHexContrastRatio;
}

let storefrontTemplateCatalogPromise;
function loadStorefrontTemplateCatalog() {
  if (!storefrontTemplateCatalogPromise) {
    storefrontTemplateCatalogPromise = fetch("/templates/catalog.json", { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) throw new Error("Template catalog unavailable");
        return response.json();
      })
      .then((catalog) => Array.isArray(catalog.templates) ? catalog : { templates: [] })
      .catch((error) => {
        console.error("[Storefront] Could not load template catalog:", error);
        return { templates: [] };
      });
  }
  return storefrontTemplateCatalogPromise;
}

async function loadStorefrontTemplateStylesheet(template) {
  let link = document.getElementById("active-storefront-template-styles");
  const stylesheet = template?.stylesheet;
  if (!stylesheet || !/^[a-z0-9][a-z0-9/_-]*\.css$/i.test(stylesheet) || stylesheet.includes("..")) {
    link?.remove();
    return;
  }
  const href = new URL(`/templates/${stylesheet}`, window.location.origin).href;
  if (link?.href === href && link.dataset.loaded === "true") return;
  link?.remove();
  link = document.createElement("link");
  link.id = "active-storefront-template-styles";
  link.rel = "stylesheet";
  link.href = href;
  await new Promise((resolve) => {
    link.addEventListener("load", () => { link.dataset.loaded = "true"; resolve(); }, { once: true });
    link.addEventListener("error", () => { console.error(`[Storefront] Template style could not be loaded: ${template.id}`); resolve(); }, { once: true });
    document.head.append(link);
  });
}
