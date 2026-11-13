/**
 * Cloudflare Worker Environment Bindings
 */
export interface Env {
  // Cloudflare D1 Database binding
  DB: D1Database;

  // Cloudflare KV binding (optional, for persistent rate-limiting/cache)
  CACHE_KV?: KVNamespace;

  // Cloudflare R2 bucket binding (for product & store media uploads)
  MEDIA_BUCKET: R2Bucket;

  // Environment variables
  ENVIRONMENT: "development" | "staging" | "production";
  PRIMARY_DOMAIN: string;
  FRONTEND_ORIGINS?: string;

  // Secrets
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  PLATFORM_ADMIN_USERNAME?: string;
  PLATFORM_ADMIN_PASSWORD?: string;
  PLATFORM_ADMIN_JWT_SECRET?: string;
  PAYMENT_CONFIG_ENCRYPTION_KEY?: string;
  RESEND_API_KEY?: string;

  // Centralized Google OAuth configuration
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;

  // Safaricom M-Pesa Platform Credentials (Optional fallback)
  MPESA_CONSUMER_KEY?: string;
  MPESA_CONSUMER_SECRET?: string;
  MPESA_PASSKEY?: string;
  MPESA_SHORTCODE?: string;
  MPESA_IS_SANDBOX?: string;

  // Cloudflare Rate Limiting API bindings; provisioned in backend/wrangler.toml.
  API_RATE_LIMITER?: RateLimit;
  AUTH_RATE_LIMITER?: RateLimit;
  AUTH_STRICT_RATE_LIMITER?: RateLimit;
  SENSITIVE_RATE_LIMITER?: RateLimit;
}
