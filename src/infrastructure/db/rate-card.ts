import "server-only";

import type { CountryRates } from "@/domain/entities/shipping-views";
import { buildCountryRates } from "@/domain/shipping/rate-card";
import { loadPricingTable } from "./pricing-service";

/**
 * Load the rate matrix and shape it into published cards.
 *
 * The shaping itself is a pure function of the pricing table and now lives in
 * `domain/shipping/rate-card.ts`; this module is only the I/O half. Splitting
 * them also removed an inverted dependency — the old file imported its return
 * types from a React component.
 *
 * Never throws: an unreachable rate table yields an empty list and the UI shows
 * its own empty state.
 */
export async function loadCountryRates(): Promise<CountryRates[]> {
  try {
    return buildCountryRates(await loadPricingTable());
  } catch {
    return [];
  }
}
