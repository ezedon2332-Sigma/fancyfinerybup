import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import type { Database } from "@/infrastructure/supabase/database.types";
import { notifyPaymentReceived } from "@/infrastructure/notifications/email";
import { paystackVerify } from "./paystack";
import { stripeVerifySession } from "./stripe";

type Admin = SupabaseClient<Database>;

export interface ConfirmResult {
  ok: boolean;
  orderId?: string;
  error?: string;
}

interface OrderRow {
  id: string;
  total: number;
  currency: string;
  payment_status: string;
}

interface VerifiedCharge {
  success: boolean;
  amountMinor: number;
  currency: string;
}

/** Look up the order a charge belongs to by its reference. */
async function findOrderByReference(
  admin: Admin,
  reference: string,
): Promise<OrderRow | null> {
  const cols = "id, total, currency, payment_status";
  const { data } = await admin
    .from("orders")
    .select(cols)
    .eq("payment_reference", reference)
    .maybeSingle();
  if (data) return data;
  // Back-compat: orders started before the generic column existed keyed the
  // charge to paystack_reference.
  const { data: legacy } = await admin
    .from("orders")
    .select(cols)
    .eq("paystack_reference", reference)
    .maybeSingle();
  return legacy ?? null;
}

/**
 * The one place an order is marked paid, shared by both providers. Idempotent
 * and amount-guarded: a tampered callback can't mark an order paid without a
 * real charge whose verified amount and currency match the order.
 */
async function markOrderPaid(
  admin: Admin,
  order: OrderRow,
  v: VerifiedCharge,
  provider: "paystack" | "stripe",
): Promise<ConfirmResult> {
  // Already settled — never touch a paid or refunded order.
  if (order.payment_status === "paid") return { ok: true, orderId: order.id };
  if (order.payment_status === "refunded") {
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

  // Conditional update guards against a webhook + callback racing: only a row
  // still unpaid/failed flips to paid, so the win is decided by the database.
  const { data: updated, error } = await admin
    .from("orders")
    .update({
      payment_status: "paid",
      payment_provider: provider,
      paid_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .in("payment_status", ["unpaid", "failed"])
    .select("id");
  if (error) return { ok: false, orderId: order.id, error: error.message };

  // Only the request that actually flipped the row sends the receipt, so a
  // double delivery can't email the customer twice.
  if (updated && updated.length > 0) {
    await notifyPaymentReceived(order.id);
  }
  return { ok: true, orderId: order.id };
}

/**
 * Confirm a Paystack payment by reference. Used by both the browser callback
 * and the webhook. Uses the service-role client because marking an order paid
 * is admin-gated by RLS.
 */
export async function confirmPaystackByReference(
  reference: string,
): Promise<ConfirmResult> {
  const admin = createSupabaseAdminClient();
  const order = await findOrderByReference(admin, reference);
  if (!order) return { ok: false, error: "Order not found for reference." };
  if (order.payment_status === "paid") return { ok: true, orderId: order.id };

  const v = await paystackVerify(reference);
  return markOrderPaid(
    admin,
    order,
    { success: v.success, amountMinor: v.amountMinor, currency: v.currency },
    "paystack",
  );
}

/** Confirm a Stripe payment by its Checkout Session id. */
export async function confirmStripeBySession(
  sessionId: string,
): Promise<ConfirmResult> {
  const admin = createSupabaseAdminClient();
  const order = await findOrderByReference(admin, sessionId);
  if (!order) return { ok: false, error: "Order not found for session." };
  if (order.payment_status === "paid") return { ok: true, orderId: order.id };

  const v = await stripeVerifySession(sessionId);
  // Defense in depth: the session's own order id must match the order we found.
  if (v.orderId && v.orderId !== order.id) {
    return { ok: false, orderId: order.id, error: "Session/order mismatch." };
  }
  return markOrderPaid(
    admin,
    order,
    { success: v.success, amountMinor: v.amountMinor, currency: v.currency },
    "stripe",
  );
}

/**
 * Record a failed charge — only ever unpaid → failed, so it can't clobber a
 * paid or refunded order. Driven by explicit provider failure webhooks.
 */
export async function markPaymentFailed(reference: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from("orders")
    .update({ payment_status: "failed" })
    .eq("payment_reference", reference)
    .eq("payment_status", "unpaid");
}
