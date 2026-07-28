"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  CalendarDays,
  Globe2,
  Lock,
  MapPin,
  ShieldCheck,
  Truck,
  Weight,
} from "lucide-react";

import type { Quote } from "@/app/shipping/quote-actions";
import {
  CURRENCY_META,
  formatMinor,
  isDisplayCurrency,
} from "@/domain/shared/display-price";

/**
 * Add business days to today, skipping weekends.
 *
 * Deliberately client-only: it reads the clock, and the quote it depends on
 * arrives asynchronously, so there is no server render of this value to
 * disagree with. Public holidays are not modelled — the label says
 * "estimated", and a courier's own calendar is the authority once a
 * consignment is booked.
 */
function addBusinessDays(days: number): Date {
  const d = new Date();
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d;
}

function fmt(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

/** "August 4 – August 6", or a single date when the window is one day. */
export function arrivalWindow(minDays: number, maxDays: number): string {
  const from = addBusinessDays(Math.max(minDays, 1));
  const to = addBusinessDays(Math.max(maxDays, minDays, 1));
  const a = fmt(from);
  const b = fmt(to);
  return a === b ? a : `${a} – ${b}`;
}

/**
 * Live summary of where the parcel is going, what it weighs, and when it
 * should land. Everything here comes from the same quote that prices the
 * order, so it cannot drift from what is charged.
 */
export function ShippingSummary({
  quote,
  loading,
  countryName,
}: {
  quote: Quote | null;
  loading: boolean;
  countryName: string;
}) {
  if (loading && !quote) return <SummarySkeleton />;
  if (!quote) return null;

  const option = quote.selected;
  // Symbols come from the currency table rather than a naira-or-dollar
  // ternary, which silently printed "$" for euro, sterling and yuan orders.
  const money = (v: number) =>
    formatMinor(v, isDisplayCurrency(quote.currency) ? quote.currency : "NGN");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-yellow-600/30 bg-white/[0.025] p-5 backdrop-blur-sm"
    >
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Destination">
          {countryName || quote.countryCode}
        </Row>
        {quote.zoneName && (
          <Row icon={<Globe2 className="h-3.5 w-3.5" />} label="Shipping zone">
            {quote.zoneName}
          </Row>
        )}
        <Row icon={<Weight className="h-3.5 w-3.5" />} label="Weight">
          {quote.weightLabel}
          {quote.bracketLabel && (
            <span className="ml-1.5 text-[11px] text-gray-500">
              ({quote.bracketLabel})
            </span>
          )}
        </Row>
        <Row icon={<Truck className="h-3.5 w-3.5" />} label="Shipping fee">
          {option
            ? option.free
              ? "Complimentary"
              : money(quote.breakdown.shipping)
            : "—"}
        </Row>
      </dl>

      {option && (
        <div className="mt-4 flex items-start gap-3 border-t border-white/10 pt-4">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
              Estimated arrival
            </p>
            <p className="mt-1 text-sm font-medium text-white">
              {arrivalWindow(option.minDays, option.maxDays)}
            </p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              {option.courierName} ·{" "}
              {option.minDays === option.maxDays
                ? `${option.maxDays} business days`
                : `${option.minDays}–${option.maxDays} business days`}
            </p>
          </div>
        </div>
      )}

      {quote.unavailable && (
        <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {quote.unavailable === "over-max-weight"
            ? "This order is heavier than our published bands. Contact us for a freight quote."
            : "No published rate for this destination yet — we will confirm your shipping cost by email."}
        </p>
      )}
    </motion.div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-yellow-600">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[10px] uppercase tracking-[0.18em] text-gray-500">
          {label}
        </dt>
        <dd className="mt-0.5 truncate text-sm text-gray-100">{children}</dd>
      </div>
    </div>
  );
}

/** Skeleton rather than a spinner — the block keeps its height, so nothing
 *  below it jumps when the quote lands. */
function SummarySkeleton() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-2 w-16 animate-pulse rounded bg-white/10" />
            <div className="h-3.5 w-28 animate-pulse rounded bg-white/[0.07]" />
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
        <div className="h-2 w-24 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-40 animate-pulse rounded bg-white/[0.07]" />
      </div>
    </div>
  );
}

/** Reassurance next to the pay button. Static copy — nothing here claims a
 *  certification the store does not hold. */
export function TrustBadges() {
  const items = [
    { icon: Lock, label: "SSL secured" },
    { icon: ShieldCheck, label: "Secure payment" },
    { icon: BadgeCheck, label: "30-day returns" },
    { icon: Globe2, label: "Worldwide shipping" },
  ];
  return (
    <ul className="mt-4 grid grid-cols-2 gap-2">
      {items.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2 text-[10px] text-gray-400"
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-yellow-600" />
          {label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Free-shipping progress. Only rendered when a threshold is actually in
 * reach, so it never nags a customer with a target they cannot hit.
 */
export function FreeShippingProgress({
  subtotal,
  threshold,
  currency,
  qualified,
}: {
  subtotal: number;
  threshold: number;
  currency: string;
  qualified: boolean;
}) {
  const pct = Math.min(100, (subtotal / threshold) * 100);
  const remaining = Math.max(0, threshold - subtotal);
  const code = isDisplayCurrency(currency) ? currency : "NGN";
  const sym = CURRENCY_META[code].symbol;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={qualified ? "yes" : "no"}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-lg border border-yellow-600/30 bg-yellow-500/[0.06] px-4 py-3"
      >
        <p className="text-xs text-yellow-100">
          {qualified ? (
            <>🎉 You qualify for complimentary shipping.</>
          ) : (
            <>
              Spend{" "}
              <strong className="font-semibold text-yellow-300">
                {sym}
                {(remaining / 100).toLocaleString()}
              </strong>{" "}
              more for complimentary shipping.
            </>
          )}
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400"
            initial={false}
            animate={{ width: `${qualified ? 100 : pct}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
