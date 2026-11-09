# Store254 frontend

The frontend is served as static assets by the Cloudflare Worker. Public HTML entry points stay at the frontend root so existing URLs remain stable. Implementation files are grouped by purpose.

## Layout

```text
frontend/
├── assets/                 Shared images and other static media
├── scripts/
│   ├── storefront/         Marketplace and customer storefront behavior
│   └── admin/              Store admin and platform admin behavior
├── styles/                 Shared, storefront, admin, and landing page styles
├── tests/                  Template preview and contract checks
├── index.html              Marketplace and tenant storefront
├── admin.html              Store admin entry point
├── super-admin-login.html  Private platform admin sign-in entry point
├── super-admin.html       Session-checked platform administration dashboard
├── _headers                Cloudflare response headers
└── wrangler.jsonc          Cloudflare Worker and asset configuration
```

## Storefront scripts

Classic scripts in `index.html` must stay in dependency order. They preserve the inline HTML event handlers while keeping features in separate files.

- `scripts/storefront/core.js` — API setup, shared state, and common helpers.
- `scripts/storefront/storefront.js` — tenant profile, store banner, and navigation.
- `scripts/storefront/catalog.js` — categories, filtering, products, wishlists, and reviews.
- `scripts/storefront/checkout.js` — cart, checkout, and payment flow.
- `scripts/storefront/platform.js` — store directory, customer orders, and platform startup.
- `scripts/storefront/onboarding.js` — seller registration.

## Admin scripts

- `scripts/admin/core.js` — admin session and shared request helpers.
- `scripts/admin/dashboard.js` — dashboard metrics.
- `scripts/admin/catalog.js` — product and category management.
- `scripts/admin/orders.js` — order management.
- `scripts/admin/design.js` — storefront templates, preview, and design settings.
- `scripts/admin/payments.js` — payment settings and page startup.
- `scripts/admin/super-admin-login.js` — platform admin sign-in.
- `scripts/admin/super-admin.js` — protected platform overview, business directory, and account actions.

## Styles

- `styles/base.css` — foundations, theme tokens, and shared components.
- `styles/storefront-templates.css` — storefront template treatments.
- `styles/storefront-components.css` — catalog and product components.
- `styles/storefront-quality.css` — storefront accessibility and visual refinements.
- `styles/platform-home.css` — marketplace landing page layout and styles.
- `styles/super-admin.css` — private platform administration dashboard.
- `styles/admin.css` — admin interface and design preview.

When adding a storefront template, update its admin choices, storefront settings allow-list, template styles, and template contract fixture together.
