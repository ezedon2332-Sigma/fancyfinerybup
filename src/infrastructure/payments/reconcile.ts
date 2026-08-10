import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import type { Database } from "@/infrastructure/supabase/database.types";
import {
  confirmPaystackByReference,
  confirmStripeBySession,
} from "./confirm";

type Admin = SupabaseClient<Database>;
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
  payment_reference: string | null;
  payment_provider: string | null;
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
async function attemptsForOrder(
  admin: Admin,
  order: PendingOrder,
): Promise<Attempt[]> {
  const attempts: Attempt[] = [];
  const seen = new Set<string>();

  const add = (reference: string | null, provider: string | null): void => {
    const p = asProvider(provider);
    if (!reference || !p || seen.has(reference)) return;
    seen.add(reference);
    attempts.push({ reference, provider: p });
  };

  // The stored reference first: the most recent attempt is the likeliest payer.
  add(order.payment_reference, order.payment_provider);

  const { data } = await admin
    .from("payment_events")
    .select("reference, provider")
    .eq("order_id", order.id)
    .not("reference", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  for (const row of data ?? []) add(row.reference, row.provider);

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
    const attempts = await attemptsForOrder(admin, o);
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
