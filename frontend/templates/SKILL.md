---
name: storefront-template-author
description: Add or update Store254 storefront templates that use the shared live catalog, commerce controls, and configurable color palettes. Use when the user asks to create or change a plug-and-play storefront template for Store254.
---
# Storefront template authoring guide

This folder contains Store254 storefront templates. Templates may redesign or replace any part of the storefront, including the header, navigation, filters, product listing, and page layout. Every existing customer option and action must remain available somewhere in the storefront: live products, prices, descriptions, product options, dynamic filters, featured products, search, profile, orders, wishlist, cart, and checkout. Reuse their existing state and handlers where possible; do not create template-specific product data or duplicate commerce behavior.

## Add a template

1. Create a lowercase, hyphenated folder under `frontend/templates/`, for example `coastal-market/`.
2. Add an entry to `frontend/templates/catalog.json` with a unique `id`, customer-facing `name`, short `description`, and `defaults` for `archetype`, `header`, `card`, `hero`, and `font`. `kicker`, `title`, and `cta` supply preview copy. Keep those defaults compatible with the current shared data engine; the template stylesheet can fully change how they appear.
3. Add a catalog entry for each theme. The public landing page gallery and new-store onboarding read from this catalog, so a catalog addition must be startable by new customers without hand-editing a second list. Include a `previewImage` URL or a `preview` page when a tailored gallery preview is available; the gallery still renders a usable card when neither is supplied.
4. Optionally add `template.css` in the template folder and set `stylesheet` to its relative path in the catalog. Scope selectors to `html[data-storefront="true"][data-storefront-template="your-id"]`. Use shared color variables such as `--store-primary`, `--store-paper`, `--store-white`, `--store-ink`, and `--store-muted` so any of the six palettes can be applied.
5. A template may rearrange or replace markup and controls. Preserve every user-facing action from the shared storefront somewhere, including search, profile, orders, wishlist, cart, checkout, dynamic filters, category selection, and product detail. Keep actions connected to their existing state and handlers, maintain keyboard and phone usability, and do not require template-specific catalog data.
6. Optionally add `preview.html` for a complete visual reference. The admin preview reads template defaults and palette from the catalog. Avoid hard-coded template allow-lists in the admin, storefront runtime, or public gallery.
7. Confirm catalog JSON validity, template contract checks, and any page-specific responsive or interaction checks.

## Six shared palettes

The catalog must retain at least six palette entries. Each entry has a unique `id`, a short `name`, a `primary` hex color, and a `background` hex color. The user picks one palette for any template. Do not couple a template to a single palette.

## Plug-and-play checklist

- Catalog ID is unique, lowercase, and safe for a CSS attribute selector.
- Defaults use the supported values above.
- Stylesheet path stays inside this folder and uses a `.css` extension.
- Styles use the shared color variables, work at phone and desktop widths, and leave commerce behavior to the shared shell.
- Template choice plus palette choice is sufficient; never add a visual editing form or store-specific content to the catalog.

