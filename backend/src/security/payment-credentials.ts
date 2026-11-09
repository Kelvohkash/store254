import { AppError } from "./error-handler";

const CREDENTIAL_VERSION = "enc:v1:";

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importCredentialKey(secret: string): Promise<CryptoKey> {
  if (!secret || secret.length < 32) {
    throw new AppError(
      "PAYMENT_CONFIG_ENCRYPTION_KEY must contain at least 32 characters.",
      500,
      "SERVER_MISCONFIGURED"
    );
  }

  const rawKey = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Encrypt a merchant credential before it is written to D1. */
export async function encryptPaymentCredential(
  value: string | null | undefined,
  secret: string
): Promise<string | null> {
  if (value == null || value === "") return null;
  if (value.startsWith(CREDENTIAL_VERSION)) {
    // Validate it with the supplied key so key rotation/configuration mistakes fail closed.
    await decryptPaymentCredential(value, secret);
    return value;
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await importCredentialKey(secret),
    new TextEncoder().encode(value)
  );
  return `${CREDENTIAL_VERSION}${encodeBase64Url(iv)}:${encodeBase64Url(new Uint8Array(encrypted))}`;
}

/** Decrypt a v1 credential. Plaintext legacy values are returned for gradual migration. */
export async function decryptPaymentCredential(
  value: string | null | undefined,
  secret: string
): Promise<string | null> {
  if (value == null || value === "") return null;
  if (!value.startsWith(CREDENTIAL_VERSION)) return value;

  try {
    const [ivValue, encryptedValue, ...extra] = value.slice(CREDENTIAL_VERSION.length).split(":");
    if (!ivValue || !encryptedValue || extra.length) throw new Error("Invalid encrypted credential format");
    const clear = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decodeBase64Url(ivValue) },
      await importCredentialKey(secret),
      decodeBase64Url(encryptedValue)
    );
    return new TextDecoder().decode(clear);
  } catch {
    throw new AppError(
      "Stored payment credentials could not be decrypted. Verify the encryption key before retrying.",
      500,
      "PAYMENT_CREDENTIALS_UNAVAILABLE"
    );
  }
}

export async function encryptPaymentConfig<T extends {
  passkey?: string | null;
  consumerKey?: string | null;
  consumerSecret?: string | null;
}>(config: T, secret: string): Promise<T> {
  return {
    ...config,
    passkey: await encryptPaymentCredential(config.passkey, secret),
    consumerKey: await encryptPaymentCredential(config.consumerKey, secret),
    consumerSecret: await encryptPaymentCredential(config.consumerSecret, secret),
  };
}

export async function decryptPaymentConfig<T extends {
  passkey?: string | null;
  consumerKey?: string | null;
  consumerSecret?: string | null;
}>(config: T, secret: string): Promise<T> {
  return {
    ...config,
    passkey: await decryptPaymentCredential(config.passkey, secret),
    consumerKey: await decryptPaymentCredential(config.consumerKey, secret),
    consumerSecret: await decryptPaymentCredential(config.consumerSecret, secret),
  };
}
