import {
  isPaystackEnabled,
  metadataOrderId,
  paystackValidWebhook,
} from "@/infrastructure/payments/paystack";
import {
  confirmPaystackByReference,
  markPaymentFailed,
} from "@/infrastructure/payments/confirm";
import {
  markPaymentEventProcessed,
  recordPaymentEvent,
} from "@/infrastructure/payments/events";

// Node runtime — the webhook signature check uses node:crypto.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Paystack webhook — the authoritative source of truth for payment success. */
export async function POST(request: Request): Promise<Response> {
  if (!isPaystackEnabled()) {
    return new Response("Payments not enabled", { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  if (!paystackValidWebhook(raw, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: {
    event?: string;
    data?: {
      reference?: string;
      id?: number | string;
      metadata?: unknown;
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  const reference = event.data?.reference ?? null;
  // Paystack has no top-level event id; compose one from the type + transaction
  // id so a success and a later failure for the same charge don't dedupe away.
  const eventId =
    event.data?.id != null ? `${event.event}:${event.data.id}` : null;
  const orderId = metadataOrderId(event.data?.metadata);

  const { shouldProcess } = await recordPaymentEvent({
    provider: "paystack",
    eventId,
    eventType: event.event,
    reference,
    orderId,
    raw: event,
  });
  // Only an event already handled to completion is skipped. One that was merely
  // recorded before a handler died is replayed — see recordPaymentEvent.
  if (!shouldProcess) return new Response("ok", { status: 200 });

  try {
    if (event.event === "charge.success" && reference) {
      await confirmPaystackByReference(reference, { fallbackOrderId: orderId });
    } else if (event.event === "charge.failed" && reference) {
      await markPaymentFailed(reference);
    }
  } catch (e) {
    // Transient: the provider verify call or the database failed. Leave the
    // event unstamped and hand Paystack a 5xx so it retries — swallowing this
    // with a 200 is how a real charge ends up permanently unsettled.
    console.error("[paystack] webhook handling failed:", e);
    return new Response("Handling failed", { status: 500 });
  }

  // Handled — including outcomes a retry can't improve (amount mismatch, an
  // unknown order), which are decisions, not failures.
  await markPaymentEventProcessed("paystack", eventId);
  return new Response("ok", { status: 200 });
}
