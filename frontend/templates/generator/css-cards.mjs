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

  return `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 1px solid var(--store-line) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: var(--store-card-shadow, 0 8px 26px rgba(15, 23, 42, 0.06)) !important;
}`;
}
