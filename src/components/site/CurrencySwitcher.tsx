"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

import {
  useCurrency,
  CURRENCY_META,
  DISPLAY_CURRENCIES,
} from "@/components/providers/CurrencyProvider";

/**
 * Header currency selector.
 *
 * Switching re-writes prices site-wide under the chosen symbol, and that same
 * choice decides what the order is charged in — so the figure on a price tag
 * is the figure at checkout. No conversion and no exchange rate are involved.
 */
export function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent | MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Currency: ${currency}. Change display currency`}
        className="flex min-h-[44px] items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-gray-100 transition-colors hover:border-yellow-500/60 hover:text-yellow-400 lg:min-h-[36px] lg:px-2.5"
      >
        <span aria-hidden>{CURRENCY_META[currency].symbol}</span>
        <span className="hidden sm:inline">{currency}</span>
        <ChevronDown
          aria-hidden
          className={`h-3 w-3 opacity-70 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
        <motion.div
          role="listbox"
          aria-label="Display currency"
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          /* Centred on the trigger, which now sits mid-header: anchoring to
             right-0 put a 240px panel off the left edge of a 320px screen.
             origin-top keeps the scale-in growing downward from the button. */
          className="absolute left-1/2 z-50 mt-2 w-[15rem] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 origin-top overflow-hidden rounded-xl border border-yellow-600/30 bg-neutral-950 shadow-2xl shadow-black/60"
        >
          <p className="border-b border-white/8 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-yellow-500/80">
            Display currency
          </p>

          <ul className="py-1">
            {DISPLAY_CURRENCIES.map((c) => {
              const meta = CURRENCY_META[c];
              const selected = c === currency;
              return (
                <li key={c}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setCurrency(c);
                      setOpen(false);
                    }}
                    className={`flex min-h-[44px] w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-white/5 ${
                      selected ? "bg-white/5 text-yellow-400" : "text-gray-200"
                    }`}
                  >
                    <span aria-hidden className="text-sm leading-none">
                      {meta.flag}
                    </span>
                    <span aria-hidden className="w-3 text-center font-semibold">
                      {meta.symbol}
                    </span>
                    <span className="font-semibold tracking-wide">{c}</span>
                    <span className="truncate text-[11px] text-gray-500">
                      {meta.name}
                    </span>
                    {selected && (
                      <Check aria-hidden className="ml-auto h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="border-t border-white/8 px-3 py-2 text-[10px] leading-relaxed text-gray-500">
            Prices show and are charged in your chosen currency.
          </p>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
