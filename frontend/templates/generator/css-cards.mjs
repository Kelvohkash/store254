export function buildCardCss(tokens, scope, standaloneScope) {
  if (tokens.cardVariant === "cute-bubbly") {
    return `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 2px solid color-mix(in srgb, var(--store-primary) 28%, var(--store-line)) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: 0 10px 0 -2px color-mix(in srgb, var(--store-primary) 20%, var(--store-line)), 0 16px 32px -8px var(--store-primary-glow) !important;
  transition: transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 240ms ease !important;
}
${scope} #storefront-view .product-card:hover,
${standaloneScope} .product-card:hover {
  transform: translateY(-5px) rotate(-0.5deg) !important;
  box-shadow: 0 14px 0 -2px color-mix(in srgb, var(--store-primary) 30%, var(--store-line)), 0 22px 38px -8px var(--store-primary-glow) !important;
}
${scope} #items-grid .product-card-media,
${standaloneScope} .product-card-media {
  margin: 0.6rem 0.6rem 0 !important;
  width: calc(100% - 1.2rem) !important;
  border-radius: calc(${tokens.cardRadius} - 0.45rem) !important;
}
${scope} .product-card-add,
${standaloneScope} .add-to-cart-btn {
  border-radius: 9999px !important;
  box-shadow: 0 6px 18px rgba(219, 39, 119, 0.3) !important;
}`;
  }

  if (tokens.cardVariant === "tasty-menu") {
    return `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 1.5px solid color-mix(in srgb, var(--store-primary) 24%, var(--store-line)) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: 0 12px 30px -10px rgba(154, 52, 18, 0.1) !important;
}
${scope} .product-card-footer,
${standaloneScope} .product-card-actions {
  border-top: 1.5px dashed color-mix(in srgb, var(--store-primary) 32%, var(--store-line)) !important;
}
${scope} .product-card-price,
${standaloneScope} .product-price {
  display: inline-block;
  padding: 0.18rem 0.65rem;
  border-radius: 9999px;
  background: var(--store-primary-subtle);
  color: var(--store-primary) !important;
  font-weight: 850;
}`;
  }

  if (tokens.cardVariant === "brutalist-shadow") {
    return `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 2.5px solid var(--store-ink) !important;
  border-radius: 0px !important;
  background: var(--store-white) !important;
  box-shadow: 5px 5px 0 var(--store-ink) !important;
  transition: transform 160ms ease, box-shadow 160ms ease !important;
}
${scope} #storefront-view .product-card:hover,
${standaloneScope} .product-card:hover {
  transform: translate(-3px, -3px) !important;
  box-shadow: 8px 8px 0 var(--store-primary) !important;
}
${scope} .product-card-title,
${standaloneScope} .product-title {
  text-transform: uppercase;
  font-weight: 900 !important;
}
${scope} .product-card-price,
${standaloneScope} .product-price {
  font-family: ui-monospace, monospace !important;
  color: var(--store-primary) !important;
  font-weight: 900 !important;
}
${scope} .product-card-add,
${standaloneScope} .add-to-cart-btn {
  border-radius: 0 !important;
  border: 2px solid var(--store-ink) !important;
  font-weight: 900 !important;
  text-transform: uppercase;
  box-shadow: 3px 3px 0 var(--store-ink) !important;
}`;
  }

  if (tokens.cardVariant === "hairline-gallery") {
    return `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 1px solid var(--store-line) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: none !important;
}
${scope} .product-card-title,
${standaloneScope} .product-title {
  font-family: ${tokens.fontHeading} !important;
  font-weight: 500 !important;
}
${scope} .product-card-price,
${standaloneScope} .product-price {
  color: var(--store-primary) !important;
  font-family: ${tokens.fontHeading} !important;
}`;
  }

  if (tokens.cardVariant === "bento-spec") {
    return `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 1.5px solid var(--store-line) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04) !important;
}
${scope} .product-card-price,
${standaloneScope} .product-price {
  font-variant-numeric: tabular-nums;
  color: var(--store-primary) !important;
  font-weight: 850;
}`;
  }

  if (tokens.cardVariant === "borderless-lookbook") {
    return `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
${scope} #items-grid .product-card-media,
${standaloneScope} .product-card-media {
  aspect-ratio: ${tokens.mediaRatio} !important;
  border-radius: ${tokens.cardRadius} !important;
  border: 1px solid var(--store-line) !important;
}`;
  }

  if (tokens.cardVariant === "showroom-card") {
    return `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--store-line) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: 0 12px 30px rgba(28, 25, 23, 0.07) !important;
  overflow: hidden;
  transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease !important;
}
${scope} #storefront-view .product-card:hover,
${standaloneScope} .product-card:hover {
  transform: translateY(-4px) !important;
  box-shadow: 0 18px 38px rgba(28, 25, 23, 0.12) !important;
  border-color: color-mix(in srgb, var(--store-primary) 35%, var(--store-line)) !important;
}
${scope} #items-grid .product-card-media,
${standaloneScope} .product-card-media {
  aspect-ratio: ${tokens.mediaRatio} !important;
  background-color: var(--store-media-bg) !important;
  border-bottom: 1px solid var(--store-line) !important;
  overflow: hidden;
  margin: 0 !important;
  position: relative;
}
${scope} .product-tag-pill,
${standaloneScope} .product-tag-pill {
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem !important;
  border-radius: var(--store-pill-radius) !important;
  background: color-mix(in srgb, var(--store-primary) 10%, var(--store-white)) !important;
  color: var(--store-primary) !important;
  border: 1px solid color-mix(in srgb, var(--store-primary) 22%, var(--store-line)) !important;
  font-size: 0.7rem !important;
  font-weight: 750 !important;
  letter-spacing: 0.03em !important;
}
${scope} .product-card-title,
${standaloneScope} .product-title {
  font-family: ${tokens.fontHeading} !important;
  color: var(--store-ink) !important;
  font-size: 1.05rem !important;
  font-weight: 700 !important;
  line-height: 1.35 !important;
  margin: 0.4rem 0 0.35rem !important;
}
${scope} .product-card-price,
${standaloneScope} .product-price {
  color: var(--store-ink) !important;
  font-weight: 850 !important;
  font-size: 1.18rem !important;
  letter-spacing: -0.02em;
}
${scope} .product-card-actions,
${standaloneScope} .product-card-actions {
  margin-top: auto;
  padding: 0 1.1rem 1.1rem;
}
${scope} .product-card-add,
${standaloneScope} .add-to-cart-btn {
  width: 100%;
  border-radius: var(--store-btn-radius) !important;
  background-color: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border: 1px solid var(--store-primary) !important;
  font-weight: 750 !important;
  padding: 0.68rem 1.15rem !important;
  box-shadow: 0 4px 14px rgba(63, 98, 18, 0.2) !important;
  transition: transform 160ms ease, background-color 160ms ease, box-shadow 160ms ease !important;
}
${scope} .product-card-add:hover,
${standaloneScope} .add-to-cart-btn:hover {
  background-color: var(--store-primary-hover) !important;
  border-color: var(--store-primary-hover) !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 6px 18px rgba(63, 98, 18, 0.3) !important;
}`;
  }

  if (tokens.cardVariant === "industrial-spec") {
    return `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 2px solid var(--store-line) !important;
  border-radius: var(--store-card-radius) !important;
  background: var(--store-white) !important;
  box-shadow: 0 2px 6px rgba(17, 24, 39, 0.04) !important;
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease !important;
}
${scope} #storefront-view .product-card:hover,
${standaloneScope} .product-card:hover {
  transform: translateY(-2px) !important;
  border-color: var(--store-primary) !important;
  box-shadow: 0 8px 22px -4px rgba(180, 83, 9, 0.18) !important;
}
${scope} #items-grid .product-card-media,
${standaloneScope} .product-card-media {
  border-bottom: 2px solid var(--store-line) !important;
}
${scope} .product-card-title,
${standaloneScope} .product-title {
  font-family: var(--store-font-heading) !important;
  font-weight: 850 !important;
  font-size: 0.95rem !important;
  line-height: 1.35 !important;
  color: var(--store-ink) !important;
}
${scope} .product-card-price,
${standaloneScope} .product-price {
  font-variant-numeric: tabular-nums;
  font-weight: 900 !important;
  font-size: 1.15rem !important;
  color: var(--store-ink) !important;
  letter-spacing: -0.01em;
}
${scope} .product-card-add,
${standaloneScope} .add-to-cart-btn {
  border-radius: var(--store-btn-radius) !important;
  background-color: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border: 1.5px solid var(--store-primary) !important;
  font-weight: 850 !important;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-size: 0.8rem !important;
  padding: 0.65rem 1rem !important;
  box-shadow: 0 2px 6px rgba(180, 83, 9, 0.25) !important;
  transition: background-color 160ms ease, transform 160ms ease, box-shadow 160ms ease !important;
}
${scope} .product-card-add:hover,
${standaloneScope} .add-to-cart-btn:hover {
  background-color: var(--store-primary-hover) !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 4px 12px rgba(180, 83, 9, 0.32) !important;
}`;
  }

  if (tokens.cardVariant === "estate-architectural") {
    return `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--store-line) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: 0 4px 16px -2px rgba(17, 28, 21, 0.06) !important;
  transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease !important;
  overflow: hidden;
}
${scope} #storefront-view .product-card:hover,
${standaloneScope} .product-card:hover {
  transform: translateY(-4px) !important;
  box-shadow: 0 14px 32px -6px rgba(20, 83, 45, 0.16) !important;
  border-color: color-mix(in srgb, var(--store-primary) 35%, var(--store-line)) !important;
}
${scope} #items-grid .product-card-media,
${standaloneScope} .product-card-media {
  aspect-ratio: ${tokens.mediaRatio} !important;
  background-color: var(--store-media-bg) !important;
  border-bottom: 1px solid var(--store-line) !important;
  position: relative;
  overflow: hidden;
}
${scope} .product-tag-pill,
${standaloneScope} .product-tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.22rem 0.6rem;
  border-radius: var(--store-pill-radius);
  background: color-mix(in srgb, var(--store-primary) 12%, var(--store-white)) !important;
  color: var(--store-primary) !important;
  border: 1px solid color-mix(in srgb, var(--store-primary) 28%, var(--store-line)) !important;
  font-weight: 800;
  font-size: 0.68rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
${scope} .product-card-title,
${standaloneScope} .product-title {
  font-family: ${tokens.fontHeading} !important;
  font-size: 1.08rem !important;
  font-weight: 700 !important;
  color: var(--store-ink) !important;
  line-height: 1.35;
  margin: 0.4rem 0 0.5rem;
}
${scope} .product-card-price,
${standaloneScope} .product-price {
  font-size: 1.25rem !important;
  font-weight: 850 !important;
  color: var(--store-primary) !important;
  letter-spacing: -0.01em;
}
${scope} .product-card-add,
${standaloneScope} .add-to-cart-btn {
  border-radius: var(--store-btn-radius) !important;
  background-color: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border: 1px solid var(--store-primary) !important;
  font-weight: 750 !important;
  font-size: 0.85rem !important;
  padding: 0.7rem 1.1rem !important;
  transition: transform 160ms ease, background-color 160ms ease, box-shadow 160ms ease !important;
}
${scope} .product-card-add:hover,
${standaloneScope} .add-to-cart-btn:hover {
  background-color: var(--store-primary-hover) !important;
  border-color: var(--store-primary-hover) !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 4px 14px rgba(20, 83, 45, 0.28) !important;
}`;
  }

  if (tokens.cardVariant === "rental-accent-top") {
    return `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--store-line) !important;
  border-top: 3px solid var(--store-primary) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: 0 4px 18px rgba(15, 41, 38, 0.05) !important;
  transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease !important;
  overflow: hidden;
}
${scope} #storefront-view .product-card:hover,
${standaloneScope} .product-card:hover {
  transform: translateY(-4px) !important;
  box-shadow: 0 14px 32px -4px rgba(15, 118, 110, 0.16) !important;
  border-color: color-mix(in srgb, var(--store-primary) 35%, var(--store-line)) !important;
}
${scope} #items-grid .product-card-media,
${standaloneScope} .product-card-media {
  aspect-ratio: ${tokens.mediaRatio} !important;
  background-color: var(--store-media-bg) !important;
  border-bottom: 1px solid var(--store-line) !important;
  position: relative;
  overflow: hidden;
}
${scope} .product-tag-pill,
${standaloneScope} .product-tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.22rem 0.6rem;
  border-radius: var(--store-pill-radius);
  background: color-mix(in srgb, var(--store-primary) 10%, var(--store-white)) !important;
  color: var(--store-primary) !important;
  border: 1px solid color-mix(in srgb, var(--store-primary) 24%, var(--store-line)) !important;
  font-weight: 800;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
${scope} .product-card-title,
${standaloneScope} .product-title {
  font-family: ${tokens.fontHeading} !important;
  font-size: 1.05rem !important;
  font-weight: 700 !important;
  color: var(--store-ink) !important;
  line-height: 1.35;
  margin: 0.4rem 0 0.5rem;
}
${scope} .product-card-price,
${standaloneScope} .product-price {
  font-family: ${tokens.fontHeading} !important;
  font-size: 1.25rem !important;
  font-weight: 850 !important;
  font-variant-numeric: tabular-nums;
  color: var(--store-primary) !important;
  letter-spacing: -0.01em;
}
${scope} .product-card-add,
${standaloneScope} .add-to-cart-btn {
  border-radius: var(--store-btn-radius) !important;
  background-color: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border: 1px solid var(--store-primary) !important;
  font-weight: 750 !important;
  font-size: 0.85rem !important;
  padding: 0.7rem 1.1rem !important;
  box-shadow: 0 4px 14px var(--store-primary-glow) !important;
  transition: transform 160ms ease, background-color 160ms ease, box-shadow 160ms ease !important;
}
${scope} .product-card-add:hover,
${standaloneScope} .add-to-cart-btn:hover {
  background-color: var(--store-primary-hover, #0b5953) !important;
  border-color: var(--store-primary-hover, #0b5953) !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 6px 18px var(--store-primary-glow) !important;
}`;
  }

  return `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 1px solid var(--store-line) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: var(--store-card-shadow, 0 8px 26px rgba(15, 23, 42, 0.06)) !important;
}`;
}
