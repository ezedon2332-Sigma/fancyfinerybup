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

export interface PaymentEventClaim {
  /**
   * Whether the caller should handle this event now. False only when the event
   * is on record as having been handled to completion.
   */
  shouldProcess: boolean;
}

/**
 * Claim a webhook event: append it to the ledger and report whether it still
 * needs handling.
 *
 * The `(provider, event_id)` unique index is the dedupe key, but recording an
 * event is NOT the same as having handled it — so a row alone doesn't earn a
 * skip. Only `processed_at` does, stamped by `markPaymentEventProcessed` after
 * the work succeeds. That distinction is what makes a provider's retry useful
 * after a handler dies mid-flight instead of being silently swallowed.
 *
 * Fails OPEN throughout: any doubt about the ledger's state resolves to
 * "process it". Re-handling a settled charge is harmless (the conditional update
 * in `markOrderPaid` lets only one caller flip an order, and the provider's
 * idempotency key stops a second receipt), whereas skipping one loses a payment.
 */
export async function recordPaymentEvent(
  input: PaymentEventInput,
): Promise<PaymentEventClaim> {
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
    if (!error) return { shouldProcess: true };

    // 23505 = unique_violation → this exact event is already on the ledger.
    // Whether it was finished is the only question that matters.
    if (error.code === "23505" && input.eventId) {
      const { data, error: readError } = await admin
        .from("payment_events")
        .select("processed_at")
        .eq("provider", input.provider)
        .eq("event_id", input.eventId)
        .maybeSingle();
      // A read failure includes the case where processed_at doesn't exist yet
      // (code deployed ahead of the migration) — fall back to the old, safe
      // behaviour of handling it again.
      if (readError || !data) return { shouldProcess: true };
      return { shouldProcess: data.processed_at === null };
    }

    if (error.code !== "23505") {
      console.error("[payments] event log failed:", error.message);
    }
    return { shouldProcess: true };
  } catch (e) {
    console.error("[payments] event log threw:", e);
    return { shouldProcess: true };
  }
}

/**
 * Log that a charge was started, so the reference survives being overwritten.
 *
 * An order row remembers only its newest reference. Reopening checkout mints a
 * fresh one and re-points the row, which leaves the reconcile sweep unable to
 * even ask the provider about an earlier attempt — and an earlier attempt is
 * exactly what a customer paying from a stale tab completes. Keeping every
 * reference in the ledger gives the sweep the full set to check.
 *
 * Recorded as already processed: there is no work pending on an attempt, and
 * leaving it unstamped would pollute the unprocessed-event index.
 */
export async function recordPaymentAttempt(input: {
  provider: "paystack" | "stripe";
  reference: string;
  orderId: string;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("payment_events").insert({
      provider: input.provider,
      // Unique per attempt, so a retried action can't duplicate the row.
      event_id: `attempt:${input.reference}`,
      event_type: "attempt",
      reference: input.reference,
      order_id: input.orderId,
      processed_at: new Date().toISOString(),
    });
    // 23505 just means this attempt is already logged.
    if (error && error.code !== "23505") {
      console.error("[payments] attempt log failed:", error.message);
    }
  } catch (e) {
    console.error("[payments] attempt log threw:", e);
  }
}

/**
 * Close the loop: mark an event handled so later deliveries of it are skipped.
 * Call ONLY after the work actually succeeded — stamping early re-opens the very
 * hole `processed_at` exists to close. Never throws; an unstamped event is
 * merely handled again, which is safe.
 */
export async function markPaymentEventProcessed(
  provider: "paystack" | "stripe",
  eventId: string | null,
): Promise<void> {
  if (!eventId) return;
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("payment_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider", provider)
      .eq("event_id", eventId);
    if (error) {
      console.error("[payments] could not mark event processed:", error.message);
    }
  } catch (e) {
    console.error("[payments] marking event processed threw:", e);
  }
}
