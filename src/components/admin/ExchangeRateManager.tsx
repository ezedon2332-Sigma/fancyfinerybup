"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Save } from "lucide-react";

import type { ExchangeRate } from "@/domain/exchange-rate";
import {
  adminRefreshRate,
  adminSetManualRate,
  adminSetMode,
} from "@/app/admin/exchange-rate/actions";

const field =
  "w-40 rounded-sm border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-yellow-500";

export function ExchangeRateManager({ rate }: { rate: ExchangeRate }) {
  const router = useRouter();
  const [manual, setManual] = useState(rate.ngnPerUsd);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (!res.ok) alert(res.error ?? "Something went wrong.");
    else router.refresh();
  }

  const updated = rate.updatedAt
    ? new Date(rate.updatedAt).toLocaleString()
    : "never";

  return (
    <div className="max-w-2xl space-y-6">
      {/* Current rate */}
      <div className="rounded-xl border border-white/10 p-5">
        <p className="text-xs uppercase tracking-widest text-gray-500">
          Current rate (USD → NGN)
        </p>
        <p className="mt-1 text-3xl font-bold text-yellow-400">
          $1 = ₦{rate.ngnPerUsd.toLocaleString()}
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Mode:{" "}
          <span className="font-medium text-gray-200">
            {rate.mode === "auto" ? "Automatic (live)" : "Manual"}
          </span>{" "}
          · Source:{" "}
          <span className="text-gray-200">{rate.source ?? "—"}</span>
        </p>
        <p className="text-sm text-gray-400">Last updated: {updated}</p>
      </div>

      {/* Mode + refresh */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 p-5">
        <span className="text-sm font-semibold uppercase tracking-widest text-gray-300">
          Mode
        </span>
        <div className="inline-flex overflow-hidden rounded-full border border-white/15">
          {(["auto", "manual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => run(`mode-${m}`, () => adminSetMode(m))}
              disabled={busy !== null}
              className={`px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                rate.mode === m
                  ? "bg-yellow-500 text-black"
                  : "text-gray-300 hover:bg-white/5"
              }`}
            >
              {m === "auto" ? "Automatic" : "Manual"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => run("refresh", adminRefreshRate)}
          disabled={busy !== null}
          className="ml-auto inline-flex items-center gap-2 rounded-sm border border-yellow-500/40 px-4 py-2 text-xs font-medium text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50"
        >
          {busy === "refresh" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh now
        </button>
      </div>

      {/* Manual override */}
      <div className="rounded-xl border border-white/10 p-5">
        <p className="text-sm font-semibold uppercase tracking-widest text-gray-300">
          Manual override
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Set a fixed rate (NGN per $1). This switches the mode to Manual, so
          auto-refresh won&apos;t change it until you switch back to Automatic.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-gray-400">$1 = ₦</span>
          <input
            type="number"
            min={1}
            value={manual}
            onChange={(e) => setManual(Number(e.target.value))}
            className={field}
          />
          <button
            type="button"
            onClick={() => run("manual", () => adminSetManualRate(manual))}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-sm bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-600 disabled:opacity-50"
          >
            {busy === "manual" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save &amp; pin
          </button>
        </div>
      </div>
    </div>
  );
}
