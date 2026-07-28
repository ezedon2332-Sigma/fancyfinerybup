"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Tag, Truck, X } from "lucide-react";
import { useState } from "react";

import { useCurrency } from "@/components/providers/CurrencyProvider";
import {
  formatDisplayPrice,
  formatMinor,
  isDisplayCurrency,
  priceInMinor,
} from "@/domain/shared/display-price";
import { formatWeight } from "@/domain/shipping/pricing";
import type { Quote } from "@/app/shipping/quote-actions";
import type { CartItem } from "@/components/cart/CartProvider";

/**
 * The order summary, shared by the bag and checkout.
 *
 * Renders whatever the server quoted and computes nothing itself — that is the
 * point. The tax percentage shown comes from the quote's `taxRateBps`, so
 * changing the rate in Supabase changes this label with no redeploy and no
 * hardcoded number anywhere in the client.
 */
export function OrderSummary({
  items,
  quote,
  loading,
  couponInput,
  onCouponChange,
  onApplyCoupon,
  onClearCoupon,
  couponPending,
}: {
  items: CartItem[];
  quote: Quote | null;
  loading: boolean;
  couponInput: string;
  onCouponChange: (v: string) => void;
  onApplyCoupon: () => void;
  onClearCoupon: () => void;
  couponPending: boolean;
}) {
  const [showCoupon, setShowCoupon] = useState(false);

  const { currency: selected } = useCurrency();

  // Format quote figures in the currency the *quote* was priced in, not the
  // one currently selected. A shopper can switch mid-checkout; the re-quote is
  // in flight for a moment, and relabelling ₦300,000 as "$300,000" for that
  // moment would be worse than briefly showing the old currency.
  const currency = isDisplayCurrency(quote?.currency) ? quote.currency : selected;

  // Those figures are already in that currency's minor units — the server
  // priced them there. Passing them through the provider's own formatter
  // would apply the rule a second time and divide the total by another
  // thousand.
  const money = (v: number) => formatMinor(v, currency);

  // Cart lines, unlike quote lines, are still naira kobo straight from the
  // catalogue, so they need converting first.
  const itemMoney = (ngnKobo: number) => formatDisplayPrice(ngnKobo, currency);

  // Convert the unit price, then multiply — the order in which the server
  // does it. Multiplying first and converting the product would truncate a
  // different way and print a line total that disagrees with the subtotal.
  const lineMoney = (ngnKobo: number, qty: number) =>
    formatMinor(priceInMinor(ngnKobo, currency) * qty, currency);

  // Fall back to the raw cart subtotal until the first quote lands, so the
  // panel is never blank. Cart lines are stored in naira, so this one does
  // need converting.
  const subtotal =
    quote?.breakdown.subtotal ??
    priceInMinor(
      items.reduce((s, i) => s + i.price * i.qty, 0),
      selected,
    );

  const taxApplies =
    quote != null &&
    quote.breakdown.taxRateBps != null &&
    quote.breakdown.taxRateBps > 0;

  const taxLabel = taxApplies
    ? `${quote.breakdown.taxLabel} (${formatBps(quote.breakdown.taxRateBps!)})`
    : (quote?.breakdown.taxLabel ?? "Tax");

  return (
    <div className="h-fit rounded-2xl border border-yellow-600/25 bg-neutral-950/60 p-6 backdrop-blur-sm">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-200">
        Order Summary
      </h2>

      <ul className="mt-5 space-y-3">
        {items.map((i) => (
          <li key={`${i.productId}-${i.variantId}`} className="flex items-center gap-3">
            <div className="relative h-16 w-13 shrink-0 overflow-hidden rounded bg-neutral-900">
              {i.image && (
                <Image src={i.image} alt="" fill sizes="52px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="line-clamp-1 text-gray-100">{i.name}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Qty {i.qty}
                {i.weightGrams != null &&
                  i.weightGrams > 0 &&
                  ` · ${formatWeight(i.weightGrams)} each`}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {itemMoney(i.price)} each
              </p>
            </div>
            <p className="shrink-0 text-sm tabular-nums text-yellow-400">
              {lineMoney(i.price, i.qty)}
            </p>
          </li>
        ))}
      </ul>

      {/* Coupon */}
      <div className="mt-5 border-t border-white/10 pt-4">
        {quote?.coupon.applied ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-green-500/40 bg-green-500/5 px-3 py-2.5">
            <span className="flex items-center gap-2 text-xs text-green-300">
              <Check className="h-3.5 w-3.5" />
              <span className="font-medium">{quote.coupon.code}</span> applied
            </span>
            <button
              type="button"
              onClick={onClearCoupon}
              aria-label="Remove coupon"
              className="rounded p-1 text-gray-400 transition-colors hover:text-red-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : showCoupon ? (
          <div>
            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => onCouponChange(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onApplyCoupon();
                  }
                }}
                placeholder="Promotion code"
                aria-label="Promotion code"
                className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-sm uppercase tracking-wider text-white outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-600 focus:border-yellow-500/70"
              />
              <button
                type="button"
                onClick={onApplyCoupon}
                disabled={couponPending || !couponInput.trim()}
                className="shrink-0 rounded-lg border border-yellow-600/50 px-4 text-xs font-semibold uppercase tracking-wider text-yellow-400 transition-colors hover:bg-yellow-500/10 disabled:opacity-40"
              >
                {couponPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
              </button>
            </div>
            {quote?.coupon.message && (
              <p className="mt-2 text-[11px] text-red-400">{quote.coupon.message}</p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCoupon(true)}
            className="inline-flex items-center gap-2 text-xs text-gray-400 transition-colors hover:text-yellow-400"
          >
            <Tag className="h-3.5 w-3.5" /> Have a promotion code?
          </button>
        )}
      </div>

      {/* Breakdown */}
      <dl className="mt-5 space-y-2.5 border-t border-white/10 pt-4 text-sm">
        <Line label="Product subtotal" value={money(subtotal)} />

        <Line
          label="Shipping fee"
          value={
            !quote
              ? "—"
              : quote.unavailable
                ? "Unavailable"
                : quote.selected?.free
                  ? "FREE"
                  : money(quote.breakdown.shipping)
          }
          accent={quote?.selected?.free}
        />

        {/* Always present, never hidden: a missing tax line reads as a hidden
            charge even when the charge is zero. */}
        <Line
          label={taxLabel}
          value={
            !quote ? "—" : taxApplies ? money(quote.breakdown.tax) : "No Tax"
          }
          muted={!taxApplies}
        />

        <AnimatePresence initial={false}>
          {quote && quote.breakdown.discount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Line
                label={`Discount${quote.breakdown.discountCode ? ` · ${quote.breakdown.discountCode}` : ""}`}
                value={`−${money(quote.breakdown.discount)}`}
                accent
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
          <dt className="text-base font-semibold text-white">Grand total</dt>
          <dd className="flex items-center gap-2 text-base font-semibold tabular-nums text-yellow-400">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />}
            {quote ? money(quote.breakdown.total) : money(subtotal)}
          </dd>
        </div>
      </dl>

      {quote && !quote.unavailable && quote.selected && (
        <div className="mt-4 space-y-1.5 border-t border-white/10 pt-4 text-[11px] text-gray-500">
          <p className="flex items-center gap-1.5">
            <Truck className="h-3 w-3 text-yellow-600" />
            {quote.selected.courierName} · {quote.selected.minDays}–
            {quote.selected.maxDays} business days
          </p>
          <p>
            Total package weight {quote.weightLabel}
            {quote.bracketLabel ? ` · ${quote.bracketLabel}` : ""}
          </p>
          <p className="text-gray-400">
            You will be charged{" "}
            <strong className="font-semibold text-gray-200">
              {money(quote.breakdown.total)}
            </strong>{" "}
            in {currency}.
          </p>
        </div>
      )}

      {quote?.unavailable && (
        <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-[11px] leading-relaxed text-amber-200">
          {quote.unavailable === "over-max-weight"
            ? "This order exceeds our published weight bands. Contact us for a freight quote."
            : "We don't have a published rate for this destination yet. Contact us and we'll quote it by hand."}
        </p>
      )}
    </div>
  );
}

/** 750 -> "7.5%", 1000 -> "10%", 2550 -> "25.5%" */
export function formatBps(bps: number): string {
  return `${parseFloat((bps / 100).toFixed(2))}%`;
}

function Line({
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
          accent ? "font-medium text-yellow-400" : muted ? "text-gray-500" : "text-gray-200"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
