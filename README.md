# Store254 Backend Engine

A high-performance, enterprise-grade multi-tenant e-commerce and services platform backend built with **Hono**, **Cloudflare Workers**, **Cloudflare D1 (SQLite)**, and **Drizzle ORM**.

Designed specifically for subdomains on `store254.co.ke` (e.g., `alicebabycare.store254.co.ke`), supporting completely dynamic categories, custom product/service attributes, dynamic storefront filtering, promotional offers, **self-onboarding with Super Admin approval**, **email OTP password recovery via `recovery@store254.co.ke`**, and **merchant-owned M-Pesa Daraja STK Push payments (disabled by default)**.

---

## 1. Enterprise Security Framework

- **Strict Multi-Tenant Isolation:** All database tables are scoped by `tenant_id`. Every single query requires and enforces tenant boundary validation.
- **Subdomain Injection & Host Protection:** Strict validation regex (`^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$`) prevents Host header manipulation or tenant traversal. Reserved subdomains (`admin`, `api`, `auth`, `billing`, `mail`, `store254`, etc.) are blocked.
- **Super Admin Protection:** Super Admin management routes are gated behind `X-Admin-Key` with constant-time equality validation.
- **Dynamic CORS Engine:** Disallows wildcard `*` with credentials. Dynamically matches `https://store254.co.ke`, `https://*.store254.co.ke`, and verified custom domains.
- **OWASP-Grade Security Headers:**
  - `Strict-Transport-Security` (HSTS): 2-year preload (`max-age=63072000; includeSubDomains; preload`).
  - `Content-Security-Policy` (CSP): Strict default-src 'self', frame-ancestors 'none'.
  - `X-Frame-Options`: `DENY` (prevents Clickjacking).
  - `X-Content-Type-Options`: `nosniff`.
  - `Permissions-Policy`: camera=(), microphone=(), geolocation=(), payment=().
- **Cryptographic Suite (WebCrypto):**
  - **Password Storage:** Native PBKDF2 with HMAC-SHA-512, 100,000 iterations, and 16-byte cryptographically secure random salt.
  - **Timing Attack Resistance:** Constant-time comparison (`timingSafeEqual`) on all secrets, webhook tokens, OTPs, and passwords.
  - **Tenant-Bound JWT Tokens:** Signed tokens include `tenantId`, `role`, `iss`, `aud`, and expiration. Prevents token replay across merchants.
- **Password Recovery & Brute-Force Defense:** 6-digit numeric OTPs hashed using SHA-256 with 15-minute expiration and a strict 3-attempt limit.
- **Edge Rate Limiting:** Sliding-window rate limiter per client IP + tenant to mitigate DDoS, brute force, and credential stuffing.
- **Safe Error Masking:** No internal database errors, stack traces, or D1 syntax details leak to clients in production.

---

## 2. Platform Architecture & Features

### A. Landing Page Self-Onboarding & Super Admin Approval
1. **Self-Onboarding (`POST /api/platform/register-store`):**
   - Business owners register on `store254.co.ke` with their store name, desired subdomain, owner email, and password.
   - The store is created with **`status: PENDING`**.
   - An onboarding review email is automatically dispatched from `welcome@store254.co.ke`.
   - The merchant cannot log in or start selling until approved by the platform Super Admin.
2. **Super Admin Management (`/api/platform/admin/*`):**
   - `GET /api/platform/admin/stores?status=PENDING`: Inspect pending applications.
   - `PATCH /api/platform/admin/stores/:id/activate`: Approves and activates the store, instantly triggering the official activation email to the owner.
   - `PATCH /api/platform/admin/stores/:id/deactivate`: Suspends a store (e.g. for policy violations).
   - `DELETE /api/platform/admin/stores/:id`: Permanently cascades deletion of a store and its data.
   - `GET /api/platform/admin/stats`: Real-time platform metrics (total stores, pending approvals, completed orders, platform GMV).

### B. Official Email Password Recovery via OTP (`recovery@store254.co.ke`)
- **Request OTP (`POST /api/platform/forgot-password` or `/api/auth/forgot-password`):**
  - Validates email and generates a secure 6-digit OTP.
  - Hashes the OTP before storing it in `password_reset_otps`.
  - Sends a security-hardened HTML email with the OTP from `recovery@store254.co.ke`.
- **Reset Password (`POST /api/platform/reset-password` or `/api/auth/reset-password`):**
  - Verifies OTP using constant-time comparison, enforces 3-attempt lockout and 15-minute expiration, updates password to a fresh PBKDF2 hash, and invalidates the OTP.

### C. Recursive Hierarchical Categories
Supports infinite nested categories:
- `Electronics` $\rightarrow$ `Smart TVs` $\rightarrow$ `OLED TVs`
- `Baby Care` $\rightarrow$ `Strollers & Prams`

### D. Dynamic Attributes & Faceted Filters
- Merchants define attributes (Brand, Screen Size, Resolution, Fabric, Service Duration).
- Setting `isFilterable: true` automatically exposes the attribute to the dynamic storefront filter engine (`GET /api/filters`).
- Storefront queries dynamically filter against JSONB attributes (`GET /api/items?brand=Samsung,Sony&screen_size=55`).

### E. Merchant-Owned M-Pesa Daraja Payments (Disabled by Default)
- **Zero Platform Escrow:** Customer payments go straight into the merchant's Safaricom Till or Paybill.
- **Disabled by Default:** Newly created stores have payments disabled until the owner inputs their Safaricom credentials in `PUT /api/payments/settings`.
- **STK Push & Real-Time Polling:** Triggers live STK push prompt on customer's phone, with a webhook callback (`POST /api/payments/mpesa/callback`) and real-time polling (`GET /api/payments/mpesa/status/:checkoutRequestId`).

---

## 3. API Endpoints Reference

### Public Platform & Onboarding (Root Domain)
- `GET /health` - Health check with security headers.
- `GET /api/platform/check-subdomain?subdomain=alicebabycare` - Verify availability.
- `POST /api/platform/register-store` - Onboard business (created as `PENDING`).
- `POST /api/platform/forgot-password` - Request password recovery OTP from `recovery@store254.co.ke`.
- `POST /api/platform/reset-password` - Verify OTP and update password.

### Platform Super Admin (`X-Admin-Key` required)
- `GET /api/platform/admin/stores` - List stores (filters: `status`, `search`, `page`).
- `GET /api/platform/admin/stores/:id` - Full store inspection, owner details, payment status, metrics.
- `PATCH /api/platform/admin/stores/:id/activate` - Activate store & trigger activation email.
- `PATCH /api/platform/admin/stores/:id/deactivate` - Suspend store.
- `DELETE /api/platform/admin/stores/:id` - Permanently delete store.
- `GET /api/platform/admin/stats` - Platform-wide analytics (stores, orders, GMV in KES).

### Tenant Storefront & Catalog (Subdomain Scope)
- `GET /api/store` - Store profile and settings.
- `POST /api/auth/login` - Merchant / Customer login (rejects if store is `PENDING`).
- `POST /api/auth/register` - Customer registration.
- `POST /api/auth/forgot-password` - Customer forgot password OTP.
- `POST /api/auth/reset-password` - Customer OTP password reset.
- `GET /api/categories` - Recursive category tree.
- `POST /api/categories` - Create category / subcategory (Owner/Admin).
- `GET /api/attributes` - List custom dynamic attributes.
- `POST /api/attributes` - Define new attribute template (Owner/Admin).
- `GET /api/items` - Search & dynamic filtered item catalog.
- `GET /api/items/:slug` - Single item with variants.
- `POST /api/items` - Create product or service (Owner/Admin).
- `GET /api/filters` - Dynamic faceted filters for category or store.
- `GET /api/offers` - Active promotions & flash sales.
- `POST /api/offers/validate-coupon` - Calculate cart discount.

### Checkout & M-Pesa
- `POST /api/orders/checkout` - Place order & trigger STK push (fails if M-Pesa is disabled).
- `GET /api/orders/:id` - Order status & tracking.
- `GET /api/orders` - Merchant orders list (Auth required).
- `GET /api/payments/settings` - View current M-Pesa gateway settings (Auth required).
- `PUT /api/payments/settings` - Configure & toggle M-Pesa on/off (Auth required).
- `POST /api/payments/settings/test-connection` - Test Daraja API credentials with Safaricom.
- `POST /api/payments/mpesa/callback` - Safaricom callback webhook.
- `GET /api/payments/mpesa/status/:checkoutRequestId` - Real-time payment polling.

---

## 4. Development & Testing Commands

```bash
# Run unit & integration test suites
npm test

# Run TypeScript type check
npm run typecheck

# Apply migrations to local Cloudflare D1
npm run db:migrate:local

# Start local Cloudflare Workers dev server
npm run dev
```
