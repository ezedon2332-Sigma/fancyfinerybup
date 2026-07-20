"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { formatMoney } from "@/domain/shared/money";

export type DisplayCurrency = "NGN" | "USD";

interface CurrencyContextValue {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  /** NGN per 1 USD. */
  rate: number;
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
  updatedAt = null,
  children,
}: {
  rate: number;
  updatedAt?: string | null;
  children: React.ReactNode;
}) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>("NGN");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "USD" || saved === "NGN") setCurrencyState(saved);
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
      if (currency === "USD") {
        const r = rate > 0 ? rate : 1600;
        return formatMoney(Math.round(ngnMinor / r), "USD");
      }
      return formatMoney(ngnMinor, "NGN");
    },
    [currency, rate],
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rate, updatedAt, format }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
