export function buildSidebarCss(tokens, scope, standaloneScope) {
  if (tokens.sidebarStyle === "bubbly-pastel") {
    return `
${scope} #desktop-filter-sidebar,
${standaloneScope} #desktop-filter-sidebar {
  border: 2px solid color-mix(in srgb, var(--store-primary) 28%, var(--store-line)) !important;
  border-radius: 1.8rem !important;
  background: linear-gradient(180deg, color-mix(in srgb, var(--store-primary) 6%, #ffffff), #ffffff) !important;
  box-shadow: 0 14px 34px -8px var(--store-primary-glow, rgba(244, 114, 182, 0.15)) !important;
  padding: 1.5rem !important;
}
${scope} #desktop-filter-sidebar h3,
${standaloneScope} #desktop-filter-sidebar h4 {
  color: var(--store-primary) !important;
  font-family: ${tokens.fontHeading} !important;
  font-weight: 850 !important;
  letter-spacing: 0.02em !important;
}
${scope} #desktop-filter-sidebar input[type="range"] {
  accent-color: var(--store-primary) !important;
}`;
  }

  if (tokens.sidebarStyle === "chalkboard-menu") {
    return `
${scope} #desktop-filter-sidebar,
${standaloneScope} #desktop-filter-sidebar {
  border: 2px dashed color-mix(in srgb, var(--store-primary) 42%, var(--store-line)) !important;
  border-radius: 1.35rem !important;
  background: color-mix(in srgb, var(--store-paper) 85%, var(--store-primary-subtle)) !important;
  box-shadow: 0 8px 24px rgba(154, 52, 18, 0.08) !important;
  padding: 1.5rem !important;
}
${scope} #desktop-filter-sidebar h3,
${standaloneScope} #desktop-filter-sidebar h4 {
  color: var(--store-primary) !important;
  font-family: ${tokens.fontHeading} !important;
  font-weight: 750 !important;
}`;
  }

  if (tokens.sidebarStyle === "hairline-atelier") {
    return `
${scope} #desktop-filter-sidebar,
${standaloneScope} #desktop-filter-sidebar {
  border: 1px solid var(--store-line) !important;
  border-radius: 0.25rem !important;
  border-top: 2px solid var(--store-primary) !important;
  background: var(--store-paper) !important;
  box-shadow: none !important;
  padding: 1.5rem !important;
}
${scope} #desktop-filter-sidebar h3,
${standaloneScope} #desktop-filter-sidebar h4 {
  font-family: ${tokens.fontHeading} !important;
  letter-spacing: 0.12em !important;
  text-transform: uppercase;
  font-size: 0.72rem !important;
  color: var(--store-ink) !important;
}`;
  }

  if (tokens.sidebarStyle === "raw-brutalist") {
    return `
${scope} #desktop-filter-sidebar,
${standaloneScope} #desktop-filter-sidebar {
  border: 3px solid var(--store-ink) !important;
  border-radius: 0px !important;
  background: var(--store-white) !important;
  box-shadow: 6px 6px 0 var(--store-ink) !important;
  padding: 1.5rem !important;
}
${scope} #desktop-filter-sidebar h3,
${standaloneScope} #desktop-filter-sidebar h4 {
  font-family: ui-monospace, monospace !important;
  font-size: 0.8rem !important;
  font-weight: 950 !important;
  text-transform: uppercase;
  color: var(--store-ink) !important;
}
${scope} #desktop-filter-sidebar input[type="range"] {
  accent-color: var(--store-primary) !important;
}`;
  }

  if (tokens.sidebarStyle === "bento-control") {
    return `
${scope} #desktop-filter-sidebar,
${standaloneScope} #desktop-filter-sidebar {
  border: 1.5px solid var(--store-line) !important;
  border-radius: 0.85rem !important;
  border-top: 3.5px solid var(--store-primary) !important;
  background: var(--store-white) !important;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05) !important;
  padding: 1.4rem !important;
}
${scope} #desktop-filter-sidebar h3,
${standaloneScope} #desktop-filter-sidebar h4 {
  font-family: ${tokens.fontHeading} !important;
  font-size: 0.74rem !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase;
}`;
  }

  return `
${scope} #desktop-filter-sidebar,
${standaloneScope} #desktop-filter-sidebar {
  border: 1px solid var(--store-line) !important;
  border-top: 3px solid var(--store-primary) !important;
  border-radius: var(--store-card-radius) !important;
  background: var(--store-white) !important;
  box-shadow: var(--store-card-shadow, 0 4px 18px rgba(0,0,0,0.04)) !important;
  padding: 1.4rem !important;
}`;
}
