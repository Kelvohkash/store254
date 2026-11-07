import { RESERVED_SUBDOMAINS, SUBDOMAIN_REGEX } from "../config/constants";

/**
 * Sanitizes and validates a requested subdomain
 * Returns null if invalid or reserved
 */
export function sanitizeSubdomain(raw: string): string | null {
  if (!raw || typeof raw !== "string") {
    return null;
  }

  const cleaned = raw.trim().toLowerCase();

  // Validate format (alphanumeric and hyphens, 2-32 chars)
  if (!SUBDOMAIN_REGEX.test(cleaned)) {
    return null;
  }

  // Reject reserved subdomains
  if (RESERVED_SUBDOMAINS.has(cleaned)) {
    return null;
  }

  return cleaned;
}

/**
 * Generates a clean URL slug from arbitrary text
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

/**
 * Sanitizes generic user input string to prevent script/html injection in text fields
 */
export function sanitizeString(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}
