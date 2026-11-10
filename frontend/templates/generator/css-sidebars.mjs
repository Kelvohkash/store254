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

  if (tokens.sidebarStyle === "showroom-index") {
    return `
${scope} #desktop-filter-sidebar,
${standaloneScope} #desktop-filter-sidebar {
  border: 1px solid var(--store-line) !important;
  border-top: 3.5px solid var(--store-primary) !important;
  border-radius: var(--store-card-radius) !important;
  background: var(--store-white) !important;
  box-shadow: 0 10px 28px rgba(28, 25, 23, 0.05) !important;
  padding: 1.5rem !important;
}
${scope} #desktop-filter-sidebar h3,
${standaloneScope} #desktop-filter-sidebar h4 {
  font-family: ${tokens.fontHeading} !important;
  font-size: 1.05rem !important;
  font-weight: 700 !important;
  color: var(--store-ink) !important;
  margin-top: 0;
  margin-bottom: 0.75rem;
  letter-spacing: -0.01em;
}
${scope} #desktop-filter-sidebar fieldset,
${standaloneScope} #desktop-filter-sidebar fieldset {
  border: 0 !important;
  border-top: 1px solid var(--store-line) !important;
  padding: 1rem 0 !important;
  margin: 0 !important;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
${scope} #desktop-filter-sidebar legend,
${standaloneScope} #desktop-filter-sidebar legend {
  font-weight: 800 !important;
  font-size: 0.74rem !important;
  text-transform: uppercase !important;
  letter-spacing: 0.08em !important;
  color: var(--store-muted) !important;
  padding-bottom: 0.35rem !important;
}
${scope} #desktop-filter-sidebar label,
${standaloneScope} #desktop-filter-sidebar label {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.86rem;
  color: var(--store-ink);
  cursor: pointer;
  transition: color 140ms ease;
}
${scope} #desktop-filter-sidebar label:hover,
${standaloneScope} #desktop-filter-sidebar label:hover {
  color: var(--store-primary);
}
${scope} #desktop-filter-sidebar input[type="checkbox"],
${scope} #desktop-filter-sidebar input[type="radio"],
${standaloneScope} #desktop-filter-sidebar input[type="checkbox"],
${standaloneScope} #desktop-filter-sidebar input[type="radio"] {
  accent-color: var(--store-primary) !important;
  width: 1rem;
  height: 1rem;
  cursor: pointer;
}`;
  }

  if (tokens.sidebarStyle === "trade-inventory") {
    return `
${scope} #desktop-filter-sidebar,
${standaloneScope} #desktop-filter-sidebar {
  border: 2px solid var(--store-line) !important;
  border-top: 4px solid var(--store-primary) !important;
  border-radius: var(--store-card-radius) !important;
  background: var(--store-white) !important;
  box-shadow: 0 2px 8px rgba(17, 24, 39, 0.04) !important;
  padding: 1.35rem !important;
}
${scope} #desktop-filter-sidebar h3,
${standaloneScope} #desktop-filter-sidebar h4 {
  font-family: ${tokens.fontHeading} !important;
  font-size: 0.82rem !important;
  font-weight: 900 !important;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--store-ink) !important;
  padding-bottom: 0.65rem;
  border-bottom: 2px solid var(--store-line) !important;
  margin-top: 0;
  margin-bottom: 0.85rem;
}
${standaloneScope} #desktop-filter-sidebar fieldset {
  border: 0 !important;
  border-bottom: 1.5px solid var(--store-line) !important;
  padding: 0.85rem 0 !important;
  margin: 0 !important;
}
${standaloneScope} #desktop-filter-sidebar fieldset:last-of-type {
  border-bottom: 0 !important;
}
${standaloneScope} #desktop-filter-sidebar legend {
  font-family: ${tokens.fontHeading} !important;
  font-size: 0.72rem !important;
  font-weight: 850 !important;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--store-muted) !important;
  margin-bottom: 0.5rem;
}
${standaloneScope} #desktop-filter-sidebar label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.82rem;
  font-weight: 650;
  color: var(--store-ink);
  cursor: pointer;
  padding: 0.25rem 0;
  transition: color 140ms ease;
}
${standaloneScope} #desktop-filter-sidebar label:hover {
  color: var(--store-primary);
}
${standaloneScope} #desktop-filter-sidebar input[type="checkbox"] {
  width: 1.15rem;
  height: 1.15rem;
  border: 2px solid var(--store-line);
  border-radius: 0.2rem;
  accent-color: var(--store-primary);
  cursor: pointer;
}`;
  }

  if (tokens.sidebarStyle === "property-portfolio" || tokens.sidebarStyle === "rental-filter-card") {
    return `
${scope} #desktop-filter-sidebar,
${standaloneScope} #desktop-filter-sidebar {
  border: 1px solid var(--store-line) !important;
  border-top: 3.5px solid var(--store-primary) !important;
  border-radius: var(--store-card-radius) !important;
  background: var(--store-white) !important;
  box-shadow: 0 6px 20px rgba(17, 28, 21, 0.05) !important;
  padding: 1.5rem !important;
}
${scope} #desktop-filter-sidebar h3,
${standaloneScope} #desktop-filter-sidebar h4 {
  font-family: ${tokens.fontHeading} !important;
  color: var(--store-primary) !important;
  font-size: 0.82rem !important;
  font-weight: 800 !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase;
}
${scope} #desktop-filter-sidebar legend,
${standaloneScope} #desktop-filter-sidebar legend {
  font-family: var(--store-font-body) !important;
  color: var(--store-muted) !important;
  font-size: 0.76rem !important;
  font-weight: 750 !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase;
  padding-bottom: 0.45rem;
}
${scope} #desktop-filter-sidebar input[type="checkbox"],
${standaloneScope} #desktop-filter-sidebar input[type="checkbox"] {
  accent-color: var(--store-primary) !important;
  width: 1.05rem;
  height: 1.05rem;
  border-radius: 3px;
  cursor: pointer;
}
${scope} #desktop-filter-sidebar label,
${standaloneScope} #desktop-filter-sidebar label {
  color: var(--store-ink) !important;
  font-weight: 600;
  font-size: 0.84rem;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  cursor: pointer;
  padding: 0.2rem 0;
  transition: color 140ms ease;
}
${scope} #desktop-filter-sidebar label:hover,
${standaloneScope} #desktop-filter-sidebar label:hover {
  color: var(--store-primary) !important;
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
