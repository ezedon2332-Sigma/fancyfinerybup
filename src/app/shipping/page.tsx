import type { Metadata } from "next";
import Link from "next/link";
import { Package, Truck } from "lucide-react";

import { getShippingRepository } from "@/infrastructure/supabase/shipping-service";
import { COUNTRIES, flagEmoji } from "@/domain/shipping/countries";
import { formatWeight, type RateTable } from "@/domain/shipping/engine";

export const metadata: Metadata = {
  title: "Shipping Rates",
  description:
    "UPS delivery rates by destination and parcel weight for Fancy Finery.",
};

/** One row of the published card: a weight range at a single price. */
interface Band {
  fromGrams: number;
  toGrams: number | null;
  priceNaira: number;
}

interface CountryCard {
  code: string;
  name: string;
  methodName: string;
  bands: Band[];
}

/**
 * Rebuild the published tariff from the stored ladder.
 *
 * The rate table is cut at every boundary any country uses, so a single
 * published band can span several brackets at the same price. Merging
 * consecutive equal prices back together shows the card the way the carrier
 * quotes it — "2 – 3 kg", not "2 – 2.5 kg" and "2.5 – 3 kg" at the same money.
 */
function buildCards(table: RateTable): CountryCard[] {
  const brackets = [...table.brackets].sort((a, b) => a.minGrams - b.minGrams);
  const enabledMethods = table.methods.filter((m) => m.enabled);

  const byCountry = new Map<string, Map<string, Band[]>>();

  for (const method of enabledMethods) {
    for (const bracket of brackets) {
      for (const rate of table.rates) {
        if (
          !rate.enabled ||
          !rate.countryCode ||
          rate.methodId !== method.id ||
          rate.bracketId !== bracket.id
        ) {
          continue;
        }
        const code = rate.countryCode.toUpperCase();
        const methods = byCountry.get(code) ?? new Map<string, Band[]>();
        const bands = methods.get(method.name) ?? [];

        const previous = bands[bands.length - 1];
        // Same price and directly adjacent -> extend rather than add a row.
        if (
          previous &&
          previous.priceNaira === rate.price / 100 &&
          previous.toGrams === bracket.minGrams
        ) {
          previous.toGrams = bracket.maxGrams;
        } else {
          bands.push({
            fromGrams: bracket.minGrams,
            toGrams: bracket.maxGrams,
            priceNaira: rate.price / 100,
          });
        }

        methods.set(method.name, bands);
        byCountry.set(code, methods);
      }
    }
  }

  const cards: CountryCard[] = [];
  for (const [code, methods] of byCountry) {
    for (const [methodName, bands] of methods) {
      cards.push({
        code,
        name: COUNTRIES.find((c) => c.code === code)?.name ?? code,
        methodName,
        bands,
      });
    }
  }
  return cards.sort((a, b) => a.name.localeCompare(b.name));
}

export default async function ShippingRatesPage() {
  let table: RateTable = { zones: [], methods: [], brackets: [], rates: [] };
  try {
    const repo = await getShippingRepository();
    table = await repo.getRateTable();
  } catch {
    // Engine not migrated — fall through to the empty state below.
  }

  const cards = buildCards(table);

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
          Delivery is priced by destination and parcel weight. Your exact
          shipping cost is calculated at checkout once your bag and address are
          known.
        </p>
      </header>

      {cards.length === 0 ? (
        <p className="mt-16 text-center text-sm text-gray-500">
          Shipping rates are being updated. Please check back shortly, or
          continue to <Link href="/checkout" className="text-yellow-400 underline">checkout</Link>{" "}
          for a live quote.
        </p>
      ) : (
        <div className="mt-14 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <article
              key={`${card.code}-${card.methodName}`}
              className="animate-fade-up flex flex-col rounded-2xl border border-yellow-600/25 bg-white/[0.025] p-6 backdrop-blur-sm transition-all duration-500 hover:-translate-y-0.5 hover:border-yellow-600/50 hover:shadow-[0_18px_44px_-24px_rgba(212,175,55,0.6)]"
            >
              <header className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                <h2 className="font-display text-xl font-semibold text-white">
                  <span aria-hidden className="mr-2">
                    {flagEmoji(card.code)}
                  </span>
                  {card.name}
                </h2>
                <span className="shrink-0 rounded-full border border-yellow-600/40 px-2.5 py-1 text-[9px] uppercase tracking-[0.2em] text-yellow-500">
                  {card.methodName}
                </span>
              </header>

              {/* The ladder runs to 50 kg in half-kilo steps, so the body
                  scrolls inside the card rather than making the page enormous.
                  Two columns only — never a horizontal scroll on a phone. */}
              <div className="mt-4 max-h-[22rem] overflow-y-auto pr-1">
              <table className="w-full text-left">
                <caption className="sr-only">
                  {card.methodName} shipping rates to {card.name} by parcel weight
                </caption>
                <thead className="sticky top-0 bg-[#0d0d0d]">
                  <tr className="border-b border-white/10">
                    <th
                      scope="col"
                      className="pb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500"
                    >
                      Weight
                    </th>
                    <th
                      scope="col"
                      className="pb-2 text-right text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500"
                    >
                      Shipping Cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {card.bands.map((b) => {
                    const openEnded = b.toGrams == null;
                    return (
                      <tr
                        key={`${b.fromGrams}-${b.toGrams}`}
                        className={
                          openEnded
                            ? "border-t border-yellow-600/30"
                            : "border-t border-white/[0.06]"
                        }
                      >
                        <th
                          scope="row"
                          className={`py-1.5 pr-3 text-sm font-normal ${
                            openEnded ? "text-yellow-200" : "text-gray-400"
                          }`}
                        >
                          {b.fromGrams === 0
                            ? `Up to ${formatWeight(b.toGrams ?? 0)}`
                            : openEnded
                              ? `${formatWeight(b.fromGrams)} +`
                              : `${formatWeight(b.fromGrams)} – ${formatWeight(b.toGrams as number)}`}
                        </th>
                        <td
                          className={`py-1.5 text-right text-sm font-semibold tabular-nums ${
                            openEnded ? "text-yellow-300" : "text-yellow-400"
                          }`}
                        >
                          ₦{b.priceNaira.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </article>
          ))}
        </div>
      )}

      <footer className="mx-auto mt-16 max-w-2xl rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
        <Package className="mx-auto h-5 w-5 text-yellow-500" />
        <p className="mt-3 text-xs leading-relaxed text-gray-400">
          Weight ranges are inclusive of their upper limit — a parcel weighing
          exactly 2 kg is charged the “up to 2 kg” rate. Destinations not listed
          are quoted individually at checkout. For unusually large consignments,
          please{" "}
          <Link href="/contact" className="text-yellow-400 underline">
            contact us
          </Link>{" "}
          for a bespoke quote.
        </p>
      </footer>
    </div>
  );
}
