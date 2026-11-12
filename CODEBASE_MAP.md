# Store254 Codebase Map & Technical Architecture

> **Purpose:** Comprehensive, token-efficient reference manual of all project files, roles, data flows, and modification recipes. Refer to this document before searching or modifying any files across `frontend/`, `backend/`, and configuration directories.

---

## 1. System & Architecture Overview

Store254 is a multi-tenant Kenyan digital marketplace and e-commerce platform.

```
                          ┌────────────────────────┐
                          │   Store254 Platform    │
                          └───────────┬────────────┘
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
   Root Domain (store254.co.ke)               Subdomain / Custom Domain
   - Marketplace landing page                 - Tenant-branded storefront
   - Seller onboarding                         - Catalog, items, cart, checkout
   - Directory of active Kenyan stores        - Customer profile, orders, wishlist
   - html:not([data-storefront="true"])        - html[data-storefront="true"]
```

### Core Architecture Components:
1. **Frontend Client:** Single Page Application (SPA) driven by ordered classic JavaScript files, Tailwind CSS utilities, and CSS custom properties.
2. **Backend Engine:** Hono REST API running on Cloudflare Workers edge runtime (`backend/src/`).
3. **Database Layer:** Cloudflare D1 (distributed SQLite) managed with Drizzle ORM (`backend/src/db/`).
4. **Payments:** Safaricom M-Pesa Daraja API integration (STK Push, C2B, transaction status polling).

---

## 2. Global State & Routing Modes

Tenant detection is executed in `frontend/scripts/storefront/state.js` -> `detectInitialTenantSlug()`:
- **Platform Mode (`store254.co.ke` / `www.store254.co.ke`):**
  - `state.activeTenantSlug = ""`
  - `document.documentElement` lacks `data-storefront`
  - `#platform-hero` displayed, `#storefront-view` hidden
  - Orders, Saved, Search, and Mobile Bottom Nav are suppressed
- **Tenant Storefront Mode (`[store].store254.co.ke` or `?store=[slug]`):**
  - `state.activeTenantSlug = "[slug]"`
  - `document.documentElement` receives `data-storefront="true"`; the shared storefront stylesheet and merchant accent colour are applied
  - `#platform-hero` hidden, `#storefront-view` rendered
  - Dynamic store branding, product catalog, cart, and mobile navigation activated

---

## 3. Frontend File Directory (`frontend/`)

### 3.1 HTML Entry Points

| File Path | Role & Purpose | Key Elements & IDs | When to Edit |
|---|---|---|---|
| `frontend/index.html` | Primary SPA shell for both root platform and tenant storefronts. | `#site-header`, `#platform-hero`, `#storefront-view`, `#items-grid`, `#cart-drawer`, `#orders-drawer`, `.mobile-bottom-nav` | Changing page layouts, header structure, modal dialogs, or script loading order. |
| `frontend/admin.html` | Merchant management dashboard portal for store owners. | `#admin-sidebar`, `#section-dashboard`, `#section-products`, `#section-orders`, `#section-design`, `#section-mpesa` | Adding merchant admin tabs, product editing forms, M-Pesa setup, or design settings. |
| `frontend/super-admin.html` | Platform operator dashboard for approving stores, managing tiers, and reviewing logs. | `#tenants-table`, `#platform-stats`, `#system-health` | Platform-wide operations, merchant tenant approval, and global analytics. |
| `frontend/super-admin-login.html` | Secure entry portal for platform administrators. | `#login-form`, `#login-password`, `#login-error` | Admin authentication flow and security restrictions. |

---

### 3.2 Stylesheets (`frontend/styles/`)

| File Path | Role & Responsibilities | Key Selectors / Variables | When to Edit |
|---|---|---|---|
| `frontend/styles/base.css` | Master stylesheet that imports all modular base CSS files. | `@import "./base/..."` | Changing the load order of base style modules. |
| `frontend/styles/base/tokens-reset.css` | Global CSS reset, typography base, CSS custom properties. | `:root`, `--store-primary`, `--store-ink`, `--store-white`, `--store-line` | Tweaking system color tokens, font families, or default HTML element resets. |
| `frontend/styles/base/header-nav.css` | Header navigation, logo frames, search bar, and desktop shortcuts. | `.site-header`, `.search-field`, `.header-action`, `.header-logo-frame` | Adjusting top header styling, branding layout, or desktop action buttons. |
| `frontend/styles/base/hero-banner.css` | Storefront banner, store header branding, and store identity copy. | `.store-banner`, `.store-banner-inner`, `#banner-store-name`, `.store-contact` | Changing merchant hero section layout, banner backgrounds, or call buttons. |
| `frontend/styles/base/cards-catalog.css` | Product cards, catalog grid, pricing, dynamic badges, stock chips. | `.catalog-grid`, `.item-card`, `.price-tag`, `.badge-sale` | Adjusting product card appearance, media aspect ratios, or catalog layouts. |
| `frontend/styles/base/drawers-modals.css` | Side drawers (cart, orders, filters), modals, floating actions, mobile bottom nav. | `.mobile-bottom-nav`, `.drawer`, `#cart-drawer`, `#orders-drawer`, `#whatsapp-quick-contact` | Controlling mobile bottom navbar visibility, drawer animations, or floating action buttons. |
| `frontend/styles/platform-home.css` | Marketplace landing page styles (`store254.co.ke`), showcase carousel, seller onboarding. | `html:not([data-storefront="true"])`, `#platform-hero`, `.platform-intro`, `.platform-stores-grid` | Marketplace landing page visual changes, landing responsive breakpoints, or platform suppression rules. |
| `frontend/styles/storefront-components.css` | Common UI widgets, review stars, toast popups, skeletons, quantity buttons. | `.toast`, `.skeleton`, `.star-rating`, `.qty-control` | Styling reusable component micro-interactions. |
| `frontend/styles/storefront-default.css` | Shared tenant storefront layout and accent-colour styling, loaded by `scripts/storefront/core.js`. | `html[data-storefront="true"]`, hero, filters, product cards | Editing the single storefront design used by tenant stores. |
| `frontend/styles/storefront-quality.css` | Contrast guardrails, focus-visible states, reduced-motion, accessibility rules. | `prefers-reduced-motion`, `:focus-visible`, `text-shadow` | Accessibility (a11y), WCAG compliance, or contrast fixes. |
| `frontend/styles/admin.css` | Merchant admin layout, form inputs, status chips, data tables. | `.admin-card`, `.status-badge`, `.form-input` | Merchant dashboard styling. |
| `frontend/styles/super-admin.css` | Super admin portal layout and imports. | `@import "./super-admin/..."` | Super admin master styling. |
| `frontend/styles/ui-polish.css` | Micro-animations, scroll polish, hover states, mobile safe-area insets. | `env(safe-area-inset-bottom)`, `.transition-*` | Visual polish, animation curves, and safe area adjustments. |
| `frontend/styles/tailwind.generated.css`| Precompiled Tailwind utility classes. | Generated utility classes (`flex`, `hidden`, `md:hidden`, etc.) | Rebuilding via Tailwind CLI when adding new utility classes. |

---

### 3.3 Storefront Client Scripts (`frontend/scripts/storefront/`)

| File Path | Role & Responsibilities | Key Functions / State Handlers | When to Edit |
|---|---|---|---|
| `state.js` | Global client reactive state and tenant detection. | `state`, `detectInitialTenantSlug()`, `getInitialCart()`, `getInitialWishlist()` | Adding new global state properties, modifying storage keys, or tenant detection rules. |
| `core-utils.js` | Formatting helpers, currency (KES), debounce, toast notifications. | `formatKES(amount)`, `showToast(msg, type)`, `debounce(fn, ms)` | Changing currency formatting, notification timing, or utility helpers. |
| `core-theme.js` | Applies the shared storefront design and selected merchant accent colour. | `applyStorefrontSettings(settings)`, `loadDefaultStorefrontStyles()` | Modifying accent colours or storefront stylesheet loading. |
| `core.js` | Core initialization, icon rendering, and bootstrap lifecycle. | `initApp()`, `renderIcons()`, `resolveStorefrontColorTokens(fg, bg)` | Adjusting application bootstrapping or dynamic Lucide icon rendering. |
| `api.js` | Centralized fetch client injecting tenant headers and CSRF tokens. | `apiFetch(path, options)` | Altering API request headers, error handling, or backend URL targeting. |
| `storefront.js` | Tenant loader, marketplace vs storefront view switcher, showcase carousel. | `loadStoreProfile()`, `initializeShowcaseCarousel()`, `loadPlatformStores()` | Changing how storefront data loads or how the platform switches modes. |
| `navigation.js` | Drawer open/close controllers, mobile menus, bottom navigation actions. | `toggleDrawer(id, show)`, `toggleStorefrontMenu()`, `togglePlatformMobileMenu()` | Changing drawer behaviors, mobile menu opening, or bottom bar events. |
| `catalog.js` | Product catalog fetching, rendering, search, pagination, and dynamic filters. | `loadItems()`, `renderItemsGrid(items)`, `filterItems()`, `debouncedLoadItems()` | Modifying product search, filtering, card rendering, or catalog sorting. |
| `categories.js` | Category chip list, active category selection, header category nav. | `loadCategories()`, `selectCategory(id)`, `renderCategories()` | Changing how categories are retrieved, displayed, or filtered. |
| `banner.js` | Merchant banner rendering, store logo, verified badge, description. | `renderStoreBanner()`, `renderStoreSocials()` | Customizing store header banner information or merchant social links. |
| `item-modal.js` | Product detail modal, image gallery slider, variants, add-to-cart trigger. | `openItemModal(itemId)`, `changeGalleryImage(idx)`, `selectVariant()` | Updating product modal layout, variant selection, or image zoom. |
| `cart.js` | Shopping cart logic, local storage sync, quantity changes, item removal. | `addToCart(item, qty)`, `updateCartQty(id, delta)`, `renderCartDrawer()` | Altering cart calculations, item badges, or drawer list. |
| `checkout.js` | Checkout flow, delivery options, customer address form, M-Pesa prompt. | `initiateCheckout()`, `handleMpesaPayment()`, `validateCheckoutForm()` | Updating checkout steps, customer details collection, or payment triggers. |
| `orders.js` | Customer order history, order status tracking, order receipt details. | `loadMyOrders()`, `renderOrderHistory()`, `trackOrderStatus(orderId)` | Changing customer order tracking, receipts, or status display. |
| `wishlist.js` | Wishlist toggling, saved items counter, wishlist filter mode. | `toggleWishlist(itemId)`, `updateWishlistButton()`, `toggleWishlistView()` | Modifying wishlist storage, heart icon states, or saved items view. |
| `customer.js` | Customer Google sign-in gateway and profile persistence. | `initCustomerAuth()`, `handleGoogleSignIn()`, `refreshCustomerProfile()` | Updating customer sign-in or session management. |
| `reviews.js` | Customer product reviews, star rating submissions, review cards. | `loadProductReviews(itemId)`, `submitReview(formData)` | Adjusting product review submissions or rating display. |
| `social.js` | Social share buttons (WhatsApp, Twitter/X, Facebook, link copy). | `shareProduct(platform, item)`, `copyShareLink()` | Updating social share URLs or WhatsApp share text. |
| `platform.js` | Marketplace landing page directory, featured stores grid, onboarding entry. | `loadPlatformStores()`, `renderStoresGrid()` | Modifying platform directory rendering or featured store cards. |
| `onboarding.js` | New merchant store registration modal and subdomain reservation. | `submitStoreOnboarding()`, `checkSubdomainAvailability(slug)` | Modifying the "Open your store" registration flow. |

---

### 3.4 Merchant Admin Scripts (`frontend/scripts/admin/`)

| File Path | Role & Responsibilities | Key Functions | When to Edit |
|---|---|---|---|
| `core.js` | Merchant authentication check, store settings loading, logout. | `initAdmin()`, `checkAuth()`, `logout()` | Admin session handling and API token checks. |
| `navigation.js` | Admin sidebar tab switching (Dashboard, Products, Orders, Design, etc.). | `navigateTo(tabName)`, `updateSidebarActive()` | Adding new tabs or navigation routes in merchant admin. |
| `dashboard.js` | Merchant dashboard overview, revenue stats, low-stock alerts, recent orders. | `loadDashboardStats()`, `renderRecentOrders()` | Updating dashboard metrics, charts, or KPI cards. |
| `product-editor.js` and `catalog.js` | Product CRUD, images, variants, and inventory. | Product form handlers and catalog loading | Product management forms, inventory controls, or file uploads. |
| `categories.js` | Store category hierarchy, creation, editing, and ordering. | `loadAdminCategories()`, `saveCategory()` | Managing store product categories. |
| `orders.js` | Merchant order management, fulfillment status updates, customer details. | `loadAdminOrders()`, `updateOrderStatus()` | Fulfilling orders, viewing receipts, or dispatching packages. |
| `payments.js` | Merchant payment settings and page startup. | Payment settings handlers | Updating merchant payment setup. |
| `design.js` | Store name, profile, social links, and accent-colour settings. | `loadSettings()`, `saveStoreSettings()` | Updating storefront appearance and business profile controls. |
| `design-branding.js` | Branding media upload and custom domain configuration. | `uploadStoreBrandingImage()`, `saveCustomDomain()` | Updating branding media or custom domain settings. |
| `super-admin-api.js`, `super-admin-table.js`, `super-admin.js` | Platform admin API helpers, data tables, and dashboard actions. | Platform admin request and rendering functions | Changing protected platform administration. |
| `super-admin-login.js` | Platform admin sign-in. | Login form handler | Changing platform admin authentication UI. |

---

### 3.5 Frontend Build and Runtime Files

| File Path | Role & Responsibilities | When to Edit |
|---|---|---|
| `frontend/src/worker.ts` | Serves static assets, proxies API/auth requests, and injects tenant SEO metadata. | Changing frontend routing, API proxy behavior, or edge metadata. |
| `frontend/wrangler.jsonc` | Worker entry point, static asset binding, API service binding, and routes. | Changing frontend Worker deployment configuration. |
| `frontend/tailwind.config.cjs` and `frontend/styles/tailwind.css` | Tailwind source configuration and directives. | Adding utility classes or changing Tailwind content scanning. |
| `frontend/styles/tailwind.generated.css` | Checked-in compiled utilities loaded by `index.html` and `admin.html`. | Rebuild with `npm run build`; do not edit generated CSS manually. |
| `frontend/tests/storefront-contract.test.mjs` | Development contract checks for storefront presentation and page rules. | Updating frontend structure or its style contract. |
| `frontend/README.md` | Frontend-focused directory map and design notes. | Updating frontend ownership or structure. |

---

## 4. Backend Architecture & File Map (`backend/`)

### 4.1 Backend Config & Entry

| File Path | Role & Responsibilities | Key Symbols / Exports | When to Edit |
|---|---|---|---|
| `backend/wrangler.toml` | Cloudflare Workers configuration, D1 database binding, environment variables. | `d1_databases`, `[vars]` | Changing database bindings, workers routes, or environment variables. |
| `backend/drizzle.config.ts` | Drizzle ORM configuration for migrations and SQLite dialect. | `schema`, `out`, `dialect: "sqlite"` | Modifying migration output directories or Drizzle settings. |
| `backend/src/index.ts` | Master Hono application router, middleware pipeline, global error handling. | `app = new Hono<AppEnv>()` | Registering new route modules or modifying global middleware order. |
| `backend/src/config/constants.ts` | System-wide constants, regex patterns, pagination defaults, limits. | `PAGINATION_LIMIT`, `SLUG_REGEX` | Tweaking system limits or validation constants. |
| `backend/src/config/env.ts` | Environment variable schema and validator. | `validateEnv(c.env)` | Adding new required environment variables or secrets. |

---

### 4.2 Database Schema & Migrations (`backend/src/db/`)

| File Path | Role & Responsibilities | Key Tables / Schemas | When to Edit |
|---|---|---|---|
| `backend/src/db/index.ts` | Drizzle database client initialization from D1 binding. | `getDb(c.env.DB)` | Modifying database connection pooling or logging. |
| `backend/src/db/schema/tenants.ts` | Tenant stores table (slug, business name, custom domain, settings, theme). | `tenants`, `tenantSettings` | Adding new store configuration columns or metadata fields. |
| `backend/src/db/schema/items.ts` | Product items, price, images, inventory, SKU, variants, status. | `items`, `itemVariants`, `itemImages` | Adding product fields (e.g. weight, dimensions, pre-orders). |
| `backend/src/db/schema/categories.ts` | Categories table and parent-child hierarchy. | `categories` | Modifying category metadata or ordering. |
| `backend/src/db/schema/attributes.ts` | Dynamic filter attributes and product attribute values. | `attributes`, `itemAttributeValues` | Enhancing product faceted search capabilities. |
| `backend/src/db/schema/orders.ts` | Customer orders, line items, delivery details, status enum. | `orders`, `orderItems` | Modifying order status types, shipping details, or checkout fields. |
| `backend/src/db/schema/payment-configs.ts`| M-Pesa configurations, Till/Paybill numbers, credentials. | `paymentConfigs`, `mpesaTransactions` | Storing additional payment gateways or callback metadata. |
| `backend/src/db/schema/reviews.ts` | Customer reviews, ratings (1–5), verified buyer flag, responses. | `reviews` | Updating review data structures. |
| `backend/src/db/schema/users.ts` | Merchant accounts, hashed passwords, roles (merchant, superadmin). | `users` | Adding merchant profile fields or multi-user permissions. |
| `backend/src/db/schema/auth-tokens.ts` | Session tokens and API credentials. | `authTokens` | Updating session expiration or token storage. |
| `backend/src/db/schema/audit.ts` | Audit logging for administrative actions. | `auditLogs` | Adding audit trail tracking for compliance. |

---

### 4.3 Middlewares & Security (`backend/src/middlewares/` & `security/`)

| File Path | Role & Responsibilities | Key Functions | When to Edit |
|---|---|---|---|
| `tenant.middleware.ts` | Resolves tenant by `X-Tenant-Slug` header or host subdomain. Injects `c.get('tenant')`. | `tenantMiddleware()` | Changing subdomain extraction or custom domain matching logic. |
| `auth.middleware.ts` | Verifies merchant / customer Bearer JWT tokens and role permissions. | `authMiddleware(role)` | Modifying authentication validation or route protection. |
| `request-id.middleware.ts` | Generates correlation IDs (`X-Request-ID`) for tracing. | `requestIdMiddleware()` | Request logging adjustments. |
| `security/headers.ts` | OWASP security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy). | `enterpriseSecurityHeaders()` | Adjusting Content Security Policies or framing allowances. |
| `security/cors.ts` | Dynamic multi-tenant CORS policy allowing store subdomains & custom domains. | `multiTenantCors()` | Adding allowed origins or CORS header policies. |
| `security/rate-limiter.ts` | Rate limiter protecting against brute-force attacks. | `rateLimiter()` | Adjusting rate limit thresholds or IP blocking. |
| `security/error-handler.ts` | Standardized JSON error response formatter. | `globalErrorHandler()`, `notFoundHandler()` | Changing API error formats or logging. |

---

### 4.4 Feature Modules & Routes (`backend/src/modules/`)

| Route Path | File Path | Role & Handlers |
|---|---|---|
| `/api/platform/*` | `platform/platform.routes.ts` | Public platform store directory, featured stores showcase, registration check. |
| `/api/platform/admin/*`| `platform/admin.routes.ts` | Super admin tenant approvals, system health, platform metrics. |
| `/api/auth/*` | `auth/auth.routes.ts` | Merchant login, registration, password reset. |
| `/api/auth/google/*` | `auth/google-gateway.routes.ts` | Customer Google Sign-In verification and JWT issuance. |
| `/api/store` | `tenant/tenant.routes.ts` | Public storefront metadata (branding, theme, contact, domain status). |
| `/api/categories` | `catalog/categories.routes.ts` | List and search categories for the active tenant. |
| `/api/items` | `catalog/items.routes.ts` | List items with search, category filter, dynamic attribute filters, and pagination. |
| `/api/items/:id` | `catalog/items.routes.ts` | Fetch single product details with images, variants, and reviews. |
| `/api/filters` | `filters/filters.routes.ts` | Dynamic facet counts and available filter attributes for current catalog. |
| `/api/orders` | `orders/orders.routes.ts` | Place new order, list customer orders, update order status. |
| `/api/payments/mpesa/stk` | `payments/mpesa.routes.ts` | Initiate Safaricom STK Push to customer phone. |
| `/api/payments/mpesa/callback` | `payments/mpesa.routes.ts` | Webhook receiver for Safaricom Daraja transaction callbacks. |
| `/api/payments/settings` | `payments/settings.routes.ts` | Merchant M-Pesa credential configuration. |
| `/api/reviews` | `catalog/reviews.routes.ts` | List product reviews and submit new customer ratings. |

---

## 5. Common Modification Recipes (Cheatsheet)

### Recipe A: Modifying Bottom or Top Navigation
1. **Desktop vs Mobile Visibility:**
   - On PC (>=768px), `.mobile-bottom-nav` and `#mobile-bottom-nav` must have `display: none !important;` (enforced in `frontend/styles/base/drawers-modals.css`).
   - On Mobile (<768px), `.mobile-bottom-nav` is enabled via `@media (max-width: 767px)` in `drawers-modals.css` and `md:hidden` in `index.html`.
2. **Main Website (`store254.co.ke`) Suppression:**
   - `html:not([data-storefront="true"])` rules in `frontend/styles/platform-home.css` suppress Search, Orders, Saved, and Bottom Nav on the marketplace home.
3. **Adding a New Button to the Bottom Nav:**
   - Add button HTML to `.mobile-bottom-nav` in `frontend/index.html`.
   - Update `grid-template-columns: repeat(N, 1fr)` in `frontend/styles/base/drawers-modals.css`.

### Recipe B: Changing Storefront Appearance
1. Edit shared tenant storefront layout in `frontend/styles/storefront-default.css`.
2. Keep merchant accent colours in sync between `frontend/scripts/admin/design.js` and `frontend/scripts/storefront/core-theme.js`.
3. Update `frontend/tests/storefront-contract.test.mjs` when the storefront style contract changes.

### Recipe C: Adding a New Storefront Feature (e.g. Gift Wrapping or Tipping)
1. **State:** Add default value to `state` in `frontend/scripts/storefront/state.js`.
2. **UI Element:** Add input/control inside appropriate modal or drawer in `frontend/index.html` (e.g. inside `#cart-drawer`).
3. **Logic:** Implement handler function in `frontend/scripts/storefront/cart.js` or `checkout.js`.
4. **Backend Sync:** If persisted to orders, update order schema in `backend/src/db/schema/orders.ts` and router in `backend/src/modules/orders/orders.routes.ts`.

### Recipe D: Adding a New Merchant Admin Setting Tab
1. **HTML:** Add sidebar button and `<section id="section-xyz" class="admin-section hidden">` in `frontend/admin.html`.
2. **Navigation:** Add `'xyz'` to navigation list in `frontend/scripts/admin/navigation.js`.
3. **Script:** Create or edit `frontend/scripts/admin/xyz.js` to handle data fetching and saving.
4. **API:** Add corresponding backend endpoints in `backend/src/modules/tenant/tenant.routes.ts`.

### Recipe E: Database Migrations with Drizzle & D1
1. Modify or add schema file in `backend/src/db/schema/`.
2. Generate migration SQL:
   ```powershell
   npx drizzle-kit generate
   ```
3. Apply migration to local D1 SQLite:
   ```powershell
   npx wrangler d1 execute store254-db --local --file=./backend/drizzle/<migration_file>.sql
   ```

---

## 6. Test Suite & Verification Commands

| Command | Target & Description |
|---|---|
| `node --test frontend/tests/storefront-contract.test.mjs` | Verifies shared storefront styling, contrast safety, responsive guardrails, and platform home suppression. |
| `npm --prefix frontend run build` | Rebuilds the Tailwind utility stylesheet used by the marketplace and admin pages. |
