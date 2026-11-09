# Store254 - Kenya's Digital Marketplace Platform

A complete, enterprise-grade multi-tenant e-commerce and services platform designed for `store254.co.ke` and dynamic subdomains (e.g. `alicebabycare.store254.co.ke`).

The project is structured with a strict separation between **Frontend** and **Backend**:

```
E:\store254\
├── backend/                  # Pure Hono Backend API (Cloudflare Workers + D1 SQLite)
│   ├── src/                  # Controllers, middlewares, security, and schemas
│   ├── drizzle/              # D1 SQL migrations & seed data
│   ├── tests/                # Vitest unit & integration test suites
│   ├── wrangler.toml         # Cloudflare Workers & D1 configuration
│   └── package.json          # Backend dependencies & scripts
│
├── frontend/                 # Marketplace, storefront, and admin interfaces
│   ├── assets/               # Logos and shared static media
│   ├── scripts/              # Storefront and admin JavaScript, grouped by feature
│   ├── styles/               # Shared, storefront, landing page, and admin styles
│   ├── tests/                # Template preview and contract checks
│   ├── index.html            # Marketplace and tenant storefront
│   ├── admin.html            # Store admin entry point
│   ├── super-admin-login.html
│   └── wrangler.jsonc        # Cloudflare Worker and static asset configuration
│
└── package.json              # Monorepo root scripts
```

---

## 1. Quick Start Commands (From Project Root)

```bash
# Run backend tests
npm test

# Run backend TypeScript typecheck
npm run typecheck

# Start local backend API server (Hono on Cloudflare Workers)
npm run dev:backend

# Preview frontend landing page locally
npm run dev:frontend

# Apply migrations to local D1 database
npm run db:migrate:local

# Apply migrations to remote Cloudflare D1 database (WEUR)
npm run db:migrate:prod
```

---

## 2. Backend Overview (`backend/`)

- **Runtime:** Cloudflare Workers with Hono (TypeScript).
- **Database:** Cloudflare D1 (SQLite) with Drizzle ORM.
  - Remote DB: `store254-db` (`02484baf-0725-47fc-83c2-cf4f1a54db47`, Region: WEUR).
- **Multi-Tenancy:** Automated subdomain resolution (`alicebabycare.store254.co.ke`) and custom apex domains (`alicebabycare.com`).
- **Catalog Engine:** Recursive hierarchical categories, dynamic attribute definitions (Brand, Screen Size, Resolution, Duration), and product/service variants.
- **Storefront Filters:** Faceted search and dynamic price range aggregation.
- **Offers & Promotions:** Coupon codes (`WELCOME10`, `FLASH500`), flash sales, and cart discount calculations.
- **Checkout Payments:** Customers can pay with M-Pesa STK Push when the store has configured it, or place an order with cash payment due on delivery. For shipped COD orders, merchants can reveal Till/Paybill instructions in customer order history or send an M-Pesa prompt; after delivery, merchants can manually record payment.
- **Onboarding & Super Admin:** Stores onboard with `status: PENDING`. Super Admin inspects and activates stores at `/api/platform/admin/stores`.
- **Email OTP Recovery:** Password recovery OTPs dispatched from `recovery@store254.co.ke`.
- **Google Authentication:** Customer login uses a centralized authorization-code gateway on `https://store254.co.ke/auth/google/*`, with PKCE, state validation, and a shared HttpOnly SSO cookie scoped to `.store254.co.ke`. Each store still resolves its own customer record and enforces tenant-specific authorization.

---

## 3. Frontend Overview (`frontend/`)

- Responsive marketplace directory and multi-tenant storefront powered by the backend API.
- Merchant-configurable storefront archetypes: Modern Retailer, Lifestyle & Beauty Boutique, Single Product & Maker, and Service & Portfolio.
- Store settings control the header layout, product card style, theme palette, optional primary brand color, and optional custom storefront background with automatically contrasting text and surfaces.
- Customers sign in with Google through the centralized gateway to view their orders; each storefront also provides a browser-persisted wishlist available across its design archetypes.
- Cash-on-delivery orders can be marked shipped by merchants, but only the owning customer can confirm delivery; confirmation sends an M-Pesa prompt or reveals configured payment instructions.
- Google sign-in requires the OAuth client configuration below. No individual tenant subdomains need to be registered with Google.
- Boutique stores can show secondary product photos; maker stores get a persistent featured-product purchase bar; service stores support booking and WhatsApp contact.
- Ready to deploy as a Cloudflare Worker with static assets:
  ```bash
  npm run deploy:frontend
  ```

### Centralized Google OAuth setup

Create a Google OAuth **Web application** client and configure the central origin and callback:

```text
Authorized JavaScript origin: https://store254.co.ke
Authorized redirect URI:      https://store254.co.ke/auth/google/callback
```

The OAuth Web Client ID is configured as the non-secret `GOOGLE_CLIENT_ID` Worker variable in `backend/wrangler.toml`. Store the matching client secret as a Worker secret; do not commit it to source control:

Set the client secret as a Worker secret; do not commit it to source control:

```powershell
cd backend
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

`GOOGLE_REDIRECT_URI` is already set to the callback URL in `backend/wrangler.toml`. The backend rejects a redirect URI that does not match the fixed root-domain callback. After setting the credentials, deploy the backend with `npm run deploy:backend`. Until both credentials are configured, the customer profile displays that Google sign-in is unavailable. A verified Google identity can be reused across Store254 subdomains, while customer records and authorization remain isolated per store.
