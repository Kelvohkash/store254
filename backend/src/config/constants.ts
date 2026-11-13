/**
 * Security & Domain Constants
 */

// Subdomains that cannot be claimed by any merchant/business
export const RESERVED_SUBDOMAINS = new Set([
  "account",
  "accounts",
  "admin",
  "administrator",
  "api",
  "app",
  "assets",
  "auth",
  "bank",
  "billing",
  "cdn",
  "cdn1",
  "cdn2",
  "checkout",
  "dashboard",
  "directory",
  "docs",
  "ftp",
  "help",
  "login",
  "m-pesa",
  "mail",
  "media",
  "mpesa",
  "ns1",
  "ns2",
  "oauth",
  "official",
  "pay",
  "payment",
  "payments",
  "portal",
  "register",
  "root",
  "safaricom",
  "security",
  "shop",
  "signin",
  "signup",
  "smtp",
  "ssl",
  "sso",
  "static",
  "status",
  "statuspage",
  "store",
  "store254",
  "stores",
  "support",
  "sysadmin",
  "system",
  "trust",
  "verify",
  "wallet",
  "webhook",
  "webhooks",
  "webmail",
  "www",
]);

// Subdomain validation regex: alphanumeric with internal hyphens (2-32 chars)
export const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

// Standard primary platform domain
export const DEFAULT_PRIMARY_DOMAIN = "store254.co.ke";

// Security limits
export const SECURITY_LIMITS = {
  // Max request payload size (1 MB)
  MAX_BODY_BYTES: 1024 * 1024,
  // PBKDF2 iterations for password hashing (OWASP recommendation for SHA-512)
  PBKDF2_ITERATIONS: 100_000,
  // Password minimum requirements
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 72,
  // Token expirations
  ACCESS_TOKEN_EXPIRY_SECONDS: 60 * 60, // 1 hour
  REFRESH_TOKEN_EXPIRY_SECONDS: 60 * 60 * 24 * 30, // 30 days
  // Rate limiting defaults (per IP per minute)
  DEFAULT_RATE_LIMIT_MAX: 120,
  DEFAULT_RATE_LIMIT_WINDOW_MS: 60 * 1000,
  // Stricter limits for authentication endpoints
  AUTH_RATE_LIMIT_MAX: 10,
  AUTH_RATE_LIMIT_WINDOW_MS: 60 * 1000,
} as const;
