import "server-only";

import { eq } from "drizzle-orm";

import type { ExchangeRates } from "@/domain/shared/display-price";
import { DEFAULT_EXCHANGE_RATES } from "@/domain/shared/display-price";
import { CACHE_KEYS, TTL, cached, invalidate } from "@/infrastructure/cache/cache";
import { db } from "./client";
import { shippingSettings } from "./schema";

/**
 * The store's exchange rates, as set by an admin.
 *
 * Lives on the `shipping_settings` singleton (id = true) because that row
 * already holds the other money-shaped configuration the checkout reads —
 * default parcel weight, tax rate, discount — and splitting rates into a second
 * table would mean two reads on every quote for one row of numbers.
 *
 * Read fresh on each render rather than cached in module scope: an admin
 * changing a rate expects the storefront to move on the next request, and a
 * process-lifetime cache would hold a stale rate until redeploy. (This is a
 * prime candidate for the Redis layer, with invalidation on save.)
 */
export async function loadExchangeRates(): Promise<ExchangeRates> {
  return cached(CACHE_KEYS.exchangeRates, TTL.config, loadExchangeRatesUncached);
}

async function loadExchangeRatesUncached(): Promise<ExchangeRates> {
  try {
    const [row] = await db
      .select({
        usd: shippingSettings.ngnPerUsd,
        eur: shippingSettings.ngnPerEur,
        gbp: shippingSettings.ngnPerGbp,
        enabled: shippingSettings.fxEnabled,
      })
      .from(shippingSettings)
      .where(eq(shippingSettings.id, true))
      .limit(1);

    if (!row) return DEFAULT_EXCHANGE_RATES;
    return {
      enabled: row.enabled,
      ngnPer: { NGN: 1, USD: row.usd, EUR: row.eur, GBP: row.gbp },
    };
  } catch {
    // A settings outage must not take the storefront down, and it must not
    // silently re-price it either: fall back to conversion OFF, which is the
    // pricing the store has always used.
    return DEFAULT_EXCHANGE_RATES;
  }
}

export interface SaveRatesInput {
  usd: number;
  eur: number;
  gbp: number;
  enabled: boolean;
}

/** Persist the rates. Callers must have passed requireAdmin(). */
export async function saveExchangeRates(input: SaveRatesInput): Promise<void> {
  await db
    .update(shippingSettings)
    .set({
      ngnPerUsd: Math.round(input.usd),
      ngnPerEur: Math.round(input.eur),
      ngnPerGbp: Math.round(input.gbp),
      fxEnabled: input.enabled,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(shippingSettings.id, true));

  // Rates price every page, so a stale cache here shows the wrong money.
  // Invalidated explicitly rather than waiting out the TTL.
  await invalidate(CACHE_KEYS.exchangeRates, CACHE_KEYS.pricingTable);
}
