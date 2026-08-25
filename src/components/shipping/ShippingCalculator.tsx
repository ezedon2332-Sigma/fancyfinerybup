"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, PackageCheck, Truck } from "lucide-react";

import { quoteShipping, type Quote } from "@/app/shipping/quote-actions";
import { CountrySelect, type CountryOption } from "@/components/checkout/CountrySelect";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import {
  formatMinor,
  isDisplayCurrency,
} from "@/domain/shared/display-price";
import { formatWeight } from "@/domain/shipping/pricing";
import { toast } from "@/components/ui/Toast";

const STORAGE_KEY = "ff.ship.country";

/**
 * Live shipping calculator.
 *
 * Prices a single product for a chosen destination through the same server
 * action checkout uses, so the figure quoted here is the figure charged later.
 * The destination is remembered between visits, because a shopper's country
 * does not change between page loads and re-picking it every time is friction.
 */
export function ShippingCalculator({
  productId,
  weightGrams,
  countries,
  className,
}: {
  productId: string;
  weightGrams: number;
  countries: CountryOption[];
  className?: string;
}) {
  const { currency: selected } = useCurrency();
  const [country, setCountry] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pending, startTransition] = useTransition();
  // Guards against an earlier, slower request overwriting a later one.
  const requestId = useRef(0);

  const runQuote = useCallback(
    (code: string) => {
      if (!code) {
        setQuote(null);
        return;
      }
      const id = ++requestId.current;
      startTransition(async () => {
        const res = await quoteShipping({
          countryCode: code,
          items: [{ productId, qty: 1 }],
        });
        if (id !== requestId.current) return; // a newer request has landed
        if (res.ok) {
          setQuote(res);
        } else {
          setQuote(null);
          toast.error(res.error);
        }
      });
    },
    // `selected` matters even though it is not read here: the server takes the
    // currency from the cookie, so a change to it must re-fetch the quote or
    // the panel keeps showing figures priced in the previous currency.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: an invisible input to the server call
    [productId, selected],
  );

  // Restore the last destination after mount — localStorage does not exist on
  // the server, so reading it during render would desync the markup.
  useEffect(() => {
    let saved = "";
    try {
      saved = window.localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      /* private browsing */
    }
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount hydration from an external store
      setCountry(saved);
      runQuote(saved);
    }
  }, [runQuote]);

  function onCountryChange(code: string) {
    setCountry(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
    runQuote(code);
  }

  // The server prices the quote in the shopper's currency, so these figures
  // arrive already converted — format them where they are, not from naira.
  const currency = isDisplayCurrency(quote?.currency) ? quote.currency : selected;
  const money = (v: number) => formatMinor(v, currency);

  return (
    <section
      className={`rounded-2xl border border-yellow-600/25 bg-white/[0.025] p-5 backdrop-blur-sm sm:p-6 ${className ?? ""}`}
      aria-labelledby="ship-calc-title"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id="ship-calc-title"
          className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-yellow-500"
        >
          <Truck className="h-3.5 w-3.5" /> Delivery &amp; Duties
        </h2>
        <span className="text-[11px] text-gray-500">
          {formatWeight(weightGrams)}
        </span>
      </header>

      <div className="mt-4">
        <label
          htmlFor="ship-calc-country"
          className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-gray-400"
        >
          Deliver to
        </label>
        <CountrySelect
          id="ship-calc-country"
          value={country}
          countries={countries}
          onChange={(code) => onCountryChange(code)}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {pending && (
          <motion.p
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-2 text-xs text-gray-400"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating…
          </motion.p>
        )}

        {!pending && quote && quote.unavailable && (
          <motion.p
            key="unavailable"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-xs leading-relaxed text-gray-400"
          >
            {quote.unavailable === "over-max-weight"
              ? "This parcel exceeds our published weight bands — contact us for a freight quote."
              : "We don't have a published rate for this destination yet. Contact us and we'll quote it by hand."}
          </motion.p>
        )}

        {!pending && quote && !quote.unavailable && quote.selected && (
          <motion.div
            key={`${quote.countryCode}-${quote.selected.courierId}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5"
          >
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <PackageCheck className="h-3.5 w-3.5 text-yellow-500" />
              <span className="font-medium text-white">
                {quote.selected.courierName}
              </span>
              <span className="text-gray-500">·</span>
              <span>
                {quote.selected.minDays}–{quote.selected.maxDays} business days
              </span>
            </div>

            <dl className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
              <Row label="Product Price" value={money(quote.breakdown.subtotal)} />
              <Row
                label={`Shipping Cost${quote.bracketLabel ? ` · ${quote.bracketLabel}` : ""}`}
                value={
                  quote.selected.free ? "FREE" : money(quote.breakdown.shipping)
                }
                accent={quote.selected.free}
              />
              <Row
                label={quote.breakdown.taxLabel}
                value={
                  quote.breakdown.taxRateBps === null ||
                  quote.breakdown.taxRateBps === 0
                    ? "No Tax"
                    : money(quote.breakdown.tax)
                }
                muted={
                  quote.breakdown.taxRateBps === null ||
                  quote.breakdown.taxRateBps === 0
                }
              />
              {quote.breakdown.discount > 0 && (
                <Row
                  label={`Discount${quote.breakdown.discountCode ? ` · ${quote.breakdown.discountCode}` : ""}`}
                  value={`−${money(quote.breakdown.discount)}`}
                  accent
                />
              )}
              <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
                <dt className="text-sm font-semibold text-white">
                  Final Total
                </dt>
                <dd className="text-base font-semibold tabular-nums text-yellow-400">
                  {money(quote.breakdown.total)}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
              Everything you will pay, shown before you add to bag. No duties or
              handling fees are added later.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!country && !pending && (
        <p className="mt-4 text-xs text-gray-500">
          Choose a destination to see your delivery cost and total.
        </p>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-gray-400">{label}</dt>
      <dd
        className={`shrink-0 tabular-nums ${
          accent
            ? "font-medium text-yellow-400"
            : muted
              ? "text-gray-500"
              : "text-gray-200"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
