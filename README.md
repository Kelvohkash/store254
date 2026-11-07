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
├── frontend/                 # Frontend "Coming Soon" Landing Page
│   ├── assets/               # Official Store254 logos and brand media
│   │   └── logo.jpg          # Attached official Store254 logo
│   ├── index.html            # Responsive "Coming Soon" landing page
│   └── package.json          # Frontend preview & Cloudflare Pages deployment scripts
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
- **M-Pesa Payments (Model B):** Merchant-owned Till/Paybill credentials (**disabled by default**), STK push prompts, secure callback webhooks, and polling status.
- **Onboarding & Super Admin:** Stores onboard with `status: PENDING`. Super Admin inspects and activates stores at `/api/platform/admin/stores`.
- **Email OTP Recovery:** Password recovery OTPs dispatched from `recovery@store254.co.ke`.
- **Google Authentication:** One-click customer login with automatic account creation and order history tracking (`/api/orders/my-orders`).

---

## 3. Frontend Overview (`frontend/`)

- Standalone static web application featuring the official Store254 logo:
  `"Store254 - Your Digital Market Place"`
- Responsive, modern Coming Soon page announcing the upcoming marketplace launch.
- Ready to deploy directly to **Cloudflare Pages**:
  ```bash
  npm run deploy:frontend
  ```
