import {
  isPaystackEnabled,
  paystackValidWebhook,
} from "@/infrastructure/payments/paystack";
import { confirmPaystackByReference } from "@/infrastructure/payments/confirm";

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

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  if (event?.event === "charge.success" && event.data?.reference) {
    await confirmPaystackByReference(event.data.reference);
  }

  // Always 200 so Paystack doesn't retry once we've received it.
  return new Response("ok", { status: 200 });
}
