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
 * charged in EUR or GBP, neither of which Paystack accepts — an order in one
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
  /**
   * Payment channels to offer on the checkout, e.g. "card", "bank_transfer",
   * "ussd". Paystack intersects this with the channels enabled on the account,
   * so listing the full set = "offer everything this account allows". Omit for
   * Paystack's default (all enabled channels).
   */
  channels?: string[];
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
      ...(params.channels ? { channels: params.channels } : {}),
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
  /**
   * The order this charge was created for, read back from the metadata we set at
   * initialize time. Survives the order row being re-pointed at a newer
   * reference, so it is the only reliable link for a charge completed on a stale
   * checkout tab.
   */
  orderId: string | null;
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
    orderId: metadataOrderId(json.data?.metadata),
  };
}

/**
 * Pull our own `orderId` back out of a charge's metadata. Paystack returns
 * metadata as an object, but echoes it as a JSON string in some payloads, so
 * accept both rather than lose the link on a formatting quirk.
 */
export function metadataOrderId(metadata: unknown): string | null {
  let meta = metadata;
  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch {
      return null;
    }
  }
  if (!meta || typeof meta !== "object") return null;
  const id = (meta as { orderId?: unknown }).orderId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** Refund a Paystack transaction in full, by its reference. */
export async function paystackRefund(reference: string): Promise<void> {
  if (!SECRET) throw new Error("Paystack is not configured.");
  const res = await fetch(`${BASE}/refund`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ transaction: reference }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Could not refund payment.");
  }
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
