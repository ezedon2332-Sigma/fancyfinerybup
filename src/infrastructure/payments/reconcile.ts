import "server-only";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import {
  confirmPaystackByReference,
  confirmStripeBySession,
} from "./confirm";

/**
 * Safety net for the rare case where a webhook is dropped AND the customer never
 * returns to the callback: re-verify recently-started charges straight from the
 * provider and settle any that actually succeeded. Idempotent — confirm* only
 * flips an order that is still unpaid/failed — so running it repeatedly is safe.
 */
export async function reconcilePendingPayments(): Promise<{
  checked: number;
  settled: number;
}> {
  const admin = createSupabaseAdminClient();

  // Only look back a few days: a charge that never completed in that window is
  // abandoned, not pending, and re-checking it forever wastes provider calls.
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await admin
    .from("orders")
    .select("id, payment_reference, payment_provider, payment_status")
    .in("payment_status", ["unpaid", "failed"])
    .not("payment_reference", "is", null)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = data ?? [];
  let settled = 0;

  for (const o of rows) {
    if (!o.payment_reference || !o.payment_provider) continue;
    try {
      const res =
        o.payment_provider === "stripe"
          ? await confirmStripeBySession(o.payment_reference)
          : await confirmPaystackByReference(o.payment_reference);
      if (res.ok && res.orderId) settled++;
    } catch {
      // A provider error on one order must not stop the sweep.
    }
  }

  return { checked: rows.length, settled };
}
