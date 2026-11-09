---
name: storefront-template-author
description: Add or update Store254 storefront templates that use the shared live catalog, commerce controls, and configurable color palettes. Use when the user asks to create or change a plug-and-play storefront template for Store254.
---
# Storefront template authoring guide

This folder contains Store254's presentation-only storefront templates. Every store uses the same live products, prices, descriptions, product options, dynamic filters, featured products, search, wishlist, orders, cart, and checkout. A template must only control presentation; do not add template-specific product data or commerce behavior.

## Add a template

1. Create a lowercase, hyphenated folder under `frontend/templates/`, for example `coastal-market/`.
2. Add an entry to `frontend/templates/catalog.json` with a unique `id`, customer-facing `name`, short `description`, and `defaults` for `archetype`, `header`, `card`, `hero`, and `font`. `kicker`, `title`, and `cta` set the preview copy. Supported archetypes: `modern-retailer`, `lifestyle-boutique`, `single-product-maker`, `service-portfolio`. Supported header values: `compact-search-first`, `centered-brand`, `minimal-nav`. Supported card values: `grid-card`, `horizontal-list-row`, `service-card`. Supported hero values: `split`, `editorial`, `minimal`. Supported fonts: `modern`, `editorial`, `rounded`.
3. Optionally add `template.css` in that folder and set `stylesheet` to its relative path in the catalog. Scope every selector under `html[data-storefront="true"][data-storefront-template="your-id"]`. Use shared CSS variables such as `--store-primary`, `--store-paper`, `--store-white`, `--store-ink`, and `--store-muted`; do not hard-code the six palette colors. Style the existing shared storefront elements and keep them responsive.
4. Keep the template compatible with the shared storefront shell in `frontend/index.html`. Product cards, filters, product details, search, account, wishlist, orders, cart, and checkout are rendered by the shared app. Do not replace their behavior or require data fields unique to the template.
5. Optionally add `preview.html` as a static visual reference. The admin's live preview uses the defaults and palette automatically; no hard-coded picker or runtime allow-list entry is needed.
6. Confirm the catalog is valid JSON and run the template contract check from the repository root with `node --test frontend/tests/template-contract.test.mjs`.

## Six shared palettes

The catalog must retain at least six palette entries. Each entry has a unique `id`, a short `name`, a `primary` hex color, and a `background` hex color. The user picks one palette for any template. Do not couple a template to a single palette.

## Plug-and-play checklist

- Catalog ID is unique, lowercase, and safe for a CSS attribute selector.
- Defaults use the supported values above.
- Stylesheet path stays inside this folder and uses a `.css` extension.
- Styles use the shared color variables, work at phone and desktop widths, and leave commerce behavior to the shared shell.
- Template choice plus palette choice is sufficient; never add a visual editing form or store-specific content to the catalog.

