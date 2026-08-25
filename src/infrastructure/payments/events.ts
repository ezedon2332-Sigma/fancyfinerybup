import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/infrastructure/db/client";
import { paymentEvents } from "@/infrastructure/db/schema";

/** Postgres unique_violation — this exact event is already on the ledger. */
const UNIQUE_VIOLATION = "23505";

function pgCode(e: unknown): string | undefined {
  return typeof e === "object" && e !== null && "code" in e
    ? String((e as { code?: unknown }).code)
    : undefined;
}

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
    await db.insert(paymentEvents).values({
      provider: input.provider,
      eventId: input.eventId ?? null,
      eventType: input.eventType ?? null,
      reference: input.reference ?? null,
      orderId: input.orderId ?? null,
      raw: input.raw ?? null,
    });
    return { shouldProcess: true };
  } catch (e) {
    if (pgCode(e) === UNIQUE_VIOLATION && input.eventId) {
      // Already on the ledger. Whether it was FINISHED is the only question.
      try {
        const row = await db.query.paymentEvents.findFirst({
          where: and(
            eq(paymentEvents.provider, input.provider),
            eq(paymentEvents.eventId, input.eventId),
          ),
          columns: { processedAt: true },
        });
        if (!row) return { shouldProcess: true };
        return { shouldProcess: row.processedAt === null };
      } catch {
        return { shouldProcess: true };
      }
    }
    if (pgCode(e) !== UNIQUE_VIOLATION) {
      console.error("[payments] event log failed:", e);
    }
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
    await db.insert(paymentEvents).values({
      provider: input.provider,
      // Unique per attempt, so a retried action can't duplicate the row.
      eventId: `attempt:${input.reference}`,
      eventType: "attempt",
      reference: input.reference,
      orderId: input.orderId,
      processedAt: new Date().toISOString(),
    });
  } catch (e) {
    // A unique violation just means this attempt is already logged.
    if (pgCode(e) !== UNIQUE_VIOLATION) {
      console.error("[payments] attempt log failed:", e);
    }
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
    await db
      .update(paymentEvents)
      .set({ processedAt: new Date().toISOString() })
      .where(
        and(
          eq(paymentEvents.provider, provider),
          eq(paymentEvents.eventId, eventId),
        ),
      );
  } catch (e) {
    console.error("[payments] could not mark event processed:", e);
  }
}
