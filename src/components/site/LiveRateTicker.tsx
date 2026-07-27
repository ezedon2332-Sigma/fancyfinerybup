"use client";

import {
  useCurrency,
  type DisplayCurrency,
} from "@/components/providers/CurrencyProvider";

function timeAgo(iso: string | null): string {
  if (!iso) return "just now";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 60000) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Live exchange rates, in two presentations.
 *
 *   "bar"  — the original full-width strip.
 *   "card" — a compact glass panel that sits beneath the brand lockup.
 *
 * Both render the same buttons off the same `useCurrency` hook, so switching
 * presentation cannot change behaviour: clicking a rate still re-prices the
 * whole site, and the values still refresh exactly as before.
 */
export function LiveRateTicker({
  variant = "bar",
}: {
  variant?: "bar" | "card";
}) {
  const { rates, updatedAt, currency, setCurrency } = useCurrency();

  const items: { sym: string; code: DisplayCurrency; ngn: number }[] = [
    { sym: "$", code: "USD", ngn: rates.usd },
    { sym: "€", code: "EUR", ngn: rates.eur },
    { sym: "£", code: "GBP", ngn: rates.gbp },
  ];

  const pulse = (
    <span className="relative flex h-1.5 w-1.5 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
    </span>
  );

  if (variant === "card") {
    return (
      <div
        className="rate-card inline-flex max-w-full items-center gap-2 overflow-x-auto rounded-full border border-yellow-600/25 bg-white/[0.04] px-3 py-1.5 backdrop-blur-md sm:gap-2.5 sm:px-3.5"
        title={`Rates updated ${timeAgo(updatedAt)}`}
      >
        <span className="flex shrink-0 items-center gap-1.5">
          {pulse}
          <span className="hidden text-[8px] font-semibold uppercase tracking-[0.18em] text-green-400 xl:inline">
            Live Rate
          </span>
        </span>

        <span aria-hidden className="h-3 w-px shrink-0 bg-white/10" />

        <div className="flex items-center gap-1">
          {items.map((i) => (
            <button
              key={i.code}
              type="button"
              onClick={() => setCurrency(i.code)}
              title={`Browse prices in ${i.code}`}
              aria-pressed={currency === i.code}
              className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] tabular-nums transition-colors hover:text-yellow-300 ${
                currency === i.code
                  ? "bg-yellow-500/15 text-yellow-300"
                  : "text-gray-400"
              }`}
            >
              {i.sym}1=
              <span className="font-semibold text-yellow-400">
                ₦{i.ngn.toLocaleString()}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCurrency("NGN")}
            title="Browse prices in NGN"
            aria-pressed={currency === "NGN"}
            className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] transition-colors hover:text-yellow-300 ${
              currency === "NGN"
                ? "bg-yellow-500/15 text-yellow-300"
                : "text-gray-500"
            }`}
          >
            ₦NGN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-yellow-600/20 bg-black">
      <div className="mx-auto grid min-h-8 max-w-7xl grid-cols-1 items-center gap-1 px-4 py-1.5 text-[11px] sm:grid-cols-3 sm:px-6 sm:py-0 lg:px-10">
        <span className="flex items-center justify-center gap-1.5 sm:justify-self-start">
          {pulse}
          <span className="font-semibold uppercase tracking-widest text-green-400">
            Live Exchange Rate
          </span>
        </span>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 sm:justify-self-center">
          {items.map((i) => (
            <button
              key={i.code}
              type="button"
              onClick={() => setCurrency(i.code)}
              title={`Browse prices in ${i.code}`}
              className={`whitespace-nowrap rounded px-1.5 py-0.5 transition-colors hover:text-yellow-300 ${
                currency === i.code
                  ? "bg-yellow-500/15 text-yellow-400"
                  : "text-gray-300"
              }`}
            >
              {i.sym}1 ={" "}
              <span className="font-semibold text-yellow-400">
                ₦{i.ngn.toLocaleString()}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCurrency("NGN")}
            title="Browse prices in NGN"
            className={`whitespace-nowrap rounded px-1.5 py-0.5 transition-colors hover:text-yellow-300 ${
              currency === "NGN"
                ? "bg-yellow-500/15 text-yellow-400"
                : "text-gray-400"
            }`}
          >
            ₦ NGN
          </button>
        </div>

        <span className="hidden text-gray-500 sm:block sm:justify-self-end">
          Updated {timeAgo(updatedAt)}
        </span>
      </div>
    </div>
  );
}
