"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  useCurrency,
  DISPLAY_CURRENCIES,
  type DisplayCurrency,
} from "@/components/providers/CurrencyProvider";

const LABEL: Record<DisplayCurrency, string> = {
  NGN: "₦ NGN — Nigerian Naira",
  USD: "$ USD — US Dollar",
  EUR: "€ EUR — Euro",
  GBP: "£ GBP — British Pound",
};
const SYMBOL: Record<DisplayCurrency, string> = {
  NGN: "₦",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 60000) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Prominent, always-visible currency selector for the header. Robust
 *  outside-click/Escape close; switching converts prices site-wide. */
export function CurrencySwitcher() {
  const { currency, setCurrency, rates, updatedAt } = useCurrency();
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
        aria-label="Select currency"
        className="flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-gray-100 transition-colors hover:border-yellow-500/60 hover:text-yellow-400"
      >
        <span>{SYMBOL[currency]}</span>
        <span className="hidden sm:inline">{currency}</span>
        <ChevronDown
          className={`h-3 w-3 opacity-70 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-2 min-w-[13rem] overflow-hidden rounded-lg border border-yellow-600/30 bg-neutral-950 shadow-xl"
        >
          <div className="border-b border-white/5 px-3 py-2 text-[10px] leading-tight text-gray-400">
            <span className="flex items-center gap-1.5 font-semibold uppercase tracking-widest text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Live rates
            </span>
            <div className="mt-1 text-gray-400">
              $1 = ₦{rates.usd.toLocaleString()} · €1 = ₦
              {rates.eur.toLocaleString()} · £1 = ₦{rates.gbp.toLocaleString()}
            </div>
            <span className="mt-0.5 block text-gray-500">
              Updated {timeAgo(updatedAt)}
            </span>
          </div>
          {DISPLAY_CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              role="option"
              aria-selected={c === currency}
              onClick={() => {
                setCurrency(c);
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-xs transition-colors hover:bg-white/5 ${
                c === currency ? "bg-white/5 text-yellow-400" : "text-gray-200"
              }`}
            >
              {LABEL[c]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
