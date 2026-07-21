"use client";

import { useRef, useState } from "react";
import { ChevronDown, Globe } from "lucide-react";

import { useCurrency, type DisplayCurrency } from "@/components/providers/CurrencyProvider";
import { useLanguage, LANGUAGES } from "@/components/providers/LanguageProvider";

const CURRENCIES: DisplayCurrency[] = ["NGN", "USD", "EUR", "GBP"];
const CURRENCY_LABEL: Record<DisplayCurrency, string> = {
  NGN: "₦ NGN",
  USD: "$ USD",
  EUR: "€ EUR",
  GBP: "£ GBP",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Dropdown({
  label,
  icon,
  children,
}: {
  label: React.ReactNode;
  icon?: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const blur = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => (blur.current = setTimeout(() => setOpen(false), 120))}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-200 transition-colors hover:text-yellow-400"
      >
        {icon}
        {label}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
      {open && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            if (blur.current) clearTimeout(blur.current);
          }}
          className="absolute right-0 z-50 mt-1 min-w-[9rem] overflow-hidden rounded-lg border border-yellow-600/30 bg-neutral-950 py-1 shadow-xl"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function CurrencyLanguageMenu() {
  const { currency, setCurrency, rates, updatedAt } = useCurrency();
  const { language, setLanguage } = useLanguage();
  const langLabel =
    LANGUAGES.find((l) => l.code === language)?.label ?? "English";

  return (
    <div className="flex items-center gap-1">
      <Dropdown label={langLabel} icon={<Globe className="h-3.5 w-3.5" />}>
        {(close) =>
          LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setLanguage(l.code);
                close();
              }}
              className={`block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-white/5 ${
                l.code === language ? "text-yellow-400" : "text-gray-200"
              }`}
            >
              {l.label}
            </button>
          ))
        }
      </Dropdown>
      <span className="text-white/15">|</span>
      <Dropdown label={currency}>
        {(close) => (
          <>
            <div className="border-b border-white/5 px-3 py-2 text-[10px] leading-tight text-gray-400">
              <div>$1 = ₦{rates.usd.toLocaleString()}</div>
              <div>€1 = ₦{rates.eur.toLocaleString()}</div>
              <div>£1 = ₦{rates.gbp.toLocaleString()}</div>
              <span className="mt-1 block text-gray-500">
                Updated {timeAgo(updatedAt)}
              </span>
            </div>
            {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCurrency(c);
                close();
              }}
              className={`block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-white/5 ${
                c === currency ? "text-yellow-400" : "text-gray-200"
              }`}
            >
              {CURRENCY_LABEL[c]}
            </button>
            ))}
          </>
        )}
      </Dropdown>
    </div>
  );
}
