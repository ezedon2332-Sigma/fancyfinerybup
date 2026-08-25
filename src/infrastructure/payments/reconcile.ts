import "server-only";

import { and, desc, gte, inArray, isNotNull, isNull, lte, eq } from "drizzle-orm";

import { db } from "@/infrastructure/db/client";
import { orders, paymentEvents } from "@/infrastructure/db/schema";
import {
  confirmPaystackByReference,
  confirmStripeBySession,
} from "./confirm";

type Provider = "paystack" | "stripe";

/** One charge attempt to re-check, newest first. */
interface Attempt {
  reference: string;
  provider: Provider;
}

function asProvider(value: string | null): Provider | null {
  return value === "paystack" || value === "stripe" ? value : null;
}

interface PendingOrder {
  id: string;
  paymentReference: string | null;
  paymentProvider: string | null;
}

/**
 * Every reference this order ever started a charge with, newest first.
 *
 * The order row holds only the newest, because reopening checkout mints a fresh
 * reference and re-points the row at it. The ledger keeps them all — attempts
 * logged at initialize time, plus any reference seen on a webhook — which is
 * what makes a charge completed on a stale tab discoverable at all.
 *
 * Each reference carries the provider that issued it rather than reusing the
 * order's current one, so a re-check always asks the right API.
 */
async function attemptsForOrder(order: PendingOrder): Promise<Attempt[]> {
  const attempts: Attempt[] = [];
  const seen = new Set<string>();

  const add = (reference: string | null, provider: string | null): void => {
    const p = asProvider(provider);
    if (!reference || !p || seen.has(reference)) return;
    seen.add(reference);
    attempts.push({ reference, provider: p });
  };

  // The stored reference first: the most recent attempt is the likeliest payer.
  add(order.paymentReference, order.paymentProvider);

  const rows = await db
    .select({
      reference: paymentEvents.reference,
      provider: paymentEvents.provider,
    })
    .from(paymentEvents)
    .where(
      and(
        eq(paymentEvents.orderId, order.id),
        isNotNull(paymentEvents.reference),
      ),
    )
    .orderBy(desc(paymentEvents.createdAt))
    .limit(10);

  for (const row of rows) add(row.reference, row.provider);

  return attempts;
}

/**
 * Safety net for the rare case where a webhook is dropped AND the customer never
 * returns to the callback: re-verify recently-started charges straight from the
 * provider and settle any that actually succeeded. Idempotent — confirm* only
 * flips an order that is still unpaid/failed — so running it repeatedly is safe.
 *
 * Orders that predate attempt logging only have their stored reference to check,
 * which is the behaviour this had throughout.
 */
export async function reconcilePendingPayments(): Promise<{
  checked: number;
  settled: number;
}> {
  // Only look back a few days: a charge that never completed in that window is
  // abandoned, not pending, and re-checking it forever wastes provider calls.
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const rows = await db
    .select({
      id: orders.id,
      paymentReference: orders.paymentReference,
      paymentProvider: orders.paymentProvider,
    })
    .from(orders)
    .where(
      and(
        inArray(orders.paymentStatus, ["unpaid", "failed"]),
        isNotNull(orders.paymentReference),
        gte(orders.createdAt, cutoff),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(100);

  let settled = 0;

  for (const o of rows) {
    const attempts = await attemptsForOrder(o);
    for (const attempt of attempts) {
      try {
        const res =
          attempt.provider === "stripe"
            ? await confirmStripeBySession(attempt.reference)
            : await confirmPaystackByReference(attempt.reference);
        if (res.ok && res.orderId) {
          settled++;
          break; // Settled — the remaining attempts for this order are moot.
        }
      } catch {
        // An unknown or expired reference throws. Keep going: a later attempt
        // may be the one that actually paid.
      }
    }
  }

  return { checked: rows.length, settled };
}


/**
 * How long an unpaid order holds its stock before we give up on it.
 *
 * Deliberately longer than the reconcile window above (3 days). The sequence
 * that has to work is a customer on a bad connection: they complete the charge
 * on Paystack, their browser dies before the callback, and the webhook is the
 * thing that settles it. If the webhook is also lost, the daily reconcile has
 * three days of attempts. Only after a further four days of silence is the
 * order treated as abandoned — and even then it is re-verified with the
 * provider first.
 */
const ABANDON_AFTER_DAYS = 7;

/**
 * Release stock held by orders that were never paid for.
 *
 * Placing an order claims its stock, which is what stops two customers buying
 * the last dress. The cost is that an abandoned basket holds real inventory
 * off the storefront, and nothing was giving it back.
 *
 * **Every candidate is verified with the provider before anything is
 * released.** An order reaching this point has already gone unsettled for a
 * week, which is exactly the profile of a payment whose webhook AND callback
 * were both lost — the customer paid and does not know anything is wrong.
 * Cancelling that order and restocking the item would take a paid customer's
 * purchase away. One API call per abandoned order is cheap insurance against
 * that, and there are very few of them by definition.
 */
export async function releaseAbandonedOrders(): Promise<{
  checked: number;
  settled: number;
  released: number;
}> {
  const cutoff = new Date(
    Date.now() - ABANDON_AFTER_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const candidates = await db
    .select({
      id: orders.id,
      paymentReference: orders.paymentReference,
      paymentProvider: orders.paymentProvider,
    })
    .from(orders)
    .where(
      and(
        inArray(orders.paymentStatus, ["unpaid", "failed"]),
        eq(orders.status, "processing"),
        isNull(orders.stockRestoredAt),
        lte(orders.createdAt, cutoff),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(100);

  let settled = 0;
  let released = 0;

  for (const order of candidates) {
    // Last chance: ask the provider about every reference this order ever used.
    let paid = false;
    for (const attempt of await attemptsForOrder(order)) {
      try {
        const res =
          attempt.provider === "stripe"
            ? await confirmStripeBySession(attempt.reference)
            : await confirmPaystackByReference(attempt.reference);
        if (res.ok && res.orderId) {
          paid = true;
          settled += 1;
          break;
        }
      } catch {
        // An unknown or expired reference throws. That is not evidence the
        // order was unpaid — a later attempt may still be the one that paid.
      }
    }
    if (paid) continue;

    // Genuinely abandoned. Cancel and put the stock back, in that order: the
    // repository only restores for a cancelled order, and its stock_restored_at
    // guard makes a repeat run a no-op rather than a second credit.
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(orders)
          .set({ status: "cancelled" })
          .where(
            and(
              eq(orders.id, order.id),
              eq(orders.status, "processing"),
              inArray(orders.paymentStatus, ["unpaid", "failed"]),
            ),
          );
      });

      const { getOrderRepository } = await import(
        "@/infrastructure/db/order-service"
      );
      await (await getOrderRepository()).restoreStock(order.id);
      released += 1;
    } catch (e) {
      // One stuck order must not stop the sweep clearing the rest.
      console.error("[reconcile] could not release order", order.id, e);
    }
  }

  return { checked: candidates.length, settled, released };
}
