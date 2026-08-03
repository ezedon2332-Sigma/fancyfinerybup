import {
  isPaystackEnabled,
  paystackValidWebhook,
} from "@/infrastructure/payments/paystack";
import {
  confirmPaystackByReference,
  markPaymentFailed,
} from "@/infrastructure/payments/confirm";
import { recordPaymentEvent } from "@/infrastructure/payments/events";

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
    data?: { reference?: string; id?: number | string };
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

  const { isNew } = await recordPaymentEvent({
    provider: "paystack",
    eventId,
    eventType: event.event,
    reference,
    raw: event,
  });
  if (!isNew) return new Response("ok", { status: 200 });

  if (event.event === "charge.success" && reference) {
    await confirmPaystackByReference(reference);
  } else if (event.event === "charge.failed" && reference) {
    await markPaymentFailed(reference);
  }

  // Always 200 so Paystack doesn't retry once we've received it.
  return new Response("ok", { status: 200 });
}
