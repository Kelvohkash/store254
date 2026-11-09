export function buildHeaderCss(tokens, scope, standaloneScope) {
  if (tokens.headerStyle === "floating-pill") {
    return `
${scope} .site-header,
${standaloneScope} #site-header {
  margin: 0.75rem auto;
  max-width: min(96%, 82rem);
  border: 2px solid color-mix(in srgb, var(--store-primary) 28%, var(--store-line)) !important;
  border-radius: 9999px !important;
  background: color-mix(in srgb, var(--store-white) 94%, transparent) !important;
  box-shadow: 0 12px 36px -8px var(--store-primary-glow, rgba(15, 23, 42, 0.08)) !important;
  backdrop-filter: blur(16px);
}
${scope} .site-header::before { display: none; }
${scope} .header-action,
${standaloneScope} #header-actions-nav button {
  border-radius: 9999px !important;
  background: color-mix(in srgb, var(--store-primary) 8%, var(--store-white)) !important;
  border: 1px solid color-mix(in srgb, var(--store-primary) 22%, var(--store-line)) !important;
  color: var(--store-ink) !important;
}
${scope} #desktop-cart-btn,
${standaloneScope} #desktop-cart-btn {
  background: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border-radius: 9999px !important;
}`;
  }

  if (tokens.headerStyle === "warm-canopy") {
    return `
${scope} .site-header,
${standaloneScope} #site-header {
  background: color-mix(in srgb, var(--store-white) 92%, var(--store-primary-subtle)) !important;
  border-top: 5px solid var(--store-primary) !important;
  border-bottom: 2px dashed color-mix(in srgb, var(--store-primary) 35%, var(--store-line)) !important;
  box-shadow: 0 4px 18px rgba(154, 52, 18, 0.06) !important;
}
${scope} .site-header::before { display: none; }
${scope} #header-store-name,
${standaloneScope} #header-store-name {
  font-family: ${tokens.fontHeading} !important;
  font-weight: 700 !important;
}
${scope} #desktop-cart-btn,
${standaloneScope} #desktop-cart-btn {
  background: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border-radius: 9999px !important;
}`;
  }

  if (tokens.headerStyle === "minimal-atelier") {
    return `
${scope} .site-header,
${standaloneScope} #site-header {
  background: var(--store-paper) !important;
  border-top: 0 !important;
  border-bottom: 1px solid var(--store-line) !important;
  box-shadow: none !important;
}
${scope} .site-header::before { display: none; }
${scope} #header-store-name,
${standaloneScope} #header-store-name {
  font-family: ${tokens.fontHeading} !important;
  font-size: 1.25rem !important;
  letter-spacing: 0.12em !important;
  text-transform: uppercase;
  color: var(--store-ink) !important;
}
${scope} .header-action,
${scope} #desktop-cart-btn,
${standaloneScope} #header-actions-nav button {
  border-radius: 0.2rem !important;
  border: 1px solid var(--store-line) !important;
  background: transparent !important;
  color: var(--store-ink) !important;
}`;
  }

  if (tokens.headerStyle === "brutalist-framed") {
    return `
${scope} .site-header,
${standaloneScope} #site-header {
  background: var(--store-white) !important;
  color: var(--store-ink) !important;
  border-top: 0 !important;
  border-bottom: 3.5px solid var(--store-ink) !important;
  box-shadow: none !important;
}
${scope} .site-header::before { display: none; }
${scope} #header-store-name,
${standaloneScope} #header-store-name {
  font-weight: 950 !important;
  letter-spacing: -0.04em !important;
  text-transform: uppercase;
}
${scope} .header-action,
${scope} .cart-action,
${scope} #desktop-cart-btn,
${standaloneScope} #header-actions-nav button {
  border-radius: 0px !important;
  border: 2.5px solid var(--store-ink) !important;
  box-shadow: 3.5px 3.5px 0 var(--store-ink) !important;
  text-transform: uppercase;
  font-weight: 900 !important;
  background: var(--store-white) !important;
  color: var(--store-ink) !important;
}
${scope} #desktop-cart-btn,
${standaloneScope} #desktop-cart-btn {
  background: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
}
${scope} .search-field input,
${standaloneScope} #search-input {
  border: 2.5px solid var(--store-ink) !important;
  border-radius: 0 !important;
  font-family: ui-monospace, monospace !important;
}`;
  }

  if (tokens.headerStyle === "primary-solid-ribbon") {
    return `
${scope} .site-header,
${standaloneScope} #site-header {
  position: sticky;
  top: 0;
  background: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border-bottom: 1px solid color-mix(in srgb, var(--store-on-primary) 18%, var(--store-primary)) !important;
  box-shadow: 0 10px 28px var(--store-primary-glow) !important;
}
${scope} .site-header::before { display: none; }
${scope} #header-store-name,
${standaloneScope} #header-store-name {
  color: var(--store-on-primary) !important;
}
${scope} .header-action,
${standaloneScope} #header-actions-nav button {
  border-radius: 9999px !important;
  border: 1px solid color-mix(in srgb, var(--store-on-primary) 32%, transparent) !important;
  background: color-mix(in srgb, var(--store-on-primary) 12%, transparent) !important;
  color: var(--store-on-primary) !important;
}
${scope} #desktop-cart-btn,
${standaloneScope} #desktop-cart-btn {
  background: var(--store-white) !important;
  color: var(--store-ink) !important;
}`;
  }

  if (tokens.headerStyle === "bento-tech") {
    return `
${scope} .site-header,
${standaloneScope} #site-header {
  background: var(--store-white) !important;
  border-top: 3.5px solid var(--store-primary) !important;
  border-bottom: 1px solid var(--store-line) !important;
}
${scope} .site-header::before { display: none; }
${scope} #header-store-name,
${standaloneScope} #header-store-name {
  font-family: ${tokens.fontHeading} !important;
  letter-spacing: -0.04em !important;
}`;
  }

  if (tokens.headerStyle === "surface-glass") {
    return `
${scope} .site-header,
${standaloneScope} #site-header {
  background: color-mix(in srgb, var(--store-white) 90%, var(--store-paper)) !important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 0 !important;
  border-bottom: 1px solid color-mix(in srgb, var(--store-ink) 8%, var(--store-line)) !important;
  box-shadow: 0 4px 20px -4px rgba(15, 23, 42, 0.05) !important;
}
${scope} .site-header::before { display: none; }
${scope} #desktop-search .search-field input,
${scope} #search-input,
${standaloneScope} #search-input {
  height: 2.75rem;
  border-radius: 9999px !important;
  background: color-mix(in srgb, var(--store-paper) 60%, var(--store-white)) !important;
  border: 1px solid color-mix(in srgb, var(--store-ink) 12%, var(--store-line)) !important;
  padding: 0.6rem 1.15rem 0.6rem 2.75rem !important;
  font-size: 0.86rem !important;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.03) !important;
  transition: all 160ms ease;
}
${scope} #desktop-search .search-field input:focus,
${scope} #search-input:focus,
${standaloneScope} #search-input:focus {
  background: var(--store-white) !important;
  border-color: var(--store-primary) !important;
  box-shadow: 0 0 0 3.5px color-mix(in srgb, var(--store-primary) 15%, transparent) !important;
}
${scope} .header-action,
${scope} .wishlist-action,
${standaloneScope} #header-actions-nav button:not(#desktop-cart-btn) {
  border-radius: 0.65rem !important;
  border: 1px solid transparent !important;
  background: transparent !important;
  color: var(--store-ink) !important;
  padding: 0.48rem 0.78rem !important;
  font-weight: 600 !important;
  box-shadow: none !important;
  transition: all 140ms ease;
}
${scope} .header-action:hover,
${scope} .wishlist-action:hover,
${standaloneScope} #header-actions-nav button:not(#desktop-cart-btn):hover {
  background: color-mix(in srgb, var(--store-primary) 9%, var(--store-white)) !important;
  border-color: color-mix(in srgb, var(--store-primary) 18%, transparent) !important;
  color: var(--store-primary) !important;
}
${scope} #desktop-cart-btn,
${standaloneScope} #desktop-cart-btn {
  border-radius: 9999px !important;
  padding: 0.52rem 1.1rem !important;
  background: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border: 1px solid var(--store-primary) !important;
  font-weight: 700 !important;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--store-primary) 28%, transparent) !important;
}`;
  }

  return `
${scope} .site-header,
${standaloneScope} #site-header {
  background: color-mix(in srgb, var(--store-white) 94%, var(--store-paper)) !important;
  border-bottom: 1px solid var(--store-line) !important;
}`;
}
