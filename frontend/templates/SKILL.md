---
name: storefront-template-author
description: Add or update Store254 storefront templates that use the shared live catalog, commerce controls, and configurable color palettes. Use when the user asks to create or change a plug-and-play storefront template for Store254.
---
# Storefront template authoring guide

This folder contains Store254 storefront templates. Templates may redesign or replace any part of the storefront, including the header, navigation, filters, product listing, and page layout. Every existing customer option and action must remain available somewhere in the storefront: live products, prices, descriptions, product options, dynamic filters, featured products, search, profile, orders, wishlist, cart, and checkout. Reuse their existing state and handlers where possible; do not create template-specific product data or duplicate commerce behavior.

## Add or regenerate templates with the Blueprint Generator

1. Open `frontend/templates/generate-templates.mjs` and add a blueprint object to `TEMPLATE_BLUEPRINTS` (specifying `id`, `name`, `description`, `previewImage`, `defaults`, and `tokens` such as `headerStyle`, `cardVariant`, `cardRadius`, `buttonRadius`, `mediaRatio`, and `gridColumnsDesktop`).
2. Run `node frontend/templates/generate-templates.mjs` to automatically generate:
   - `frontend/templates/<id>/template.css` (scoped to both the live storefront `html[data-storefront="true"][data-storefront-template="<id>"]` and standalone `store-tenant.html` `html[data-storefront-template="<id>"]`)
   - `frontend/templates/<id>/preview.html` (interactive preview with live Foreground & Background color pickers)
   - `frontend/templates/catalog.json` (updated catalog and palettes)
3. All generated templates rely purely on the automatic contrast-safe CSS variables (`--store-primary`, `--store-primary-hover`, `--store-primary-subtle`, `--store-on-primary`, `--store-paper`, `--store-white`, `--store-surface-subtle`, `--store-ink`, `--store-muted`, `--store-line`, `--store-media-bg`) resolved by `resolveStorefrontColorTokens(foregroundHex, backgroundHex)` so that even if a user picks a dark foreground on a dark background (or light on light), visibility and WCAG contrast are automatically preserved.
4. Run `node --test frontend/tests/template-contract.test.mjs` to verify catalog validity, generated files, and automatic contrast guardrails.

## Six shared palettes

The catalog must retain at least six palette entries. Each entry has a unique `id`, a short `name`, a `primary` hex color, and a `background` hex color. The user picks one palette for any template. Do not couple a template to a single palette.

## Plug-and-play checklist

- Catalog ID is unique, lowercase, and safe for a CSS attribute selector.
- Defaults use the supported values above.
- Stylesheet path stays inside this folder and uses a `.css` extension.
- Styles use the shared color variables, work at phone and desktop widths, and leave commerce behavior to the shared shell.
- Template choice plus palette choice is sufficient; never add a visual editing form or store-specific content to the catalog.

