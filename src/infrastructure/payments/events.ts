import "server-only";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import type { Json } from "@/infrastructure/supabase/database.types";

export interface PaymentEventInput {
  provider: "paystack" | "stripe";
  /** Provider's event id — the dedupe key. */
  eventId?: string | null;
  eventType?: string | null;
  /** Our payment_reference, when the payload carries it. */
  reference?: string | null;
  orderId?: string | null;
  raw?: unknown;
}

/**
 * Append a webhook event to the ledger and report whether it was new.
 *
 * The `(provider, event_id)` unique index makes this the idempotency gate: a
 * provider re-delivering the same event hits a unique violation and returns
 * `isNew: false`, so the caller can skip reprocessing. Logging never throws —
 * an audit-trail failure must not stop us from acknowledging a real payment.
 */
export async function recordPaymentEvent(
  input: PaymentEventInput,
): Promise<{ isNew: boolean }> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("payment_events").insert({
      provider: input.provider,
      event_id: input.eventId ?? null,
      event_type: input.eventType ?? null,
      reference: input.reference ?? null,
      order_id: input.orderId ?? null,
      raw: (input.raw ?? null) as Json,
    });
    if (error) {
      // 23505 = unique_violation → this exact event was already recorded.
      if (error.code === "23505") return { isNew: false };
      console.error("[payments] event log failed:", error.message);
    }
    return { isNew: true };
  } catch (e) {
    console.error("[payments] event log threw:", e);
    return { isNew: true };
  }
}
