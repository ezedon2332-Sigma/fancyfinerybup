"use client";

import { useCurrency } from "@/components/providers/CurrencyProvider";

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

/** Prominent, mobile-responsive "Live Exchange Rate" strip for the homepage. */
export function LiveRateBadge() {
  const { rates, updatedAt } = useCurrency();
  const items = [
    { sym: "$", ngn: rates.usd },
    { sym: "€", ngn: rates.eur },
    { sym: "£", ngn: rates.gbp },
  ];

  return (
    <section className="mx-auto max-w-7xl px-6 pt-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-1.5 rounded-full border border-yellow-600/30 bg-neutral-950/70 px-6 py-3 text-sm shadow-lg shadow-black/30">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-green-400">
            Live Exchange Rate
          </span>
        </span>
        {items.map((i) => (
          <span key={i.sym} className="whitespace-nowrap text-gray-200">
            {i.sym}1 ={" "}
            <span className="font-semibold text-yellow-400">
              ₦{i.ngn.toLocaleString()}
            </span>
          </span>
        ))}
        <span className="text-xs text-gray-500">Updated {timeAgo(updatedAt)}</span>
      </div>
    </section>
  );
}
