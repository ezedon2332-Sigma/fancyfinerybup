"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, PackageSearch, Search, Truck } from "lucide-react";

import { flagEmoji } from "@/domain/shipping/countries";
import { useCurrency } from "@/components/providers/CurrencyProvider";

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
 * Browse published rates by destination.
 *
 * Every country ships down once — the whole set is a few kilobytes — so
 * searching and expanding are instant with no round trip. A shopper comparing
 * two destinations should never wait for either.
 *
 * `highlight` marks the country already chosen at checkout; it sorts to the
 * top and opens by default, so the section answers "what am I paying?" before
 * it answers "what would I pay elsewhere?".
 */
export function RatesBrowser({
  rates,
  highlight = null,
  compact = false,
}: {
  rates: CountryRates[];
  highlight?: string | null;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(highlight);

  // Published rates follow the same rule as everything else, so the figure in
  // this table is the shipping fee the shopper is actually quoted rather than
  // a naira number they then have to reconcile at checkout. Rows carry major
  // units, hence the ×100 into the kobo the formatter expects.
  const { format } = useCurrency();
  const rate = (priceNaira: number) => format(priceNaira * 100);

  const ordered = useMemo(() => {
    const list = [...rates].sort((a, b) => a.name.localeCompare(b.name));
    if (!highlight) return list;
    const i = list.findIndex((r) => r.code === highlight);
    if (i < 0) return list;
    return [list[i], ...list.slice(0, i), ...list.slice(i + 1)];
  }, [rates, highlight]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase() === q,
    );
  }, [ordered, query]);

  if (rates.length === 0) {
    return (
      <p className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-gray-500">
        <PackageSearch className="h-5 w-5 text-yellow-600" />
        Published rates are being updated. Your exact cost is always shown at
        checkout.
      </p>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search destination…"
          aria-label="Search shipping destinations"
          className="w-full rounded-full border border-white/12 bg-white/[0.03] py-3 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-yellow-500/70 focus:bg-white/[0.05]"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-center text-sm text-gray-500">
          No destination matches “{query.trim()}”. We may still ship there —
          your rate is confirmed at checkout.
        </p>
      ) : (
        <ul className={`mt-4 space-y-2.5 ${compact ? "max-h-[26rem] overflow-y-auto pr-1" : ""}`}>
          {filtered.map((c) => {
            const expanded = open === c.code;
            const isCurrent = highlight === c.code;
            return (
              <li
                key={c.code}
                className={`overflow-hidden rounded-xl border backdrop-blur-sm transition-colors duration-300 ${
                  expanded
                    ? "border-yellow-600/50 bg-white/[0.045]"
                    : "border-white/10 bg-white/[0.02] hover:border-yellow-600/35"
                }`}
              >
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : c.code)}
                    aria-expanded={expanded}
                    aria-controls={`rates-${c.code}`}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-yellow-500/70 sm:px-5"
                  >
                    <span aria-hidden className="text-lg leading-none">
                      {flagEmoji(c.code)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-display text-base text-white sm:text-lg">
                          {c.name}
                        </span>
                        {isCurrent && (
                          <span className="rounded-full border border-yellow-500/50 bg-yellow-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-yellow-300">
                            Your destination
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500">
                        <Truck className="h-3 w-3 text-yellow-600" />
                        {c.courier} · {c.minDays}–{c.maxDays} days
                      </span>
                    </span>

                    <span className="shrink-0 text-right">
                      <span className="block text-[10px] uppercase tracking-[0.14em] text-gray-500">
                        from
                      </span>
                      <span className="block text-sm font-semibold tabular-nums text-yellow-400">
                        {rate(Math.min(...c.rows.map((r) => r.priceNaira)))}
                      </span>
                    </span>

                    <ChevronDown
                      aria-hidden
                      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 ${
                        expanded ? "rotate-180 text-yellow-400" : ""
                      }`}
                    />
                  </button>
                </h3>

                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      id={`rates-${c.code}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <table className="w-full text-left">
                        <caption className="sr-only">
                          {c.courier} rates to {c.name} by parcel weight
                        </caption>
                        <thead>
                          <tr className="border-t border-white/10">
                            <th
                              scope="col"
                              className="px-4 py-2 text-[9px] font-medium uppercase tracking-[0.18em] text-gray-500 sm:px-5"
                            >
                              Weight band
                            </th>
                            <th
                              scope="col"
                              className="px-4 py-2 text-right text-[9px] font-medium uppercase tracking-[0.18em] text-gray-500 sm:px-5"
                            >
                              Shipping price
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.rows.map((r) => (
                            <tr
                              key={`${r.minGrams}-${r.maxGrams}`}
                              className="border-t border-white/[0.05] transition-colors hover:bg-white/[0.03]"
                            >
                              <th
                                scope="row"
                                className="px-4 py-2 text-[13px] font-normal text-gray-400 sm:px-5"
                              >
                                {r.bracketLabel}
                              </th>
                              <td className="px-4 py-2 text-right text-[13px] font-semibold tabular-nums text-yellow-400 sm:px-5">
                                {rate(r.priceNaira)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
