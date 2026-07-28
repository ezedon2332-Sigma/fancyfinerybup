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
  /** True when the shopper is viewing an indicative, non-charging currency. */
  isIndicative: boolean;
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
 * Prices are stored and charged in NGN. Choosing another currency re-writes the
 * same price under a different symbol (see `formatDisplayPrice`) — it does not
 * convert, and there is no exchange rate involved anywhere in this provider.
 *
 * `initialCurrency` comes from the cookie, read on the server, so a shopper who
 * chose USD last visit does not get a flash of naira on first paint.
 */
export function CurrencyProvider({
  initialCurrency = "NGN",
  children,
}: {
  initialCurrency?: DisplayCurrency;
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
    (ngnMinor: number) => formatDisplayPrice(ngnMinor, currency),
    [currency],
  );

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, format, isIndicative: currency !== "NGN" }}
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
