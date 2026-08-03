import type Stripe from "stripe";

import {
  isStripeEnabled,
  stripeConstructEvent,
} from "@/infrastructure/payments/stripe";
import {
  confirmStripeBySession,
  markPaymentFailed,
} from "@/infrastructure/payments/confirm";
import { recordPaymentEvent } from "@/infrastructure/payments/events";

// Node runtime — Stripe's signature check uses node:crypto.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe webhook — the authoritative source of truth for EUR/GBP payments. */
export async function POST(request: Request): Promise<Response> {
  if (!isStripeEnabled()) {
    return new Response("Payments not enabled", { status: 503 });
  }

  // Must be the raw body — Stripe's HMAC is computed over the exact bytes.
  const raw = await request.text();
  const signature = request.headers.get("stripe-signature");
  const event = stripeConstructEvent(raw, signature);
  if (!event) return new Response("Invalid signature", { status: 401 });

  const session = event.type.startsWith("checkout.session")
    ? (event.data.object as Stripe.Checkout.Session)
    : null;

  // Idempotency + audit: dedupe on Stripe's event id.
  const { isNew } = await recordPaymentEvent({
    provider: "stripe",
    eventId: event.id,
    eventType: event.type,
    reference: session?.id ?? null,
    raw: event as unknown,
  });
  if (!isNew) return new Response("ok", { status: 200 });

  if (session) {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await confirmStripeBySession(session.id);
    } else if (
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "checkout.session.expired"
    ) {
      await markPaymentFailed(session.id);
    }
  }

  // Always 200 once received so Stripe doesn't keep retrying.
  return new Response("ok", { status: 200 });
}
