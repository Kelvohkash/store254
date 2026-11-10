export function buildHeaderCss(tokens, scope, standaloneScope) {
  if (tokens.headerStyle === "floating-pill") {
    return `
@media (min-width: 768px) {
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
}
@media (max-width: 767px) {
  ${scope} .site-header,
  ${standaloneScope} #site-header {
    margin: 0 !important;
    max-width: 100% !important;
    border-radius: 0 !important;
    border-top: 0 !important;
    border-left: 0 !important;
    border-right: 0 !important;
  }
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
@media (max-width: 767px) {
  ${scope} .site-header,
  ${standaloneScope} #site-header {
    margin: 0 !important;
    max-width: 100% !important;
    border-radius: 0 !important;
    border-left: 0 !important;
    border-right: 0 !important;
    border-top: 0 !important;
  }
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

  if (tokens.headerStyle === "property-finder") {
    return `
${scope} .site-header,
${standaloneScope} #site-header {
  background: color-mix(in srgb, var(--store-white) 94%, var(--store-paper)) !important;
  border-top: 4px solid var(--store-primary) !important;
  border-bottom: 1px solid var(--store-line) !important;
  box-shadow: 0 4px 20px -2px rgba(15, 118, 110, 0.08) !important;
}
${scope} .site-header::before { display: none; }
${scope} #header-store-name,
${standaloneScope} #header-store-name {
  font-family: ${tokens.fontHeading} !important;
  font-weight: 800 !important;
  font-size: 1.25rem !important;
  color: var(--store-ink) !important;
  letter-spacing: -0.02em !important;
}
${scope} #header-store-tagline,
${standaloneScope} #header-store-tagline {
  color: var(--store-muted) !important;
  font-size: 0.72rem !important;
  font-weight: 600 !important;
}
${scope} #header-powered-by,
${standaloneScope} #header-powered-by {
  color: var(--store-muted) !important;
  font-size: 0.7rem !important;
}
${scope} #desktop-search .search-field input,
${scope} #search-input,
${standaloneScope} #search-input {
  height: 2.85rem;
  border-radius: 9999px !important;
  background: var(--store-white) !important;
  border: 1.5px solid var(--store-line) !important;
  padding: 0.65rem 1.25rem 0.65rem 2.85rem !important;
  font-size: 0.88rem !important;
  color: var(--store-ink) !important;
  box-shadow: inset 0 1px 3px rgba(15, 41, 38, 0.04) !important;
  transition: all 160ms ease !important;
}
${scope} #desktop-search .search-field input:focus,
${scope} #search-input:focus,
${standaloneScope} #search-input:focus {
  background: var(--store-white) !important;
  border-color: var(--store-primary) !important;
  box-shadow: 0 0 0 3.5px var(--store-primary-glow) !important;
}
${scope} .header-action,
${scope} .wishlist-action,
${standaloneScope} #header-actions-nav button:not(#desktop-cart-btn) {
  border-radius: 9999px !important;
  border: 1px solid var(--store-line) !important;
  background: color-mix(in srgb, var(--store-primary) 6%, var(--store-white)) !important;
  color: var(--store-ink) !important;
  padding: 0.52rem 1.15rem !important;
  font-weight: 700 !important;
  font-size: 0.8rem !important;
  box-shadow: 0 1px 3px rgba(15, 41, 38, 0.04) !important;
  transition: all 150ms ease !important;
}
${scope} .header-action:hover,
${scope} .wishlist-action:hover,
${standaloneScope} #header-actions-nav button:not(#desktop-cart-btn):hover {
  background: color-mix(in srgb, var(--store-primary) 12%, var(--store-white)) !important;
  border-color: var(--store-primary) !important;
  color: var(--store-primary) !important;
  transform: translateY(-1px) !important;
}
${scope} #desktop-cart-btn,
${standaloneScope} #desktop-cart-btn {
  border-radius: 9999px !important;
  padding: 0.55rem 1.25rem !important;
  background: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border: 1px solid var(--store-primary) !important;
  font-weight: 800 !important;
  box-shadow: 0 4px 14px var(--store-primary-glow) !important;
  transition: all 150ms ease !important;
}
${scope} #desktop-cart-btn:hover,
${standaloneScope} #desktop-cart-btn:hover {
  background: var(--store-primary-hover, #0b5953) !important;
  transform: translateY(-1px) !important;
}`;
  }

  if (tokens.headerStyle === "warm-showroom") {
    return `
${scope} .site-header,
${standaloneScope} #site-header {
  background: color-mix(in srgb, var(--store-white) 96%, var(--store-paper)) !important;
  border-top: 0 !important;
  border-bottom: 1px solid var(--store-line) !important;
  box-shadow: 0 4px 18px -4px rgba(28, 25, 23, 0.05) !important;
}
${scope} .site-header::before { display: none; }
${scope} #header-brand,
${standaloneScope} #header-brand {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}
${scope} #header-store-name,
${standaloneScope} #header-store-name {
  font-family: ${tokens.fontHeading} !important;
  font-weight: 700 !important;
  font-size: 1.25rem !important;
  color: var(--store-ink) !important;
  letter-spacing: -0.01em;
}
${scope} #header-store-tagline,
${standaloneScope} #header-store-tagline {
  color: var(--store-muted) !important;
  font-size: 0.74rem !important;
}
${scope} #header-powered-by,
${standaloneScope} #header-powered-by {
  color: var(--store-muted) !important;
  font-size: 0.7rem !important;
}
${scope} #desktop-search .search-field input,
${scope} #search-input,
${standaloneScope} #search-input {
  height: 2.75rem;
  border-radius: var(--store-pill-radius) !important;
  background: var(--store-white) !important;
  border: 1.5px solid var(--store-line) !important;
  padding: 0.6rem 1.15rem 0.6rem 2.75rem !important;
  font-size: 0.88rem !important;
  color: var(--store-ink) !important;
  box-shadow: inset 0 1px 2px rgba(28, 25, 23, 0.04) !important;
  transition: all 180ms ease;
}
${scope} #desktop-search .search-field input:focus,
${scope} #search-input:focus,
${standaloneScope} #search-input:focus {
  border-color: var(--store-primary) !important;
  box-shadow: 0 0 0 3.5px var(--store-primary-glow) !important;
}
${scope} .header-action,
${scope} .wishlist-action,
${standaloneScope} #header-actions-nav button:not(#desktop-cart-btn) {
  border-radius: var(--store-btn-radius) !important;
  border: 1px solid var(--store-line) !important;
  background: var(--store-white) !important;
  color: var(--store-ink) !important;
  padding: 0.52rem 0.88rem !important;
  font-weight: 600 !important;
  box-shadow: 0 1px 3px rgba(28, 25, 23, 0.04) !important;
  transition: all 160ms ease;
}
${scope} .header-action:hover,
${scope} .wishlist-action:hover,
${standaloneScope} #header-actions-nav button:not(#desktop-cart-btn):hover {
  background: var(--store-surface-subtle) !important;
  border-color: color-mix(in srgb, var(--store-primary) 35%, var(--store-line)) !important;
  color: var(--store-primary) !important;
}
${scope} #desktop-cart-btn,
${standaloneScope} #desktop-cart-btn {
  border-radius: var(--store-pill-radius) !important;
  padding: 0.55rem 1.25rem !important;
  background: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border: 1px solid var(--store-primary) !important;
  font-weight: 750 !important;
  box-shadow: 0 4px 14px rgba(63, 98, 18, 0.24) !important;
  transition: all 160ms ease;
}
${scope} #desktop-cart-btn:hover,
${standaloneScope} #desktop-cart-btn:hover {
  background: var(--store-primary-hover) !important;
  border-color: var(--store-primary-hover) !important;
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(63, 98, 18, 0.32) !important;
}`;
  }

  if (tokens.headerStyle === "executive-estate") {
    return `
${scope} .site-header,
${standaloneScope} #site-header {
  position: sticky;
  top: 0;
  z-index: 30;
  background: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border-top: 0 !important;
  border-bottom: 2.5px solid #c29b38 !important;
  box-shadow: 0 8px 24px -4px rgba(20, 83, 45, 0.28) !important;
}
${scope} .site-header::before { display: none; }
${scope} #header-store-name,
${standaloneScope} #header-store-name {
  font-family: ${tokens.fontHeading} !important;
  font-weight: 700 !important;
  letter-spacing: 0.02em !important;
  color: #ffffff !important;
}
${scope} #header-store-tagline,
${standaloneScope} #header-store-tagline {
  color: #e2e8f0 !important;
  letter-spacing: 0.04em;
}
${scope} #header-powered-by,
${scope} .header-powered-by,
${standaloneScope} #header-powered-by,
${standaloneScope} .header-powered-by {
  color: #cbd5e1 !important;
  font-size: 0.68rem;
}
${scope} #header-powered-by strong,
${scope} .header-powered-by strong,
${standaloneScope} #header-powered-by strong,
${standaloneScope} .header-powered-by strong {
  color: #f6f5f0 !important;
}
${scope} #desktop-search .search-field input,
${scope} #search-input,
${standaloneScope} #search-input {
  border-radius: var(--store-btn-radius) !important;
  background: #ffffff !important;
  border: 1.5px solid #d6d3c9 !important;
  color: #111c15 !important;
  font-size: 0.86rem !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08) inset !important;
}
${scope} #desktop-search .search-field input:focus,
${scope} #search-input:focus,
${standaloneScope} #search-input:focus {
  border-color: #c29b38 !important;
  box-shadow: 0 0 0 3px rgba(194, 155, 56, 0.25) !important;
}
${scope} .header-action,
${scope} .wishlist-action,
${standaloneScope} #header-actions-nav button:not(#desktop-cart-btn) {
  border-radius: var(--store-btn-radius) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  background: rgba(255, 255, 255, 0.1) !important;
  color: #ffffff !important;
  font-weight: 600 !important;
  transition: all 140ms ease;
}
${scope} .header-action:hover,
${scope} .wishlist-action:hover,
${standaloneScope} #header-actions-nav button:not(#desktop-cart-btn):hover {
  background: rgba(255, 255, 255, 0.2) !important;
  border-color: #c29b38 !important;
  color: #ffffff !important;
}
${scope} #desktop-cart-btn,
${standaloneScope} #desktop-cart-btn {
  border-radius: var(--store-btn-radius) !important;
  background: #c29b38 !important;
  color: #111c15 !important;
  border: 1px solid #b45309 !important;
  font-weight: 800 !important;
  box-shadow: 0 4px 12px rgba(194, 155, 56, 0.35) !important;
}
@media (max-width: 767px) {
  ${scope} .site-header,
  ${standaloneScope} #site-header {
    border-radius: 0 !important;
    border-left: 0 !important;
    border-right: 0 !important;
    border-top: 0 !important;
  }
}`;
  }

  if (tokens.headerStyle === "industrial-trade-bar") {
    return `
${scope} .site-header,
${standaloneScope} #site-header {
  background: var(--store-white) !important;
  border-top: 0 !important;
  border-bottom: 3px solid var(--store-primary) !important;
  box-shadow: 0 4px 14px rgba(17, 24, 39, 0.05) !important;
}
${scope} .site-header::before { display: none; }
${scope} #header-store-name,
${standaloneScope} #header-store-name {
  font-family: ${tokens.fontHeading} !important;
  font-weight: 850 !important;
  text-transform: uppercase;
  letter-spacing: -0.01em;
  color: var(--store-ink) !important;
}
${scope} #search-form,
${standaloneScope} #search-form {
  flex: 1 1 20rem;
  max-width: 38rem;
}
${scope} .search-field input,
${scope} #search-input,
${standaloneScope} #search-input {
  border: 2px solid var(--store-line) !important;
  border-radius: var(--store-btn-radius) !important;
  background: var(--store-paper) !important;
  color: var(--store-ink) !important;
  font-family: ${tokens.fontBody} !important;
  font-weight: 600 !important;
  font-size: 0.88rem !important;
  transition: all 160ms ease;
}
${scope} .search-field input:focus,
${scope} #search-input:focus,
${standaloneScope} #search-input:focus {
  border-color: var(--store-primary) !important;
  background: var(--store-white) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--store-primary) 22%, transparent) !important;
}
${scope} .header-action,
${scope} .wishlist-action,
${standaloneScope} #header-actions-nav button:not(#desktop-cart-btn) {
  border-radius: var(--store-btn-radius) !important;
  border: 1.5px solid var(--store-line) !important;
  background: var(--store-white) !important;
  color: var(--store-ink) !important;
  font-weight: 750 !important;
}
${scope} #desktop-cart-btn,
${standaloneScope} #desktop-cart-btn {
  border-radius: var(--store-btn-radius) !important;
  background: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border: 1.5px solid var(--store-primary) !important;
  font-weight: 850 !important;
}`;
  }

  return `
${scope} .site-header,
${standaloneScope} #site-header {
  background: color-mix(in srgb, var(--store-white) 94%, var(--store-paper)) !important;
  border-bottom: 1px solid var(--store-line) !important;
}`;
}
