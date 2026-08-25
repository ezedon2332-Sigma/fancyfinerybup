import "server-only";

import { asc, count, eq, sql } from "drizzle-orm";

import type {
  Courier,
  DiscountCode,
  PricingTable,
  Rate,
  TaxRule,
  WeightBracket,
  Zone,
} from "@/domain/shipping/pricing";
import { CACHE_KEYS, TTL, cached } from "@/infrastructure/cache/cache";
import { db } from "./client";
import {
  discountCodes,
  orders,
  shippingMethods,
  shippingRates,
  shippingSettings,
  shippingWeightBrackets,
  shippingZoneCountries,
  shippingZones,
  taxRules,
} from "./schema";

/**
 * Loads everything the pricing engine needs.
 *
 * The "degrade if the table doesn't exist yet" handling the Supabase version
 * carried (PGRST205/42P01 probes on tax_rules, discount_codes and the extended
 * weight ladder) is gone. It existed because a deploy could ship code before a
 * migration had been applied, so the app had to price correctly
 * against a schema that might be a migration behind. Migrations now run as a
 * step before the app starts (`npm run db:migrate`), so a missing table is a
 * broken deployment, not a state to price through — and quietly charging no tax
 * because a query failed is exactly the kind of silence that should be loud.
 */

/**
 * Cached: six queries, read on every checkout render and every shipping quote,
 * changed only by an admin (who invalidates it on save). The TTL is a backstop
 * for anything that bypasses those writes.
 */
export async function loadPricingTable(): Promise<PricingTable> {
  return cached(CACHE_KEYS.pricingTable, TTL.pricing, loadPricingTableUncached);
}

async function loadPricingTableUncached(): Promise<PricingTable> {
  const [zoneRows, assignRows, courierRows, bracketRows, rateRows, taxRows] =
    await Promise.all([
      db.select().from(shippingZones).orderBy(asc(shippingZones.sortOrder)),
      db.select().from(shippingZoneCountries),
      db.select().from(shippingMethods).orderBy(asc(shippingMethods.sortOrder)),
      db
        .select()
        .from(shippingWeightBrackets)
        .orderBy(asc(shippingWeightBrackets.minGrams)),
      db.select().from(shippingRates).limit(20000),
      db.select().from(taxRules),
    ]);

  const countriesByZone = new Map<string, string[]>();
  for (const a of assignRows) {
    if (!a.zoneId) continue;
    const list = countriesByZone.get(a.zoneId) ?? [];
    list.push(a.countryCode.toUpperCase());
    countriesByZone.set(a.zoneId, list);
  }

  const zones: Zone[] = zoneRows.map((z) => ({
    id: z.id,
    code: z.code,
    name: z.name,
    enabled: z.enabled,
    sortOrder: z.sortOrder,
    countries: countriesByZone.get(z.id) ?? [],
  }));

  const couriers: Courier[] = courierRows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    displayName: c.displayName ?? c.name,
    carrierCode: c.carrierCode,
    enabled: c.enabled,
    sortOrder: c.sortOrder,
    minDays: c.minDays,
    maxDays: c.maxDays,
    trackingUrlTemplate: c.trackingUrlTemplate ?? null,
  }));

  const brackets: WeightBracket[] = bracketRows.map((b) => ({
    id: b.id,
    label: b.label,
    minGrams: b.minGrams,
    maxGrams: b.maxGrams,
    sortOrder: b.sortOrder,
  }));

  const rates: Rate[] = rateRows.map((r) => ({
    id: r.id,
    zoneId: r.zoneId,
    countryCode: r.countryCode,
    courierId: r.methodId,
    bracketId: r.bracketId,
    priceKobo: r.price,
    freeOverKobo: r.freeOver,
    enabled: r.enabled,
  }));

  const tax: TaxRule[] = taxRows.map((t) => ({
    id: t.id,
    scope: t.scope as TaxRule["scope"],
    countryCode: t.countryCode,
    zoneId: t.zoneId,
    rateBps: t.rateBps,
    label: t.label,
    appliesToShipping: t.appliesToShipping,
    enabled: t.enabled,
  }));

  return { zones, couriers, brackets, rates, taxRules: tax };
}

/**
 * Weight assumed for a product with none recorded, so a bag of unweighed items
 * still prices rather than shipping as if it were weightless.
 */
export async function defaultItemWeightGrams(): Promise<number> {
  const [row] = await db
    .select({ grams: shippingSettings.defaultItemWeightGrams })
    .from(shippingSettings)
    .where(eq(shippingSettings.id, true))
    .limit(1);
  return row?.grams ?? 500;
}

/** Look a coupon up by code, case-insensitively. Null when unknown. */
export async function findDiscountCode(
  code: string,
): Promise<DiscountCode | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  // Matches the `discount_codes_code_key` unique index, which is on
  // upper(code) — so this comparison is the one the index can serve.
  const [row] = await db
    .select()
    .from(discountCodes)
    .where(sql`upper(${discountCodes.code}) = upper(${trimmed})`)
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    kind: row.kind as DiscountCode["kind"],
    percentBps: row.percentBps,
    amountKobo: row.amountKobo,
    minSubtotalKobo: row.minSubtotalKobo,
    maxDiscountKobo: row.maxDiscountKobo,
    firstTimeOnly: row.firstTimeOnly,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    usageLimit: row.usageLimit,
    usedCount: row.usedCount,
    enabled: row.enabled,
  };
}

/**
 * Whether this customer has ever placed an order — the test behind
 * first-order-only codes. Unknown customers count as first-time.
 *
 * Fails closed: an error here returns false, so a database blip can never hand
 * out a first-order discount to a repeat customer.
 */
export async function isFirstOrder(userId: string | null): Promise<boolean> {
  if (!userId) return true;
  try {
    const [row] = await db
      .select({ n: count() })
      .from(orders)
      .where(eq(orders.userId, userId));
    return (row?.n ?? 0) === 0;
  } catch {
    return false;
  }
}
