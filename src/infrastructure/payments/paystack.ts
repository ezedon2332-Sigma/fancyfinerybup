import "server-only";

import crypto from "node:crypto";

/**
 * Paystack adapter. The SECRET key lives only on the server (never shipped to
 * the browser). Everything is dormant until PAYSTACK_SECRET_KEY is set, so the
 * store safely stays pay-on-delivery until you activate payments.
 */

const SECRET = process.env.PAYSTACK_SECRET_KEY;
const BASE = "https://api.paystack.co";

/**
 * Currencies Paystack can actually settle. The storefront lets a shopper be
 * charged in EUR, GBP or CNY, none of which Paystack accepts — an order in one
 * of those has to stay pay-on-delivery rather than fail at the redirect with a
 * provider error the customer cannot act on.
 */
const PAYSTACK_CURRENCIES = new Set(["NGN", "USD", "GHS", "ZAR", "KES"]);

export function paystackSupportsCurrency(currency: string): boolean {
  return PAYSTACK_CURRENCIES.has(currency.trim().toUpperCase());
}

export function isPaystackEnabled(): boolean {
  return Boolean(SECRET);
}

export interface InitParams {
  email: string;
  /** Amount in minor units (kobo / cents) of `currency`. */
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export async function paystackInitialize(
  params: InitParams,
): Promise<{ authorizationUrl: string; reference: string }> {
  if (!SECRET) throw new Error("Paystack is not configured.");
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountMinor,
      currency: params.currency,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata ?? {},
    }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Could not start payment.");
  }
  return {
    authorizationUrl: json.data.authorization_url,
    reference: json.data.reference,
  };
}

export interface VerifyResult {
  success: boolean;
  amountMinor: number;
  currency: string;
  reference: string;
}

export async function paystackVerify(reference: string): Promise<VerifyResult> {
  if (!SECRET) throw new Error("Paystack is not configured.");
  const res = await fetch(
    `${BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { authorization: `Bearer ${SECRET}` }, cache: "no-store" },
  );
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Could not verify payment.");
  }
  return {
    success: json.data.status === "success",
    amountMinor: json.data.amount,
    currency: json.data.currency,
    reference: json.data.reference,
  };
}

/** Verify a Paystack webhook signature (HMAC-SHA512 of the raw body). */
export function paystackValidWebhook(
  rawBody: string,
  signature: string | null,
): boolean {
  if (!SECRET || !signature) return false;
  const hash = crypto.createHmac("sha512", SECRET).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}
