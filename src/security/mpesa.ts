import { timingSafeEqual } from "./crypto";

/**
 * Safaricom M-Pesa Daraja Integration & Security Module
 */

export interface MpesaCredentials {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  shortcodeType?: "PAYBILL" | "BUY_GOODS";
  isSandbox?: boolean;
}

export interface StkPushParams {
  phoneNumber: string;
  amount: number;
  orderNumber: string;
  storeName: string;
  callbackUrl: string;
  credentials: MpesaCredentials;
}

export interface StkPushResponse {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export interface StkQueryResponse {
  responseCode: string;
  responseDescription: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: string;
  resultDesc: string;
}

/**
 * Normalizes any Kenyan phone number to standard 12-digit M-Pesa format (254XXXXXXXXX)
 * Supports: 0712345678, 0112345678, +254712345678, 254712345678
 */
export function normalizeKenyanPhone(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;

  // Strip all non-digit characters
  let digits = raw.replace(/\D/g, "");

  // Convert 07... or 01... to 2547... or 2541...
  if (digits.startsWith("0") && digits.length === 10) {
    digits = "254" + digits.substring(1);
  }

  // Convert +254... (already digits: 254...)
  if (digits.startsWith("254") && digits.length === 12) {
    // Valid Kenyan mobile numbers start with 2547 or 2541
    if (digits.startsWith("2547") || digits.startsWith("2541")) {
      return digits;
    }
  }

  return null;
}

/**
 * Generates formatted timestamp: YYYYMMDDHHmmss
 */
export function getMpesaTimestamp(): string {
  const date = new Date();
  const YYYY = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const DD = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  return `${YYYY}${MM}${DD}${hh}${mm}${ss}`;
}

/**
 * Generates Daraja Base64 Password
 */
export function generateMpesaPassword(
  shortcode: string,
  passkey: string,
  timestamp: string
): string {
  const str = `${shortcode}${passkey}${timestamp}`;
  return btoa(str);
}

/**
 * Fetches OAuth Bearer Token from Safaricom Daraja API
 */
export async function getMpesaOAuthToken(creds: MpesaCredentials): Promise<string> {
  const baseUrl = creds.isSandbox
    ? "https://sandbox.safaricom.co.ke"
    : "https://api.safaricom.co.ke";

  const authHeader = "Basic " + btoa(`${creds.consumerKey}:${creds.consumerSecret}`);

  const res = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: {
      Authorization: authHeader,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Safaricom OAuth failed (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: string };
  return data.access_token;
}

/**
 * Initiates STK Push (Lipa Na M-Pesa Online)
 */
export async function initiateMpesaStkPush(params: StkPushParams): Promise<StkPushResponse> {
  const { credentials, phoneNumber, amount, orderNumber, storeName, callbackUrl } = params;

  const token = await getMpesaOAuthToken(credentials);
  const timestamp = getMpesaTimestamp();
  const password = generateMpesaPassword(credentials.shortcode, credentials.passkey, timestamp);

  const baseUrl = credentials.isSandbox
    ? "https://sandbox.safaricom.co.ke"
    : "https://api.safaricom.co.ke";

  const transactionType =
    credentials.shortcodeType === "BUY_GOODS"
      ? "CustomerBuyGoodsOnline"
      : "CustomerPayBillOnline";

  const payload = {
    BusinessShortCode: credentials.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: transactionType,
    Amount: Math.round(amount),
    PartyA: phoneNumber,
    PartyB: credentials.shortcode,
    PhoneNumber: phoneNumber,
    CallBackURL: callbackUrl,
    AccountReference: `${storeName.replace(/[^a-zA-Z0-9]/g, "").substring(0, 5)}-${orderNumber.substring(0, 6)}`,
    TransactionDesc: `Pay ${storeName} Order ${orderNumber}`,
  };

  const res = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as any;

  if (!res.ok || data.ResponseCode !== "0") {
    throw new Error(
      `M-Pesa STK Push rejected: ${data.errorMessage || data.CustomerMessage || res.statusText}`
    );
  }

  return {
    merchantRequestId: data.MerchantRequestID,
    checkoutRequestId: data.CheckoutRequestID,
    responseCode: data.ResponseCode,
    responseDescription: data.ResponseDescription,
    customerMessage: data.CustomerMessage,
  };
}

/**
 * Actively query STK push status if callback webhook is delayed
 */
export async function queryMpesaStkStatus(
  checkoutRequestId: string,
  credentials: MpesaCredentials
): Promise<StkQueryResponse> {
  const token = await getMpesaOAuthToken(credentials);
  const timestamp = getMpesaTimestamp();
  const password = generateMpesaPassword(credentials.shortcode, credentials.passkey, timestamp);

  const baseUrl = credentials.isSandbox
    ? "https://sandbox.safaricom.co.ke"
    : "https://api.safaricom.co.ke";

  const payload = {
    BusinessShortCode: credentials.shortcode,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  };

  const res = await fetch(`${baseUrl}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as any;
  return {
    responseCode: data.ResponseCode,
    responseDescription: data.ResponseDescription,
    merchantRequestId: data.MerchantRequestID,
    checkoutRequestId: data.CheckoutRequestID,
    resultCode: data.ResultCode,
    resultDesc: data.ResultDesc,
  };
}

/**
 * Validates the Webhook Secret Token to guarantee the callback is authentic
 */
export function verifyCallbackToken(receivedToken: string | undefined, expectedSecret: string): boolean {
  if (!receivedToken || !expectedSecret) return false;
  return timingSafeEqual(receivedToken, expectedSecret);
}
