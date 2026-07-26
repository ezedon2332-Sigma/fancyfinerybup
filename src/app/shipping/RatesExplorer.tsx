"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PackageSearch, Truck } from "lucide-react";

import { CountrySelect, type CountryOption } from "@/components/checkout/CountrySelect";

export interface RateRow {
  bracketLabel: string;
  minGrams: number;
  maxGrams: number | null;
  priceNaira: number;
}

export interface CountryRates {
  code: string;
  name: string;
  courier: string;
  minDays: number;
  maxDays: number;
  rows: RateRow[];
}

/**
 * Rate explorer. Every published destination is sent down once, so switching
 * country is instant with no round trip — the whole card is a few kilobytes
 * and a shopper comparing two destinations shouldn't wait for either.
 */
export function RatesExplorer({
  rates,
  countries,
}: {
  rates: CountryRates[];
  countries: CountryOption[];
}) {
  const byCode = useMemo(
    () => new Map(rates.map((r) => [r.code, r])),
    [rates],
  );
  const [code, setCode] = useState(rates[0]?.code ?? "");
  const selected = byCode.get(code) ?? null;

  // Only destinations we actually publish a rate for are offered; picking a
  // country then being told "nothing here" is a worse experience than not
  // being able to pick it.
  const options = useMemo(
    () => countries.filter((c) => byCode.has(c.code)),
    [countries, byCode],
  );

  return (
    <div className="mt-12">
      <div className="mx-auto max-w-md">
        <label
          htmlFor="rates-country"
          className="mb-2 block text-center text-[10px] uppercase tracking-[0.24em] text-gray-400"
        >
          Choose a destination
        </label>
        <CountrySelect
          id="rates-country"
          value={code}
          countries={options}
          onChange={(c) => setCode(c)}
        />
      </div>

      <AnimatePresence mode="wait">
        {selected && (
          <motion.section
            key={selected.code}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-2xl border border-yellow-600/25 bg-white/[0.025] backdrop-blur-sm"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-5">
              <h2 className="font-display text-2xl text-white">
                {selected.name}
              </h2>
              <span className="inline-flex items-center gap-2 rounded-full border border-yellow-600/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-yellow-500">
                <Truck className="h-3 w-3" />
                {selected.courier} · {selected.minDays}–{selected.maxDays} days
              </span>
            </header>

            <table className="w-full text-left">
              <caption className="sr-only">
                {selected.courier} rates to {selected.name} by parcel weight
              </caption>
              <thead>
                <tr className="border-b border-white/10">
                  <th
                    scope="col"
                    className="px-6 py-3 text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500"
                  >
                    Weight
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500"
                  >
                    Shipping Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {selected.rows.map((r) => (
                  <tr
                    key={`${r.minGrams}-${r.maxGrams}`}
                    className="border-t border-white/[0.06] transition-colors hover:bg-white/[0.02]"
                  >
                    <th
                      scope="row"
                      className="px-6 py-2.5 text-sm font-normal text-gray-400"
                    >
                      {r.bracketLabel}
                    </th>
                    <td className="px-6 py-2.5 text-right text-sm font-semibold tabular-nums text-yellow-400">
                      ₦{r.priceNaira.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.section>
        )}

        {!selected && (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-12 flex flex-col items-center gap-3 text-center text-sm text-gray-500"
          >
            <PackageSearch className="h-5 w-5 text-yellow-600" />
            Published rates are being updated. Your exact cost is always shown
            at checkout.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
