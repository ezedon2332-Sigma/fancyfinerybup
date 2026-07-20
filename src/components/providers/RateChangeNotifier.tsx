"use client";

import { useEffect, useState } from "react";
import { TrendingUp, X } from "lucide-react";

import { useCurrency } from "@/components/providers/CurrencyProvider";

const KEY = "ff.lastRate";
// Only surface the banner when the rate has moved meaningfully (≥ 3%).
const SIGNIFICANT_CHANGE = 0.03;

/**
 * Non-intrusive banner shown when the exchange rate has shifted significantly
 * since the shopper's last visit — prices update live from the rate, so this
 * just tells them the change happened.
 */
export function RateChangeNotifier() {
  const { rate } = useCurrency();
  const [movePct, setMovePct] = useState<number | null>(null);

  useEffect(() => {
    if (!rate) return;
    const prev = Number(localStorage.getItem(KEY) || "0");
    if (prev > 0 && prev !== rate) {
      const change = Math.abs(rate - prev) / prev;
      if (change >= SIGNIFICANT_CHANGE) setMovePct(Math.round(change * 100));
    }
    localStorage.setItem(KEY, String(rate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate]);

  if (movePct === null) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-yellow-600/40 bg-neutral-950/95 px-4 py-3 shadow-xl backdrop-blur">
      <div className="flex items-start gap-3">
        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
        <p className="flex-1 text-sm text-gray-200">
          Prices have been updated due to currency fluctuations (rate moved ~
          {movePct}%). You&apos;re now seeing today&apos;s exchange rate.
        </p>
        <button
          type="button"
          onClick={() => setMovePct(null)}
          aria-label="Dismiss"
          className="mt-0.5 shrink-0 text-gray-400 transition-colors hover:text-yellow-400"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
