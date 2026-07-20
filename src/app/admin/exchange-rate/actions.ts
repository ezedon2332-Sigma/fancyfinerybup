"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import {
  refreshExchangeRate,
  setManualRate,
  setRateMode,
} from "@/infrastructure/exchange-rate/service";
import type { RateMode } from "@/domain/exchange-rate";

export interface RateActionResult {
  ok: boolean;
  error?: string;
}

function revalidate() {
  revalidatePath("/admin/exchange-rate");
  revalidatePath("/", "layout");
}

export async function adminRefreshRate(): Promise<RateActionResult> {
  await requireAdmin();
  const r = await refreshExchangeRate();
  revalidate();
  return { ok: r.ok, error: r.error };
}

export async function adminSetMode(mode: string): Promise<RateActionResult> {
  await requireAdmin();
  if (mode !== "auto" && mode !== "manual") {
    return { ok: false, error: "Invalid mode." };
  }
  const r = await setRateMode(mode as RateMode);
  revalidate();
  return r;
}

export async function adminSetManualRate(
  ngnPerUsd: number,
): Promise<RateActionResult> {
  await requireAdmin();
  const r = await setManualRate(Number(ngnPerUsd));
  revalidate();
  return r;
}
