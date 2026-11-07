import { SECURITY_LIMITS } from "../config/constants";

/**
 * WebCrypto Cryptographic Suite for Cloudflare Workers
 * Complies with OWASP Password Storage Guidelines (PBKDF2-HMAC-SHA512)
 */

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function hexToBuffer(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Secure, constant-time equality check to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);

  if (aBuf.length !== bBuf.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < aBuf.length; i++) {
    mismatch |= aBuf[i] ^ bBuf[i];
  }
  return mismatch === 0;
}

/**
 * Generates a cryptographically random hexadecimal token
 */
export function generateSecureToken(bytes = 32): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return bufferToHex(array);
}

/**
 * Standard UUID v4 generator
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Hash a password using PBKDF2-HMAC-SHA512 with a cryptographically secure random salt
 * Stored format: pbkdf2$sha512$<iterations>$<saltHex>$<hashHex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const iterations = SECURITY_LIMITS.PBKDF2_ITERATIONS;

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-512",
    },
    keyMaterial,
    512 // 64 bytes
  );

  const saltHex = bufferToHex(salt);
  const hashHex = bufferToHex(derivedBits);

  return `pbkdf2$sha512$${iterations}$${saltHex}$${hashHex}`;
}

/**
 * Verify a plain text password against a PBKDF2 stored hash using constant-time comparison
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    const parts = storedHash.split("$");
    if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha512") {
      return false;
    }

    const iterations = parseInt(parts[2], 10);
    const salt = hexToBuffer(parts[3]);
    const expectedHashHex = parts[4];

    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: iterations,
        hash: "SHA-512",
      },
      keyMaterial,
      512
    );

    const computedHashHex = bufferToHex(derivedBits);
    return timingSafeEqual(computedHashHex, expectedHashHex);
  } catch {
    return false;
  }
}
