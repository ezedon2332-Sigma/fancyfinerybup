"use client";

import { useState, useTransition } from "react";

import { saveFxRates } from "@/app/admin/exchange-rate/actions";
import type { ExchangeRates } from "@/domain/shared/display-price";
import { toastResult } from "@/components/ui/Toast";

const FIELD =
  "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500";

/** A representative catalogue price, so the preview is concrete money. */
const SAMPLE_KOBO = 30_000_000; // ₦300,000

export function ExchangeRatePanel({ initial }: { initial: ExchangeRates }) {
  const [usd, setUsd] = useState(String(initial.ngnPer.USD));
  const [eur, setEur] = useState(String(initial.ngnPer.EUR));
  const [gbp, setGbp] = useState(String(initial.ngnPer.GBP));
  const [enabled, setEnabled] = useState(initial.enabled);
  const [pending, start] = useTransition();

  /**
   * Live preview of what the change does to a real price.
   *
   * This is the whole point of the screen. Switching conversion on at 1600
   * takes a ₦300,000 gown from $300 to $187.50 across the entire catalogue —
   * a number nobody should first discover from an order confirmation.
   */
  function preview(raw: string): string {
    // Conversion off: the existing rule is "drop the thousands", so ₦300,000
    // reads as 300 in any foreign currency.
    if (!enabled) return (SAMPLE_KOBO / 100 / 1000).toFixed(2);
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return "—";
    return (SAMPLE_KOBO / n / 100).toFixed(2);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveFxRates({
        usd: Number(usd),
        eur: Number(eur),
        gbp: Number(gbp),
        enabled,
      });
      toastResult(res, { success: "Rates saved." });
    });
  }

  const rows = [
    { code: "USD", symbol: "$", value: usd, set: setUsd },
    { code: "EUR", symbol: "€", value: eur, set: setEur },
    { code: "GBP", symbol: "£", value: gbp, set: setGbp },
  ];

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
        <p className="text-xs uppercase tracking-widest text-gray-400">
          Rates — naira per 1 unit
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Enter the figure the way it is quoted: 1600 means ₦1,600 to the dollar.
        </p>

        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div
              key={r.code}
              className="grid grid-cols-[4.5rem_1fr] items-center gap-3 sm:grid-cols-[4.5rem_1fr_auto]"
            >
              <label htmlFor={`fx-${r.code}`} className="text-sm text-gray-200">
                {r.symbol} {r.code}
              </label>
              <input
                id={`fx-${r.code}`}
                className={FIELD}
                inputMode="numeric"
                value={r.value}
                onChange={(e) => r.set(e.target.value.replace(/[^0-9]/g, ""))}
              />
              <span className="whitespace-nowrap text-xs text-gray-500">
                ₦300,000 → {r.symbol}
                {preview(r.value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-yellow-600/30 bg-yellow-500/5 p-5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-1 h-4 w-4 accent-yellow-500"
        />
        <span className="text-sm text-gray-200">
          Use these rates to price the storefront
          <span className="mt-1 block text-xs text-gray-400">
            While this is off, foreign prices use the existing rule — ₦300,000
            shows as $300, which is a price rather than a conversion. Switching
            it on re-prices every non-naira listing immediately, using the
            figures above. Check the previews before saving.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-yellow-400 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save rates"}
        </button>
      </div>
    </form>
  );
}
