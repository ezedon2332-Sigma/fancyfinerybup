"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/infrastructure/auth/session";
import { saveExchangeRates } from "@/infrastructure/db/exchange-rate-service";

export interface FxActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/**
 * Bounds, not decoration.
 *
 * A rate of 0 would divide every foreign price to nothing; a rate of 1 would
 * price a ₦300,000 gown at $300,000. Both are typos a tired admin can make, and
 * both are the kind of mistake only noticed once orders arrive. The floor and
 * ceiling are wide enough for any plausible naira rate and narrow enough to
 * catch a slipped digit.
 */
const rate = z
  .number({ message: "Enter a number" })
  .int("Whole naira only")
  .min(50, "That rate looks too low — check the figure")
  .max(100_000, "That rate looks too high — check the figure");

const schema = z.object({
  usd: rate,
  eur: rate,
  gbp: rate,
  enabled: z.boolean(),
});

export async function saveFxRates(input: unknown): Promise<FxActionResult> {
  await requireAdmin();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rates." };
  }

  try {
    await saveExchangeRates(parsed.data);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Prices appear on effectively every page, so the whole storefront is stale
  // the moment a rate moves.
  revalidatePath("/", "layout");

  return {
    ok: true,
    message: parsed.data.enabled
      ? "Saved. Live conversion is ON — foreign prices now use these rates."
      : "Saved. Live conversion is OFF — foreign prices keep the existing rule.",
  };
}
