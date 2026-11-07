# Store254 Backend Engine

A high-performance, enterprise-grade multi-tenant e-commerce and services platform backend built with **Hono**, **Cloudflare Workers**, **Cloudflare D1 (SQLite)**, and **Drizzle ORM**.

Designed specifically for subdomains on `store254.co.ke` (e.g., `alicebabycare.store254.co.ke`), supporting completely dynamic categories, custom product/service attributes, dynamic storefront filtering, promotional offers, and **merchant-owned M-Pesa Daraja STK Push payments (disabled by default)**.

---

## 1. Enterprise Security Framework

- **Strict Multi-Tenant Isolation:** All database tables are scoped by `tenant_id`. Every single query requires and enforces tenant boundary validation.
- **Subdomain Injection & Host Protection:** Strict validation regex (`^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$`) prevents Host header manipulation or tenant traversal. Reserved subdomains (`admin`, `api`, `auth`, `billing`, `mail`, etc.) are blocked.
- **Dynamic CORS Engine:** Disallows wildcard `*` with credentials. Dynamically matches `https://store254.co.ke`, `https://*.store254.co.ke`, and verified custom domains.
- **OWASP-Grade Security Headers:**
  - `Strict-Transport-Security` (HSTS): 2-year preload (`max-age=63072000; includeSubDomains; preload`).
  - `Content-Security-Policy` (CSP): Strict default-src 'self', frame-ancestors 'none'.
  - `X-Frame-Options`: `DENY` (prevents Clickjacking).
  - `X-Content-Type-Options`: `nosniff`.
  - `Permissions-Policy`: camera=(), microphone=(), geolocation=(), payment=().
- **Cryptographic Engine (WebCrypto):**
  - **Password Hashing:** Native PBKDF2 with HMAC-SHA-512, 100,000 iterations, and 16-byte cryptographically secure random salt.
  - **Timing Attack Resistance:** Constant-time comparison (`timingSafeEqual`) on all secrets, webhook tokens, and passwords.
  - **Tenant-Bound JWT Tokens:** Signed tokens include `tenantId`, `role`, `iss`, `aud`, and expiration. Prevents token replay across merchants.
- **Edge Rate Limiting:** Sliding-window rate limiter per client IP + tenant to mitigate DDoS, brute force, and credential stuffing.
- **Safe Error Masking:** No internal database errors, stack traces, or D1 syntax details leak to clients in production.

---

## 2. Dynamic Features

### A. Subdomain Routing
- Root requests (`store254.co.ke`): Route to platform registration and availability check (`/api/platform/*`).
- Subdomain requests (`alicebabycare.store254.co.ke`): Automatically resolved by `tenantMiddleware` and scoped to Alice Baby Care.
- Developer Testing Override: Pass `X-Tenant-Slug: alicebabycare` or `?tenant=alicebabycare`.

### B. Recursive Hierarchical Categories
Supports infinite nested categories:
- `Electronics` $\rightarrow$ `TV` $\rightarrow$ `OLED TVs`
- `Furniture` $\rightarrow$ `Living Room` $\rightarrow$ `Sofas`

### C. Dynamic Attribute Definitions (Products & Services)
Merchants can dynamically define attributes globally or per-category:
- **Electronics:** `brand` (SELECT), `screen_size` (NUMBER, unit: inches), `resolution` (SELECT: 4K, 8K), `warranty` (TEXT).
- **Services:** `duration_minutes` (NUMBER), `session_type` (SELECT: In-Person, Virtual), `consultant` (TEXT).
- Setting `isFilterable: true` automatically exposes the attribute to the dynamic storefront filter engine.

### D. Dynamic Storefront Filters & Facets
`GET /api/filters?category=tvs` returns:
- Dynamic price range (`min` and `max` calculated across available items).
- Dynamic facet lists (Brands: Samsung [15], Sony [10]; Screen Sizes: 43" [8], 55" [12]).
- Dynamic queries: `GET /api/items?category=tvs&brand=Samsung,Sony&screen_size=55&minPrice=30000`.

### E. Offers & Promotions Engine
- Coupon codes (e.g., `SAVE20`, `WELCOME10`).
- Automatic flash sales and discounts (`PERCENTAGE`, `FIXED_AMOUNT`, `FREE_SHIPPING`).
- Cart validation endpoint (`POST /api/offers/validate-coupon`) verifying minimum order amount, date validity, and usage limits.

---

## 3. Merchant-Owned M-Pesa Daraja Payments (Model B)

Every merchant has direct ownership of their M-Pesa proceeds, with zero platform escrow:

1. **Disabled by Default:**
   - When a new merchant registers, online M-Pesa payments are disabled (`isEnabled: false`).
   - If a customer attempts to checkout before the store owner sets up payment, the API cleanly returns `PAYMENT_METHOD_DISABLED`.
2. **Merchant Self-Setup:**
   - Store owners can visit `/api/payments/settings` to input their own Safaricom Paybill or Till Number, Lipa Na M-Pesa Passkey, and Daraja Consumer Key / Secret.
   - Includes a connection test endpoint (`POST /api/payments/settings/test-connection`) to verify credentials against Safaricom before toggling `isEnabled: true`.
3. **STK Push (Lipa Na M-Pesa Online):**
   - Initiated directly to the merchant's shortcode (`PartyB`).
   - Money goes straight into the merchant's own M-Pesa account.
4. **Webhook Callback & Real-Time Polling:**
   - `POST /api/payments/mpesa/callback`: Secured by token verification and amount reconciliation. Automatically marks order as `PAID` and deducts physical inventory.
   - `GET /api/payments/mpesa/status/:checkoutRequestId`: Enables checkout frontend to poll for PIN entry completion with automatic Daraja Query API fallback.

---

## 4. API Endpoints Overview

### Platform (Root Domain)
- `GET /health` - Health check.
- `GET /api/platform/check-subdomain?subdomain=alicebabycare` - Verify availability.
- `POST /api/platform/register-store` - Create business profile, claim subdomain, and create owner account.

### Tenant Storefront (Subdomain Scope)
- `GET /api/store` - Store profile, branding, currency, and settings.
- `POST /api/auth/register` - Customer registration.
- `POST /api/auth/login` - Customer / Merchant login.
- `GET /api/auth/me` - Profile of authenticated user.
- `GET /api/categories` - Nested hierarchical category tree.
- `POST /api/categories` - Create category / subcategory (Owner/Admin).
- `GET /api/attributes` - List custom dynamic attributes.
- `POST /api/attributes` - Define new attribute template (Owner/Admin).
- `GET /api/items` - Search and dynamically filter products & services.
- `GET /api/items/:slug` - Single item details with variants.
- `POST /api/items` - Create product or service with dynamic attributes (Owner/Admin).
- `GET /api/filters` - Dynamic faceted filter schema for category or store.
- `GET /api/offers` - Active storefront promotions and sales.
- `POST /api/offers` - Create offer or coupon (Owner/Admin).
- `POST /api/offers/validate-coupon` - Cart discount calculation.

### Checkout & M-Pesa Payments
- `POST /api/orders/checkout` - Place order & trigger merchant's STK push (fails if M-Pesa disabled).
- `GET /api/orders/:id` - Get order status & line items.
- `GET /api/orders` - Merchant orders list (Auth required).
- `GET /api/payments/settings` - View current M-Pesa gateway settings (Auth required).
- `PUT /api/payments/settings` - Configure & enable/disable M-Pesa gateway (Auth required).
- `POST /api/payments/settings/test-connection` - Test Daraja API credentials (Auth required).
- `POST /api/payments/mpesa/callback` - Safaricom server callback webhook.
- `GET /api/payments/mpesa/status/:checkoutRequestId` - Real-time payment polling.

---

## 5. Development & Testing Commands

```bash
# Run tests
npm test

# Type check
npm run typecheck

# Apply migrations to local D1
npm run db:migrate:local

# Start Cloudflare Workers local dev server
npm run dev
```
