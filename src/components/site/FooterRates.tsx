"use client";

import { useCurrency } from "@/components/providers/CurrencyProvider";

/** Live exchange rates shown at the bottom of the site (in the footer). */
export function FooterRates() {
  const { rates } = useCurrency();
  const items = [
    { sym: "$", ngn: rates.usd },
    { sym: "€", ngn: rates.eur },
    { sym: "£", ngn: rates.gbp },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-white/5 px-6 py-3 text-[11px] text-gray-400">
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        <span className="font-semibold uppercase tracking-widest text-green-400">
          Live Rate
        </span>
      </span>
      {items.map((i) => (
        <span key={i.sym} className="whitespace-nowrap text-gray-300">
          {i.sym}1 ={" "}
          <span className="font-semibold text-yellow-400">
            ₦{i.ngn.toLocaleString()}
          </span>
        </span>
      ))}
    </div>
  );
}
