import "server-only";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import { paystackVerify } from "./paystack";

/**
 * Authoritatively confirm a Paystack payment by reference. Used by both the
 * browser callback and the webhook. Uses the service-role client because
 * marking an order paid is admin-gated by RLS. Idempotent + amount-guarded, so
 * a tampered callback can't mark an order paid without a real, matching charge.
 */
export async function confirmPaystackByReference(
  reference: string,
): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const admin = createSupabaseAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, total, currency, payment_status")
    .eq("paystack_reference", reference)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found for reference." };
  if (order.payment_status === "paid") return { ok: true, orderId: order.id };

  const v = await paystackVerify(reference);
  if (!v.success) {
    return { ok: false, orderId: order.id, error: "Payment was not successful." };
  }
  // Never trust the redirect — the verified charge must match the order.
  if (
    v.amountMinor < order.total ||
    v.currency.toUpperCase() !== order.currency.toUpperCase()
  ) {
    return { ok: false, orderId: order.id, error: "Payment amount mismatch." };
  }

  const { error } = await admin
    .from("orders")
    .update({
      payment_status: "paid",
      payment_provider: "paystack",
      paid_at: new Date().toISOString(),
    })
    .eq("id", order.id);
  if (error) return { ok: false, orderId: order.id, error: error.message };

  return { ok: true, orderId: order.id };
}
