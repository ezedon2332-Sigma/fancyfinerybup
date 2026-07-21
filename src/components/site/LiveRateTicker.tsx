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

/** Full-width live exchange-rate ticker across the very top of the site:
 *  LIVE indicator (left) · USD/EUR/GBP → NGN (centre) · last-updated (right). */
export function LiveRateTicker() {
  const { rates, updatedAt, currency, setCurrency } = useCurrency();
  const items: { sym: string; code: DisplayCurrency; ngn: number }[] = [
    { sym: "$", code: "USD", ngn: rates.usd },
    { sym: "€", code: "EUR", ngn: rates.eur },
    { sym: "£", code: "GBP", ngn: rates.gbp },
  ];

  return (
    <div className="border-b border-yellow-600/20 bg-black">
      <div className="mx-auto grid min-h-8 max-w-7xl grid-cols-1 items-center gap-1 px-4 py-1.5 text-[11px] sm:grid-cols-3 sm:px-6 sm:py-0 lg:px-10">
        {/* Left — live indicator */}
        <span className="flex items-center justify-center gap-1.5 sm:justify-self-start">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="font-semibold uppercase tracking-widest text-green-400">
            Live Exchange Rate
          </span>
        </span>

        {/* Centre — the three currencies */}
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

        {/* Right — last updated */}
        <span className="hidden text-gray-500 sm:block sm:justify-self-end">
          Updated {timeAgo(updatedAt)}
        </span>
      </div>
    </div>
  );
}
