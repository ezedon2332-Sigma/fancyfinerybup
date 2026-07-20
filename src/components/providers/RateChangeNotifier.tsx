"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { useCurrency } from "@/components/providers/CurrencyProvider";
import { useCart } from "@/components/cart/CartProvider";

const KEY = "ff.lastRate";

/**
 * Shows a one-time notice when the exchange rate has changed since the shopper's
 * last visit AND they have items in their cart — the totals are already
 * recalculated live (prices derive from the rate), this just tells them.
 */
export function RateChangeNotifier() {
  const { rate } = useCurrency();
  const { count } = useCart();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!rate) return;
    const prev = Number(localStorage.getItem(KEY) || "0");
    if (prev && prev !== rate && count > 0) setShow(true);
    localStorage.setItem(KEY, String(rate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate]);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-yellow-600/40 bg-neutral-950/95 px-4 py-3 shadow-xl backdrop-blur">
      <div className="flex items-start gap-3">
        <p className="flex-1 text-sm text-gray-200">
          Exchange rate updated. Your order total has been recalculated using
          today&apos;s rate.
        </p>
        <button
          type="button"
          onClick={() => setShow(false)}
          aria-label="Dismiss"
          className="mt-0.5 shrink-0 text-gray-400 transition-colors hover:text-yellow-400"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
