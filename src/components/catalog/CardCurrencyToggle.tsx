"use client";

import {
  useCurrency,
  CURRENCY_META,
  DISPLAY_CURRENCIES,
} from "@/components/providers/CurrencyProvider";

/**
 * Per-card currency control.
 *
 * The selector used to sit alone in the middle of the header, far from any
 * price. It lives beside the figure it changes now, so the control and its
 * effect are in the same glance.
 *
 * The choice is still GLOBAL — `useCurrency` is one provider for the whole app,
 * persisted like any other display preference — so switching on one card
 * re-prices every card, the product page and checkout together. Anything else
 * would let a customer see one currency on the grid and be charged in another,
 * which is precisely the confusion the single provider exists to prevent.
 *
 * Rendered as a plain <select>: it is inside a card that is itself a link, and
 * a custom popover would fight the card's own click target. A native control
 * also gets keyboard and screen-reader behaviour for free.
 */
export function CardCurrencyToggle({ className = "" }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();

  return (
    <select
      aria-label="Display currency"
      value={currency}
      // The card wraps a Link; without this the browser follows it on click.
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onChange={(e) => setCurrency(e.target.value as typeof currency)}
      className={`cursor-pointer appearance-none rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-gray-400 outline-none transition-colors hover:border-yellow-600/50 hover:text-yellow-400 focus-visible:border-yellow-500 ${className}`}
    >
      {DISPLAY_CURRENCIES.map((c) => (
        <option key={c} value={c} className="bg-neutral-950 text-gray-200">
          {CURRENCY_META[c].symbol} {c}
        </option>
      ))}
    </select>
  );
}
