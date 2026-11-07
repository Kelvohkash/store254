import { AppError } from "./error-handler";

export interface GoogleTokenPayload {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

/**
 * Validates Google OAuth2 / One-Tap ID Token directly with Google's secure endpoint
 * Complies with Google Identity Services security guidelines
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expectedClientId?: string
): Promise<GoogleTokenPayload> {
  if (!idToken || typeof idToken !== "string") {
    throw new AppError("Google ID token is required.", 400, "INVALID_TOKEN");
  }

  const endpoint = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken.trim())}`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch (err: any) {
    throw new AppError(`Failed to reach Google authentication service: ${err.message}`, 502, "GOOGLE_NETWORK_ERROR");
  }

  if (!res.ok) {
    throw new AppError("Invalid or expired Google ID token.", 401, "INVALID_GOOGLE_TOKEN");
  }

  const data = (await res.json()) as any;

  // 1. Verify Issuer
  const validIssuers = ["accounts.google.com", "https://accounts.google.com"];
  if (!validIssuers.includes(data.iss)) {
    throw new AppError("Untrusted token issuer.", 401, "INVALID_ISSUER");
  }

  // 2. Verify Expiration
  const now = Math.floor(Date.now() / 1000);
  const exp = parseInt(data.exp, 10);
  if (isNaN(exp) || exp < now) {
    throw new AppError("Google token has expired.", 401, "TOKEN_EXPIRED");
  }

  // 3. Verify Audience (Client ID) if configured
  if (expectedClientId && data.aud !== expectedClientId) {
    throw new AppError("Google token audience mismatch.", 401, "AUDIENCE_MISMATCH");
  }

  // 4. Verify Email Verification Status
  const isEmailVerified = data.email_verified === "true" || data.email_verified === true;
  if (!isEmailVerified) {
    throw new AppError("Google email address is not verified.", 403, "EMAIL_NOT_VERIFIED");
  }

  return {
    sub: data.sub,
    email: data.email.toLowerCase().trim(),
    emailVerified: isEmailVerified,
    name: data.name || data.given_name || "Customer",
    picture: data.picture || undefined,
  };
}
