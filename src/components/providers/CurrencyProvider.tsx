"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  CURRENCY_COOKIE,
  CURRENCY_META,
  DISPLAY_CURRENCIES,
  formatDisplayPrice,
  isDisplayCurrency,
  type DisplayCurrency,
} from "@/domain/shared/display-price";
import {
  DEFAULT_EXCHANGE_RATES,
  type ExchangeRates,
} from "@/domain/shared/display-price";

export {
  CURRENCY_COOKIE,
  CURRENCY_META,
  DISPLAY_CURRENCIES,
  isDisplayCurrency,
  type DisplayCurrency,
};

const STORAGE_KEY = "ff.currency";
const ONE_YEAR = 60 * 60 * 24 * 365;

interface CurrencyContextValue {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  /** Format an NGN-minor-units (kobo) amount in the selected display currency. */
  format: (ngnMinor: number) => string;
  /** The active exchange rates, for callers that need the figure not the string. */
  rates: ExchangeRates;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function persist(c: DisplayCurrency) {
  try {
    localStorage.setItem(STORAGE_KEY, c);
  } catch {
    /* private mode — the cookie below still carries the choice */
  }
  try {
    document.cookie = `${CURRENCY_COOKIE}=${c};path=/;max-age=${ONE_YEAR};samesite=lax`;
  } catch {
    /* ignore */
  }
}

/**
 * Browse-time display currency.
 *
 * Prices are stored in NGN and re-expressed under the chosen symbol by
 * `formatDisplayPrice` — no exchange rate is involved anywhere. The chosen
 * currency is also the currency the order is charged in, so what this
 * formatter prints is what the customer pays.
 *
 * `initialCurrency` comes from the cookie, read on the server, so a shopper who
 * chose USD last visit does not get a flash of naira on first paint.
 */
export function CurrencyProvider({
  initialCurrency = "NGN",
  rates = DEFAULT_EXCHANGE_RATES,
  children,
}: {
  initialCurrency?: DisplayCurrency;
  /**
   * Admin-set exchange rates, read on the server each render. Passed down
   * rather than fetched here because pricing must be identical in the
   * server-rendered HTML and after hydration — a client-side fetch would show
   * one price and then change it.
   */
  rates?: ExchangeRates;
  children: React.ReactNode;
}) {
  const [currency, setCurrencyState] =
    useState<DisplayCurrency>(initialCurrency);

  // Reconcile with localStorage after mount. The cookie normally already got us
  // here; this covers the case where it was dropped (cleared cookies, a
  // different subdomain) but the local preference survived.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (isDisplayCurrency(saved) && saved !== initialCurrency) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount hydration from an external store
      setCurrencyState(saved);
      persist(saved);
    }
  }, [initialCurrency]);

  const setCurrency = useCallback((c: DisplayCurrency) => {
    if (!isDisplayCurrency(c)) return;
    setCurrencyState(c);
    persist(c);
  }, []);

  const format = useCallback(
    (ngnMinor: number) => formatDisplayPrice(ngnMinor, currency, rates),
    [currency, rates],
  );

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, format, rates }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
