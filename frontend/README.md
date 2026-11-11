# Store254 frontend

The frontend is served as static assets by the Cloudflare Worker. Public HTML entry points stay at the frontend root so existing URLs remain stable. Implementation files are grouped by purpose.

## Layout

```text
frontend/
├── assets/                 Store254 logo, favicon, and marketplace background
├── scripts/
│   ├── storefront/         Marketplace and customer storefront behavior
│   └── admin/              Store admin and platform admin behavior
├── src/worker.ts           Routes API requests and serves static pages
├── styles/                 Shared, storefront, admin, and landing page styles
├── tests/                  Storefront contract checks (development only)
├── index.html              Marketplace and tenant storefront entry point
├── admin.html              Store admin entry point
├── super-admin-login.html  Platform admin sign-in entry point
├── super-admin.html        Platform administration dashboard
├── package.json            Frontend build, preview, and deploy scripts
├── _headers                Cloudflare response headers
└── wrangler.jsonc          Cloudflare Worker and asset configuration
```

## Storefront scripts

Classic scripts in `index.html` must stay in dependency order. They preserve the inline HTML event handlers while keeping features in separate files.

- `scripts/storefront/core.js` — API setup, shared state, and common helpers.
- `scripts/storefront/core-theme.js` — applies the shared storefront styling and merchant accent colour.
- `scripts/storefront/storefront.js` — tenant profile, store banner, and navigation.
- `scripts/storefront/catalog.js` — product listing, search, and sorting.
- `scripts/storefront/categories.js` — nested category navigation and filtering.
- `scripts/storefront/customer.js` — customer Google sign-in and profile.
- `scripts/storefront/cart.js` and `wishlist.js` — customer cart and saved products.
- `scripts/storefront/checkout.js` — cart, checkout, and payment flow.
- `scripts/storefront/platform.js` — store directory, customer orders, and platform startup.
- `scripts/storefront/onboarding.js` — seller registration.

## Admin scripts

- `scripts/admin/core.js` — admin session and shared request helpers.
- `scripts/admin/dashboard.js` — dashboard metrics.
- `scripts/admin/catalog.js` — product and category management.
- `scripts/admin/orders.js` — order management.
- `scripts/admin/design.js` — storefront profile and branding settings.
- `scripts/admin/design-branding.js` — branding image upload and custom domain settings.
- `scripts/admin/payments.js` — payment settings and page startup.
- `scripts/admin/super-admin-api.js`, `super-admin-table.js`, and `super-admin.js` — protected platform admin API, tables, and dashboard.
- `scripts/admin/super-admin-login.js` — platform admin sign-in.

## Styles

- `styles/base.css` — foundations, theme tokens, and shared components.
- `styles/base/` — reset, header, hero, catalog, drawers, and modal styles imported by `base.css`.
- `styles/storefront-default.css` — shared storefront presentation and accent styling.
- `styles/components/` — storefront hero, card, interaction, and variant styles imported by `storefront-components.css`.
- `styles/storefront-components.css` — shared storefront components.
- `styles/storefront-quality.css` — storefront accessibility and visual refinements.
- `styles/platform-home.css` — marketplace landing page layout and styles.
- `styles/super-admin.css` — private platform administration dashboard.
- `styles/super-admin/` — dashboard styles imported by `super-admin.css`.
- `styles/admin.css` — admin interface.
- `styles/tailwind.generated.css` — generated utilities required by the marketplace and admin pages; rebuild with `npm run build`.

The marketplace and tenant storefront use the same `index.html`; the Worker forwards API/auth requests and serves static assets. Store appearance is one shared design with an optional accent colour, not a template picker.

## Storefront appearance

All stores use one storefront design. Owners can choose an accent colour; it changes buttons, highlights, and the tinted glass hero while preserving the layout and imagery. Edit `styles/storefront-default.css` for shared storefront styling and keep commerce actions connected to the shared handlers.
