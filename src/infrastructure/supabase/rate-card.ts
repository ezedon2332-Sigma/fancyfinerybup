import "server-only";

import { COUNTRIES } from "@/domain/shipping/countries";
import { loadPricingTable } from "@/infrastructure/supabase/pricing-service";
import type {
  CountryRates,
  RateRow,
} from "@/components/shipping/RatesBrowser";

/**
 * Turn the stored rate matrix into one published card per destination.
 *
 * Shared by the public rates page and the checkout browser so the two can
 * never disagree: both render the same figures the quote engine charges.
 *
 * Consecutive bands at the same price are merged, because the ladder is cut
 * at every boundary any country uses and a single published band often spans
 * several brackets. Showing "2 – 2.5 kg" and "2.5 – 3 kg" at identical money
 * is noise; the carrier quotes it as "2 – 3 kg".
 */
export function buildCountryRates(
  table: Awaited<ReturnType<typeof loadPricingTable>>,
): CountryRates[] {
  const brackets = [...table.brackets].sort((a, b) => a.minGrams - b.minGrams);
  const couriers = table.couriers.filter((c) => c.enabled);
  if (couriers.length === 0) return [];

  // Everything below used to be looked up by scanning an array from inside the
  // innermost loop, which made this O(couriers x brackets x rates x countries
  // x rates) — tens of millions of comparisons per request against a real rate
  // table, and about twenty seconds of CPU before the page could even start
  // streaming. Three indexes turn each of those scans into a hash lookup.

  /** Enabled rates keyed by courier+bracket, in their original array order. */
  const ratesByCourierBracket = new Map<string, typeof table.rates>();
  /** country+courier+bracket combinations that have an explicit override. */
  const overrides = new Set<string>();
  for (const rate of table.rates) {
    if (!rate.enabled) continue;
    const key = `${rate.courierId}|${rate.bracketId}`;
    const bucket = ratesByCourierBracket.get(key);
    if (bucket) bucket.push(rate);
    else ratesByCourierBracket.set(key, [rate]);
    if (rate.countryCode) {
      overrides.add(`${rate.countryCode.toUpperCase()}|${key}`);
    }
  }

  const zoneCountries = new Map(table.zones.map((z) => [z.id, z.countries]));
  const countryNames = new Map(COUNTRIES.map((c) => [c.code, c.name]));

  const cards = new Map<string, CountryRates>();

  for (const courier of couriers) {
    for (const bracket of brackets) {
      const key = `${courier.id}|${bracket.id}`;
      for (const rate of ratesByCourierBracket.get(key) ?? []) {
        // A rate is either a country override or a zone rate; expand a zone
        // rate across its member countries so every destination gets a card.
        const codes = rate.countryCode
          ? [rate.countryCode.toUpperCase()]
          : (zoneCountries.get(rate.zoneId ?? "") ?? []);

        for (const code of codes) {
          // An override always wins, so a zone rate must never overwrite one.
          if (!rate.countryCode && overrides.has(`${code}|${key}`)) continue;

          const card =
            cards.get(code) ??
            ({
              code,
              name: countryNames.get(code) ?? code,
              courier: courier.displayName || courier.name,
              minDays: courier.minDays,
              maxDays: courier.maxDays,
              rows: [] as RateRow[],
            } satisfies CountryRates);

          const priceNaira = Math.round(rate.priceKobo / 100);
          const previous = card.rows[card.rows.length - 1];

          if (
            previous &&
            previous.priceNaira === priceNaira &&
            previous.maxGrams === bracket.minGrams
          ) {
            previous.maxGrams = bracket.maxGrams;
            previous.bracketLabel = bandLabel(previous.minGrams, bracket.maxGrams);
          } else {
            card.rows.push({
              bracketLabel: bandLabel(bracket.minGrams, bracket.maxGrams),
              minGrams: bracket.minGrams,
              maxGrams: bracket.maxGrams,
              priceNaira,
            });
          }

          cards.set(code, card);
        }
      }
    }
  }

  return [...cards.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Load and shape in one call. Never throws — an unreachable rate table
 *  yields an empty list and the UI shows its own empty state. */
export async function loadCountryRates(): Promise<CountryRates[]> {
  try {
    return buildCountryRates(await loadPricingTable());
  } catch {
    return [];
  }
}

function kg(grams: number): string {
  return String(grams / 1000).replace(/\.0$/, "");
}

function bandLabel(minGrams: number, maxGrams: number | null): string {
  if (maxGrams === null) return `Over ${kg(minGrams)} kg`;
  if (minGrams === 0) return `Up to ${kg(maxGrams)} kg`;
  return `${kg(minGrams)} – ${kg(maxGrams)} kg`;
}
