import type { Metadata } from "next";
import Link from "next/link";
import { Package, Truck } from "lucide-react";

import { loadPricingTable } from "@/infrastructure/supabase/pricing-service";
import { COUNTRIES } from "@/domain/shipping/countries";
import { RatesExplorer, type CountryRates, type RateRow } from "./RatesExplorer";

export const metadata: Metadata = {
  title: "Shipping Rates",
  description:
    "UPS delivery rates by destination and parcel weight for Fancy Finery. Estimate your shipping before you shop.",
};

/**
 * Build one card per published destination.
 *
 * Bands are merged where consecutive brackets share a price, so the table
 * reads the way the carrier quotes it — "2 – 3 kg" rather than two rows at the
 * same money. Country overrides and zone rates are both surfaced; a country
 * with its own price is shown under its own name.
 */
function buildRates(
  table: Awaited<ReturnType<typeof loadPricingTable>>,
): CountryRates[] {
  const brackets = [...table.brackets].sort((a, b) => a.minGrams - b.minGrams);
  const couriers = table.couriers.filter((c) => c.enabled);
  if (couriers.length === 0) return [];

  // Destination -> ordered rows, for the cheapest enabled courier.
  const cards = new Map<string, CountryRates>();

  for (const courier of couriers) {
    for (const bracket of brackets) {
      for (const rate of table.rates) {
        if (
          !rate.enabled ||
          rate.courierId !== courier.id ||
          rate.bracketId !== bracket.id
        ) {
          continue;
        }

        // A rate is either a country override or a zone rate; expand a zone
        // rate across its member countries so every destination has a card.
        const codes = rate.countryCode
          ? [rate.countryCode.toUpperCase()]
          : (table.zones.find((z) => z.id === rate.zoneId)?.countries ?? []);

        for (const code of codes) {
          // An override always wins, so never let a zone rate overwrite one.
          const hasOverride = table.rates.some(
            (r) =>
              r.enabled &&
              r.countryCode?.toUpperCase() === code &&
              r.courierId === courier.id &&
              r.bracketId === bracket.id,
          );
          if (!rate.countryCode && hasOverride) continue;

          const card =
            cards.get(code) ??
            ({
              code,
              name: COUNTRIES.find((c) => c.code === code)?.name ?? code,
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
            previous.bracketLabel = label(previous.minGrams, bracket.maxGrams);
          } else {
            card.rows.push({
              bracketLabel: label(bracket.minGrams, bracket.maxGrams),
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

function kg(grams: number): string {
  return String(grams / 1000).replace(/\.0$/, "");
}

function label(minGrams: number, maxGrams: number | null): string {
  if (maxGrams === null) return `Over ${kg(minGrams)} kg`;
  if (minGrams === 0) return `Up to ${kg(maxGrams)} kg`;
  return `${kg(minGrams)} – ${kg(maxGrams)} kg`;
}

export default async function ShippingRatesPage() {
  let rates: CountryRates[] = [];
  try {
    rates = buildRates(await loadPricingTable());
  } catch {
    // Rate tables unreachable — the explorer shows its own empty state.
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
      <header className="mx-auto max-w-2xl text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-yellow-600/40 px-4 py-1.5 text-[10px] uppercase tracking-[0.3em] text-yellow-500">
          <Truck className="h-3 w-3" /> Worldwide Delivery
        </p>
        <h1 className="brand-wordmark mt-7 text-3xl leading-tight tracking-[0.04em] sm:text-4xl">
          Shipping Rates
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-gray-300 sm:text-base">
          Delivery is priced by destination and parcel weight. Choose a country
          to see every band before you shop — your exact cost is confirmed at
          checkout with nothing added afterwards.
        </p>
      </header>

      <RatesExplorer
        rates={rates}
        countries={COUNTRIES.map((c) => ({ code: c.code, name: c.name }))}
      />

      <footer className="mx-auto mt-16 max-w-2xl rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
        <Package className="mx-auto h-5 w-5 text-yellow-500" />
        <p className="mt-3 text-xs leading-relaxed text-gray-400">
          Weight ranges include their upper limit — a parcel of exactly 2 kg is
          charged the “up to 2 kg” rate. Destinations not listed are quoted
          individually; for those, or for consignments above the heaviest band,
          please{" "}
          <Link href="/contact" className="text-yellow-400 underline">
            contact us
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}
