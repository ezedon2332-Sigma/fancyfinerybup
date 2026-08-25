import "server-only";

import { and, eq, inArray, or } from "drizzle-orm";

import { db } from "@/infrastructure/db/client";
import { orders } from "@/infrastructure/db/schema";
import { notifyPaymentReceived } from "@/infrastructure/notifications/email";
import { paystackVerify } from "./paystack";
import { stripeVerifySession } from "./stripe";

export interface ConfirmResult {
  ok: boolean;
  orderId?: string;
  error?: string;
}

interface OrderRow {
  id: string;
  total: number;
  currency: string;
  paymentStatus: string;
}

interface VerifiedCharge {
  success: boolean;
  amountMinor: number;
  currency: string;
}

const ORDER_COLUMNS = {
  id: orders.id,
  total: orders.total,
  currency: orders.currency,
  paymentStatus: orders.paymentStatus,
};

/**
 * Look up the order a charge belongs to by its reference.
 *
 * Two columns are checked because orders started before the generic
 * `payment_reference` column existed keyed the charge to `paystack_reference`.
 * The Supabase version issued two sequential round trips for that; one OR does
 * the same work in a single query.
 */
async function findOrderByReference(reference: string): Promise<OrderRow | null> {
  const [row] = await db
    .select(ORDER_COLUMNS)
    .from(orders)
    .where(
      or(
        eq(orders.paymentReference, reference),
        eq(orders.paystackReference, reference),
      ),
    )
    .limit(1);
  return row ? { ...row, paymentStatus: row.paymentStatus ?? "unpaid" } : null;
}

/** Look an order up directly, for charges that carry their order id. */
async function findOrderById(orderId: string): Promise<OrderRow | null> {
  const [row] = await db
    .select(ORDER_COLUMNS)
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return row ? { ...row, paymentStatus: row.paymentStatus ?? "unpaid" } : null;
}

/**
 * The one place an order is marked paid, shared by both providers. Idempotent
 * and amount-guarded: a tampered callback can't mark an order paid without a
 * real charge whose verified amount and currency match the order.
 */
async function markOrderPaid(
  order: OrderRow,
  v: VerifiedCharge,
  provider: "paystack" | "stripe",
): Promise<ConfirmResult> {
  // Already settled — never touch a paid or refunded order.
  if (order.paymentStatus === "paid") return { ok: true, orderId: order.id };
  if (order.paymentStatus === "refunded") {
    return { ok: false, orderId: order.id, error: "Order already refunded." };
  }

  if (!v.success) {
    return { ok: false, orderId: order.id, error: "Payment was not successful." };
  }
  // Never trust the redirect: the verified charge must cover the order in the
  // order's own currency.
  if (
    v.amountMinor < order.total ||
    v.currency.toUpperCase() !== order.currency.toUpperCase()
  ) {
    return { ok: false, orderId: order.id, error: "Payment amount mismatch." };
  }

  try {
    // Conditional update guards against a webhook + callback racing: only a row
    // still unpaid/failed flips to paid, so the win is decided by the database.
    const updated = await db
      .update(orders)
      .set({
        paymentStatus: "paid",
        paymentProvider: provider,
        paidAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(orders.id, order.id),
          inArray(orders.paymentStatus, ["unpaid", "failed"]),
        ),
      )
      .returning({ id: orders.id });

    // Only the request that actually flipped the row sends the receipt, so a
    // double delivery can't email the customer twice.
    if (updated.length > 0) {
      await notifyPaymentReceived(order.id);
    }
    return { ok: true, orderId: order.id };
  } catch (e) {
    return {
      ok: false,
      orderId: order.id,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Confirm a Paystack payment by reference. Used by both the browser callback
 * and the webhook.
 *
 * `fallbackOrderId` lets a caller that can already see the charge's metadata
 * (the webhook) supply the order id without waiting on the verify call.
 */
export async function confirmPaystackByReference(
  reference: string,
  opts?: { fallbackOrderId?: string | null },
): Promise<ConfirmResult> {
  const byReference = await findOrderByReference(reference);
  // Settled already — skip the provider round-trip entirely.
  if (byReference?.paymentStatus === "paid") {
    return { ok: true, orderId: byReference.id };
  }

  const v = await paystackVerify(reference);

  // Starting checkout again mints a fresh reference and re-points the order row
  // at it, so a charge completed on an earlier tab arrives with a reference that
  // now matches nothing. The order id travels with the charge itself, so fall
  // back to it rather than stranding a real payment as unpaid.
  const chargeOrderId = v.orderId ?? opts?.fallbackOrderId ?? null;
  const order =
    byReference ?? (chargeOrderId ? await findOrderById(chargeOrderId) : null);
  if (!order) return { ok: false, error: "Order not found for reference." };

  // Defense in depth: a charge naming a different order than the reference
  // resolved to is incoherent — settle neither.
  if (byReference && v.orderId && v.orderId !== byReference.id) {
    return { ok: false, orderId: byReference.id, error: "Charge/order mismatch." };
  }
  if (order.paymentStatus === "paid") return { ok: true, orderId: order.id };

  return markOrderPaid(
    order,
    { success: v.success, amountMinor: v.amountMinor, currency: v.currency },
    "paystack",
  );
}

/** Confirm a Stripe payment by its Checkout Session id. */
export async function confirmStripeBySession(
  sessionId: string,
): Promise<ConfirmResult> {
  const order = await findOrderByReference(sessionId);
  if (!order) return { ok: false, error: "Order not found for session." };
  if (order.paymentStatus === "paid") return { ok: true, orderId: order.id };

  const v = await stripeVerifySession(sessionId);
  // Defense in depth: the session's own order id must match the order we found.
  if (v.orderId && v.orderId !== order.id) {
    return { ok: false, orderId: order.id, error: "Session/order mismatch." };
  }
  return markOrderPaid(
    order,
    { success: v.success, amountMinor: v.amountMinor, currency: v.currency },
    "stripe",
  );
}

/**
 * Record a failed charge — only ever unpaid → failed, so it can't clobber a
 * paid or refunded order. Driven by explicit provider failure webhooks.
 *
 * Resolves the order the same way the success path does, so a failure webhook
 * for an order keyed to the legacy `paystack_reference` column lands instead of
 * silently matching nothing.
 *
 * Deliberately does NOT fall back to the charge's metadata order id the way
 * confirmation does: a customer who abandons one attempt and pays on a second
 * would otherwise have the abandoned attempt's failure mark the order they are
 * actively paying for. `failed` never blocks a later payment, but showing it
 * while a charge is still in flight would be a lie.
 */
export async function markPaymentFailed(reference: string): Promise<void> {
  const order = await findOrderByReference(reference);
  if (!order) return;
  await db
    .update(orders)
    .set({ paymentStatus: "failed" })
    .where(and(eq(orders.id, order.id), eq(orders.paymentStatus, "unpaid")));
}
