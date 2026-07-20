"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
import { COUNTRIES, SHIPPING_ZONES } from "@/domain/shipping/countries";
import { defaultRateFor } from "@/domain/shipping/defaults";

export interface ActionResult {
  ok: boolean;
  error?: string;
  count?: number;
}

const naira = z.number().nonnegative().max(1_000_000_000);
const days = z.number().int().min(0).max(365);

const countryUpdateSchema = z.object({
  code: z.string().trim().length(2),
  enabled: z.boolean(),
  standardPriceNaira: naira,
  standardMinDays: days,
  standardMaxDays: days,
  expressOffered: z.boolean(),
  expressPriceNaira: naira,
  expressMinDays: days,
  expressMaxDays: days,
  freeShipping: z.boolean(),
  freeOverNaira: naira,
});

const zoneUpdateSchema = z.object({
  zone: z.enum(SHIPPING_ZONES as unknown as [string, ...string[]]),
  enabled: z.boolean(),
  standardPriceNaira: naira,
  expressOffered: z.boolean(),
  expressPriceNaira: naira,
});

const toKobo = (naira: number) => Math.round(naira * 100);

/** Populate `shipping_countries` from the bundled ISO dataset with zone-based
 *  defaults. Existing rows are left untouched (admin edits are preserved). */
export async function seedShippingCountries(): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  await supabase.from("shipping_settings").upsert(
    { id: true },
    { onConflict: "id", ignoreDuplicates: true },
  );

  const rows = COUNTRIES.map((c) => {
    const d = defaultRateFor(c.zone, c.code);
    return {
      code: c.code,
      name: c.name,
      zone: c.zone,
      enabled: d.enabled,
      standard_price: d.standardPrice,
      standard_min_days: d.standardMinDays,
      standard_max_days: d.standardMaxDays,
      express_price: d.expressPrice,
      express_min_days: d.expressMinDays,
      express_max_days: d.expressMaxDays,
      free_over: d.freeOver,
    };
  });

  const { error } = await supabase
    .from("shipping_countries")
    .upsert(rows, { onConflict: "code", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/shipping");
  return { ok: true, count: rows.length };
}

export async function updateShippingCountry(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = countryUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;
  if (v.standardMaxDays < v.standardMinDays || v.expressMaxDays < v.expressMinDays) {
    return { ok: false, error: "Max delivery days must be ≥ min days." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("shipping_countries")
    .update({
      enabled: v.enabled,
      standard_price: toKobo(v.standardPriceNaira),
      standard_min_days: v.standardMinDays,
      standard_max_days: v.standardMaxDays,
      express_price: v.expressOffered ? toKobo(v.expressPriceNaira) : null,
      express_min_days: v.expressMinDays,
      express_max_days: v.expressMaxDays,
      free_over: v.freeShipping ? toKobo(v.freeOverNaira) : null,
    })
    .eq("code", v.code.toUpperCase());
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/shipping");
  return { ok: true };
}

/** Bulk-apply enabled + prices to every country in a zone. */
export async function updateShippingZone(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = zoneUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("shipping_countries")
    .update(
      {
        enabled: v.enabled,
        standard_price: toKobo(v.standardPriceNaira),
        express_price: v.expressOffered ? toKobo(v.expressPriceNaira) : null,
      },
      { count: "exact" },
    )
    .eq("zone", v.zone);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/shipping");
  return { ok: true, count: count ?? undefined };
}

export async function updateShippingSettings(
  ngnPerUsd: number,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.number().int().positive().max(100000).safeParse(ngnPerUsd);
  if (!parsed.success) return { ok: false, error: "Enter a valid exchange rate." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("shipping_settings")
    .update({ ngn_per_usd: parsed.data })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/shipping");
  return { ok: true };
}

export async function removeShippingCountry(code: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.string().trim().length(2).safeParse(code);
  if (!parsed.success) return { ok: false, error: "Invalid country." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("shipping_countries")
    .delete()
    .eq("code", parsed.data.toUpperCase());
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/shipping");
  return { ok: true };
}
