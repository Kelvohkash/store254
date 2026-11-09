// DESIGN COLOR & CONTRAST ENGINE
// ═══════════════════════════════════════

function resolveAdminColorTokens(foregroundHex, backgroundHex) {
  const toRgb = (hex) => {
    const clean = String(hex || "#000000").replace("#", "");
    const full = clean.length === 3 ? [...clean].map((c) => c + c).join("") : clean;
    return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16));
  };
  const toHex = ([r, g, b]) =>
    `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
  const mix = (a, b, w) => [a[0] * w + b[0] * (1 - w), a[1] * w + b[1] * (1 - w), a[2] * w + b[2] * (1 - w)];
  const lum = (rgb) =>
    rgb
      .map((c) => {
        const v = c / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, val, i) => sum + val * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a, b) => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  const bgRgb = toRgb(backgroundHex);
  const rawFgRgb = toRgb(foregroundHex);
  const isDark = lum(bgRgb) <= 0.18;
  const surfaceRgb = isDark ? mix(bgRgb, [255, 255, 255], 0.88) : [255, 255, 255];

  let safeFgRgb = rawFgRgb;
  let wasAdjusted = false;
  if (contrast(safeFgRgb, bgRgb) < 4.5 || contrast(safeFgRgb, surfaceRgb) < 4.5) {
    wasAdjusted = true;
    const pole = isDark ? [255, 255, 255] : [0, 0, 0];
    for (let step = 0.04; step <= 0.96; step += 0.04) {
      const candidate = mix(rawFgRgb, pole, 1 - step);
      if (contrast(candidate, bgRgb) >= 4.5 && contrast(candidate, surfaceRgb) >= 4.5) {
        safeFgRgb = candidate;
        break;
      }
    }
  }

  const primary = toHex(safeFgRgb);
  const onPrimary = contrast([255, 255, 255], safeFgRgb) >= contrast([12, 18, 28], safeFgRgb) ? "#ffffff" : "#0c121c";
  const ink = isDark ? "#f8fafc" : "#0f172a";

  return {
    primary,
    background: toHex(bgRgb),
    ink,
    onPrimary,
    wasAdjusted,
  };
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
