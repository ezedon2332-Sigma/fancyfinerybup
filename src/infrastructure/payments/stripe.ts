import "server-only";

import Stripe from "stripe";

/**
 * Stripe adapter — the EUR/GBP counterpart to the Paystack adapter, with the
 * same shape (init → redirect, verify, webhook, refund). The SECRET key lives
 * only on the server. Everything is dormant until STRIPE_SECRET_KEY is set, so
 * EUR/GBP orders stay pay-on-delivery until Stripe is activated.
 *
 * We use Stripe Checkout (a hosted payment page) rather than Elements: it keeps
 * card data entirely off our origin (Stripe is PCI-compliant), mirrors the
 * Paystack redirect flow, and needs no client-side Stripe bundle.
 */

const SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Currencies routed to Stripe. Paystack owns NGN/USD (see providers.ts); Stripe
 * covers the two Paystack cannot settle. USD is included so Stripe can still act
 * as a fallback if Paystack is offline, but routing prefers Paystack for it.
 */
const STRIPE_CURRENCIES = new Set(["EUR", "GBP", "USD"]);

export function stripeSupportsCurrency(currency: string): boolean {
  return STRIPE_CURRENCIES.has(currency.trim().toUpperCase());
}

export function isStripeEnabled(): boolean {
  return Boolean(SECRET);
}

let _client: Stripe | null = null;
function client(): Stripe {
  if (!SECRET) throw new Error("Stripe is not configured.");
  // Reuse one instance across invocations. apiVersion is omitted so the SDK
  // uses the version it was built against, which its types guarantee.
  if (!_client) _client = new Stripe(SECRET);
  return _client;
}

export interface StripeSessionParams {
  email: string;
  /** Amount in minor units (cents) of `currency`. */
  amountMinor: number;
  currency: string;
  orderId: string;
  successUrl: string;
  cancelUrl: string;
}

/** Create a hosted Checkout session and return its id + redirect URL. */
export async function stripeCreateCheckoutSession(
  params: StripeSessionParams,
): Promise<{ id: string; url: string }> {
  const session = await client().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: {
            name: `Fancy Finery — order #${params.orderId.slice(0, 8)}`,
          },
          unit_amount: params.amountMinor,
        },
        quantity: 1,
      },
    ],
    customer_email: params.email || undefined,
    // Both carry the order id: client_reference_id for the dashboard, metadata
    // for programmatic reads on verify.
    client_reference_id: params.orderId,
    metadata: { orderId: params.orderId },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }
  return { id: session.id, url: session.url };
}

export interface StripeVerifyResult {
  success: boolean;
  amountMinor: number;
  currency: string;
  orderId: string | null;
}

/** Authoritatively read a session's paid state straight from Stripe. */
export async function stripeVerifySession(
  sessionId: string,
): Promise<StripeVerifyResult> {
  const session = await client().checkout.sessions.retrieve(sessionId);
  return {
    success: session.payment_status === "paid",
    amountMinor: session.amount_total ?? 0,
    currency: (session.currency ?? "").toUpperCase(),
    orderId: session.metadata?.orderId ?? session.client_reference_id ?? null,
  };
}

/**
 * Verify a Stripe webhook signature and return the parsed event, or null if the
 * signature is missing/invalid. Uses the SDK's constructEvent, which does a
 * constant-time HMAC-SHA256 check with a tolerance window against replay.
 */
export function stripeConstructEvent(
  rawBody: string,
  signature: string | null,
): Stripe.Event | null {
  if (!SECRET || !WEBHOOK_SECRET || !signature) return null;
  try {
    return client().webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch {
    return null;
  }
}

/** Refund a paid Checkout session in full (by its underlying PaymentIntent). */
export async function stripeRefundBySession(sessionId: string): Promise<void> {
  const session = await client().checkout.sessions.retrieve(sessionId);
  const pi =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!pi) throw new Error("No payment intent found for this session.");
  await client().refunds.create({ payment_intent: pi });
}
