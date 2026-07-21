"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { formatMoney } from "@/domain/shared/money";

export type DisplayCurrency = "NGN" | "USD" | "EUR" | "GBP";

export const DISPLAY_CURRENCIES: DisplayCurrency[] = ["NGN", "USD", "EUR", "GBP"];

export interface DisplayRates {
  usd: number;
  eur: number;
  gbp: number;
}

interface CurrencyContextValue {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  /** NGN per 1 USD. */
  rate: number;
  /** NGN per 1 USD / EUR / GBP — for the informational live-rate ticker. */
  rates: DisplayRates;
  /** ISO timestamp the rate was last refreshed (for the selector). */
  updatedAt: string | null;
  /** Format an NGN-minor-units (kobo) amount in the selected display currency. */
  format: (ngnMinor: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);
const STORAGE_KEY = "ff.currency";

/**
 * Browse-time display currency. Product prices are stored in NGN; this lets a
 * shopper preview them in USD. It is display-only — the authoritative charge
 * currency at checkout is still decided by the shipping destination.
 */
export function CurrencyProvider({
  rate,
  rates,
  updatedAt = null,
  children,
}: {
  rate: number;
  rates?: DisplayRates;
  updatedAt?: string | null;
  children: React.ReactNode;
}) {
  const displayRates: DisplayRates = rates ?? {
    usd: rate,
    eur: rate,
    gbp: rate,
  };
  const [currency, setCurrencyState] = useState<DisplayCurrency>("NGN");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (DISPLAY_CURRENCIES as string[]).includes(saved)) {
      setCurrencyState(saved as DisplayCurrency);
    }
  }, []);

  const setCurrency = useCallback((c: DisplayCurrency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* ignore */
    }
  }, []);

  const format = useCallback(
    (ngnMinor: number) => {
      if (currency === "NGN") return formatMoney(ngnMinor, "NGN");
      const perUnit =
        currency === "EUR"
          ? displayRates.eur
          : currency === "GBP"
            ? displayRates.gbp
            : displayRates.usd;
      const r = perUnit > 0 ? perUnit : rate > 0 ? rate : 1600;
      return formatMoney(Math.round(ngnMinor / r), currency);
    },
    [currency, rate, displayRates],
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rate, rates: displayRates, updatedAt, format }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
