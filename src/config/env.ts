/**
 * Cloudflare Worker Environment Bindings
 */
export interface Env {
  // Cloudflare D1 Database binding
  DB: D1Database;

  // Cloudflare KV binding (optional, for persistent rate-limiting/cache)
  CACHE_KV?: KVNamespace;

  // Environment variables
  ENVIRONMENT: "development" | "staging" | "production";
  PRIMARY_DOMAIN: string;

  // Secrets
  JWT_SECRET: string;
  JWT_REFRESH_SECRET?: string;
  ADMIN_API_KEY?: string;

  // Safaricom M-Pesa Platform Credentials (Optional fallback for all stores)
  MPESA_CONSUMER_KEY?: string;
  MPESA_CONSUMER_SECRET?: string;
  MPESA_PASSKEY?: string;
  MPESA_SHORTCODE?: string;
  MPESA_IS_SANDBOX?: string; // "true" or "false"
  MPESA_CALLBACK_SECRET?: string;
}
