import "server-only";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import type {
  Courier,
  DiscountCode,
  PricingTable,
  Rate,
  TaxRule,
  WeightBracket,
  Zone,
} from "@/domain/shipping/pricing";

/**
 * Loads everything the pricing engine needs.
 *
 * Reads go through the service role because the rate tables carry no public
 * read policy, and because discount codes must never be enumerable from the
 * browser — a readable coupon table is a giveaway.
 *
 * Every read degrades: `tax_rules`, `discount_codes` and the extended weight
 * ladder only exist after migration 20260727000018 is applied. Until then the
 * site prices exactly as it does today (no tax, no coupons) rather than
 * failing, so deploying the code and running the migration can happen in
 * either order.
 */

/** True when the failure is "that table doesn't exist yet". */
function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}

interface ZoneRow { id: string; code: string; name: string; enabled: boolean; sort_order: number }
interface AssignRow { zone_id: string; country_code: string }
interface CourierRow {
  id: string; code: string; name: string; display_name: string | null;
  carrier_code: string | null; enabled: boolean; sort_order: number;
  min_days: number; max_days: number; tracking_url_template?: string | null;
}
interface BracketRow { id: string; label: string; min_grams: number; max_grams: number | null; sort_order: number }
interface RateRow {
  id: string; zone_id: string | null; country_code: string | null;
  method_id: string; bracket_id: string; price: number;
  free_over: number | null; enabled: boolean;
}
interface TaxRow {
  id: string; scope: "global" | "zone" | "country"; country_code: string | null;
  zone_id: string | null; rate_bps: number; label: string;
  applies_to_shipping: boolean; enabled: boolean;
}

export async function loadPricingTable(): Promise<PricingTable> {
  const db = createSupabaseAdminClient();

  const [zonesRes, assignsRes, couriersRes, bracketsRes, ratesRes, taxRes] =
    await Promise.all([
      db.from("shipping_zones").select("*").order("sort_order"),
      db.from("shipping_zone_countries").select("*"),
      db.from("shipping_methods").select("*").order("sort_order"),
      db.from("shipping_weight_brackets").select("*").order("min_grams"),
      db.from("shipping_rates").select("*").limit(20000),
      db.from("tax_rules").select("*"),
    ]);

  const countriesByZone = new Map<string, string[]>();
  for (const a of (assignsRes.data ?? []) as AssignRow[]) {
    const list = countriesByZone.get(a.zone_id) ?? [];
    list.push(a.country_code.toUpperCase());
    countriesByZone.set(a.zone_id, list);
  }

  const zones: Zone[] = ((zonesRes.data ?? []) as ZoneRow[]).map((z) => ({
    id: z.id,
    code: z.code,
    name: z.name,
    enabled: z.enabled,
    sortOrder: z.sort_order,
    countries: countriesByZone.get(z.id) ?? [],
  }));

  const couriers: Courier[] = ((couriersRes.data ?? []) as CourierRow[]).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    // display_name only exists post-migration; the method name is a fine stand-in.
    displayName: c.display_name ?? c.name,
    carrierCode: c.carrier_code,
    enabled: c.enabled,
    sortOrder: c.sort_order,
    minDays: c.min_days,
    maxDays: c.max_days,
    trackingUrlTemplate: c.tracking_url_template ?? null,
  }));

  const brackets: WeightBracket[] = ((bracketsRes.data ?? []) as BracketRow[]).map((b) => ({
    id: b.id,
    label: b.label,
    minGrams: b.min_grams,
    maxGrams: b.max_grams,
    sortOrder: b.sort_order,
  }));

  const rates: Rate[] = ((ratesRes.data ?? []) as RateRow[]).map((r) => ({
    id: r.id,
    zoneId: r.zone_id,
    countryCode: r.country_code,
    courierId: r.method_id,
    bracketId: r.bracket_id,
    priceKobo: r.price,
    freeOverKobo: r.free_over,
    enabled: r.enabled,
  }));

  // No tax_rules table yet -> no tax, which is exactly today's behaviour.
  const taxRules: TaxRule[] = isMissingRelation(taxRes.error)
    ? []
    : ((taxRes.data ?? []) as TaxRow[]).map((t) => ({
        id: t.id,
        scope: t.scope,
        countryCode: t.country_code,
        zoneId: t.zone_id,
        rateBps: t.rate_bps,
        label: t.label,
        appliesToShipping: t.applies_to_shipping,
        enabled: t.enabled,
      }));

  return { zones, couriers, brackets, rates, taxRules };
}

/** Weight assumed for a product with none recorded, so a bag of unweighed
 *  items still prices rather than shipping as if it were weightless. */
export async function defaultItemWeightGrams(): Promise<number> {
  try {
    const db = createSupabaseAdminClient();
    const { data } = await db
      .from("shipping_settings")
      .select("default_item_weight_grams")
      .eq("id", true)
      .maybeSingle();
    return data?.default_item_weight_grams ?? 500;
  } catch {
    return 500;
  }
}

/** Look a coupon up by code, case-insensitively. Returns null when the code is
 *  unknown or the table does not exist yet. */
export async function findDiscountCode(
  code: string,
): Promise<DiscountCode | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from("discount_codes")
    .select("*")
    .ilike("code", trimmed)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    id: string; code: string; kind: DiscountCode["kind"];
    percent_bps: number | null; amount_kobo: number | null;
    min_subtotal_kobo: number; max_discount_kobo: number | null;
    first_time_only: boolean; starts_at: string | null; ends_at: string | null;
    usage_limit: number | null; used_count: number; enabled: boolean;
  };

  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    percentBps: row.percent_bps,
    amountKobo: row.amount_kobo,
    minSubtotalKobo: row.min_subtotal_kobo,
    maxDiscountKobo: row.max_discount_kobo,
    firstTimeOnly: row.first_time_only,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    usageLimit: row.usage_limit,
    usedCount: row.used_count,
    enabled: row.enabled,
  };
}

/** Whether this customer has ever completed an order — the test behind
 *  first-order-only codes. Unknown customers count as first-time. */
export async function isFirstOrder(userId: string | null): Promise<boolean> {
  if (!userId) return true;
  try {
    const db = createSupabaseAdminClient();
    const { count } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    return (count ?? 0) === 0;
  } catch {
    return false; // fail closed: never hand out a first-order discount by accident
  }
}
