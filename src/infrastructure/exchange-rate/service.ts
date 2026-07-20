import "server-only";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import { DEFAULT_NGN_PER_USD } from "@/domain/shipping/currency";
import type { ExchangeRate, RateMode } from "@/domain/exchange-rate";
import { fetchLiveNgnPerUsd } from "./fetch-rate";

const REFRESH_MS = 60 * 60 * 1000; // refresh at least hourly (auto mode)
const MEMO_TTL_MS = 30 * 1000; // short in-memory cache to avoid per-request DB hits

let memo: { at: number; value: ExchangeRate } | null = null;

type SettingsRow = {
  ngn_per_usd?: number | null;
  rate_mode?: string | null;
  rate_source?: string | null;
  rate_updated_at?: string | null;
  updated_at?: string | null;
};

function toExchangeRate(row: SettingsRow | null): ExchangeRate {
  return {
    ngnPerUsd: row?.ngn_per_usd ?? DEFAULT_NGN_PER_USD,
    mode: (row?.rate_mode ?? "auto") as RateMode,
    source: row?.rate_source ?? null,
    updatedAt: row?.rate_updated_at ?? row?.updated_at ?? null,
  };
}

async function readRow(): Promise<SettingsRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("shipping_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  return (data as SettingsRow | null) ?? null;
}

/** Persist a freshly-fetched rate. Degrades gracefully if the new columns
 *  aren't migrated yet (updates ngn_per_usd alone). */
async function persist(rateNgn: number, source: string): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const full = {
    ngn_per_usd: Math.round(rateNgn),
    rate_source: source,
    rate_updated_at: nowIso,
  };
  const { error } = await supabase
    .from("shipping_settings")
    .update(full)
    .eq("id", true);
  if (error) {
    await supabase
      .from("shipping_settings")
      .update({ ngn_per_usd: Math.round(rateNgn) })
      .eq("id", true)
      .then(() => undefined, () => undefined);
  }
  memo = null;
  return nowIso;
}

/**
 * The effective exchange rate. In auto mode, lazily refreshes from the live API
 * when the stored rate is older than an hour (best-effort — falls back to the
 * last stored rate if the API is unavailable). Cached in-memory for 30s.
 */
export async function getExchangeRate(): Promise<ExchangeRate> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.value;

  let rate = toExchangeRate(await readRow());

  if (rate.mode === "auto") {
    const last = rate.updatedAt ? new Date(rate.updatedAt).getTime() : 0;
    if (!last || Date.now() - last > REFRESH_MS) {
      const live = await fetchLiveNgnPerUsd();
      if (live) {
        const at = await persist(live.rate, live.source);
        rate = {
          ...rate,
          ngnPerUsd: Math.round(live.rate),
          source: live.source,
          updatedAt: at,
        };
      }
    }
  }

  memo = { at: Date.now(), value: rate };
  return rate;
}

/** Force a live refresh now (cron + admin "refresh now"). */
export async function refreshExchangeRate(): Promise<{
  ok: boolean;
  rate?: ExchangeRate;
  error?: string;
}> {
  const live = await fetchLiveNgnPerUsd();
  if (!live) return { ok: false, error: "Rate provider is unavailable right now." };
  const at = await persist(live.rate, live.source);
  const rate: ExchangeRate = {
    ngnPerUsd: Math.round(live.rate),
    mode: "auto",
    source: live.source,
    updatedAt: at,
  };
  memo = { at: Date.now(), value: rate };
  return { ok: true, rate };
}

/** Switch auto/manual. Switching to auto triggers an immediate refresh. */
export async function setRateMode(
  mode: RateMode,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("shipping_settings")
    .update({ rate_mode: mode })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };
  memo = null;
  if (mode === "auto") await refreshExchangeRate();
  return { ok: true };
}

/** Manually pin the rate (sets manual mode). */
export async function setManualRate(
  ngnPerUsd: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isFinite(ngnPerUsd) || ngnPerUsd <= 0) {
    return { ok: false, error: "Enter a valid rate greater than 0." };
  }
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("shipping_settings")
    .update({
      ngn_per_usd: Math.round(ngnPerUsd),
      rate_mode: "manual",
      rate_source: "manual",
      rate_updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };
  memo = null;
  return { ok: true };
}
