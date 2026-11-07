import { secureHeaders } from "hono/secure-headers";
import type { MiddlewareHandler } from "hono";

/**
 * Enterprise Security Headers (OWASP Top 10 hardened)
 */
export function enterpriseSecurityHeaders(): MiddlewareHandler {
  return secureHeaders({
    // Strict Transport Security (HSTS) - 2 years + preload
    strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
    // MIME-sniffing protection
    xContentTypeOptions: "nosniff",
    // Prevent Clickjacking
    xFrameOptions: "DENY",
    // Restrict browser features and APIs
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
    },
    // Referrer policy
    referrerPolicy: "strict-origin-when-cross-origin",
    // Cross-Domain Policies
    xPermittedCrossDomainPolicies: "none",
    // Download options for IE
    xDownloadOptions: "noopen",
    // Content Security Policy
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  });
}
