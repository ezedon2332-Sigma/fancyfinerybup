"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import { getShippingRepository } from "@/infrastructure/supabase/shipping-service";
import {
  calculateShipping,
  computeTotals,
  toGrams,
  type WeightUnit,
} from "@/domain/shipping/engine";
import { slugify } from "@/lib/validation";

/**
 * Admin mutations for the shipping engine.
 *
 * Every one re-checks admin server-side. The tables also carry admin-only RLS
 * write policies, so this is defence in depth rather than the only gate.
 */

export interface SEResult {
  ok: boolean;
  error?: string;
  message?: string;
}

const ok = (message?: string): SEResult => ({ ok: true, message });
const fail = (error: string): SEResult => ({ ok: false, error });

/* --- Zones ---------------------------------------------------------------- */

const zoneSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Zone name is required").max(80),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export async function saveZone(input: unknown): Promise<SEResult> {
  await requireAdmin();
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid zone.");

  const admin = createSupabaseAdminClient();
  const { id, name, enabled, sortOrder } = parsed.data;

  const { error } = id
    ? await admin
        .from("shipping_zones")
        .update({ name, enabled, sort_order: sortOrder })
        .eq("id", id)
    : await admin.from("shipping_zones").insert({
        // Code is derived once, on create — renaming a zone must not change
        // its code, since rates and assignments hang off the id anyway.
        code: slugify(name) || `zone-${Date.now()}`,
        name,
        enabled,
        sort_order: sortOrder,
      });

  if (error) return fail(error.message);
  revalidatePath("/admin/shipping");
  return ok(id ? "Zone updated." : "Zone created.");
}

export async function deleteZone(id: string): Promise<SEResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  // Country assignments and rates cascade from the FK.
  const { error } = await admin.from("shipping_zones").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/admin/shipping");
  return ok("Zone deleted.");
}

/** Assign countries to a zone. Re-assigning a country moves it. */
export async function assignCountries(
  zoneId: string,
  countryCodes: string[],
): Promise<SEResult> {
  await requireAdmin();
  const codes = countryCodes
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  if (codes.length === 0) return fail("Select at least one country.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("shipping_zone_countries")
    .upsert(
      codes.map((country_code) => ({ country_code, zone_id: zoneId })),
      { onConflict: "country_code" },
    );
  if (error) return fail(error.message);
  revalidatePath("/admin/shipping");
  return ok(`${codes.length} ${codes.length === 1 ? "country" : "countries"} assigned.`);
}

export async function unassignCountry(countryCode: string): Promise<SEResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("shipping_zone_countries")
    .delete()
    .eq("country_code", countryCode.toUpperCase());
  if (error) return fail(error.message);
  revalidatePath("/admin/shipping");
  return ok("Country removed from zone.");
}

/* --- Methods -------------------------------------------------------------- */

const methodSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Method name is required").max(80),
  description: z.string().trim().max(300).nullable().optional(),
  rateSource: z.enum(["table", "carrier"]).default("table"),
  carrierCode: z.string().trim().max(40).nullable().optional(),
  enabled: z.boolean().default(true),
  minDays: z.number().int().min(0).max(365).default(3),
  maxDays: z.number().int().min(0).max(365).default(10),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export async function saveMethod(input: unknown): Promise<SEResult> {
  await requireAdmin();
  const parsed = methodSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid method.");
  const d = parsed.data;
  if (d.maxDays < d.minDays) return fail("Max days cannot be less than min days.");
  if (d.rateSource === "carrier" && !d.carrierCode) {
    return fail("A carrier-rated method needs a carrier code.");
  }

  const admin = createSupabaseAdminClient();
  const row = {
    name: d.name,
    description: d.description ?? null,
    rate_source: d.rateSource,
    carrier_code: d.carrierCode || null,
    enabled: d.enabled,
    min_days: d.minDays,
    max_days: d.maxDays,
    sort_order: d.sortOrder,
  };

  const { error } = d.id
    ? await admin.from("shipping_methods").update(row).eq("id", d.id)
    : await admin
        .from("shipping_methods")
        .insert({ ...row, code: slugify(d.name) || `method-${Date.now()}` });

  if (error) return fail(error.message);
  revalidatePath("/admin/shipping");
  return ok(d.id ? "Method updated." : "Method created.");
}

export async function deleteMethod(id: string): Promise<SEResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("shipping_methods").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/admin/shipping");
  return ok("Method deleted.");
}

/* --- Weight brackets ------------------------------------------------------- */

const bracketSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1, "Label is required").max(40),
  min: z.number().nonnegative(),
  max: z.number().positive().nullable().optional(),
  unit: z.enum(["g", "kg"]).default("kg"),
});

export async function saveBracket(input: unknown): Promise<SEResult> {
  await requireAdmin();
  const parsed = bracketSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid bracket.");
  const d = parsed.data;

  const minGrams = toGrams(d.min, d.unit as WeightUnit);
  const maxGrams = d.max == null ? null : toGrams(d.max, d.unit as WeightUnit);
  if (maxGrams != null && maxGrams <= minGrams) {
    return fail("The upper bound must be greater than the lower bound.");
  }

  const admin = createSupabaseAdminClient();
  const row = {
    label: d.label,
    min_grams: minGrams,
    max_grams: maxGrams,
    sort_order: minGrams,
  };

  const { error } = d.id
    ? await admin.from("shipping_weight_brackets").update(row).eq("id", d.id)
    : await admin.from("shipping_weight_brackets").insert(row);

  if (error) {
    return fail(
      error.code === "23505"
        ? "A bracket already starts at that weight."
        : error.message,
    );
  }
  revalidatePath("/admin/shipping");
  return ok(d.id ? "Bracket updated." : "Bracket created.");
}

export async function deleteBracket(id: string): Promise<SEResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("shipping_weight_brackets").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/admin/shipping");
  return ok("Bracket deleted.");
}

/* --- Rates ------------------------------------------------------------------ */

const rateSchema = z.object({
  zoneId: z.string().uuid().nullable().optional(),
  countryCode: z.string().trim().length(2).nullable().optional(),
  methodId: z.string().uuid(),
  bracketId: z.string().uuid(),
  /** Naira major units, as typed by the admin. */
  priceNaira: z.number().nonnegative().max(100_000_000),
  freeOverNaira: z.number().nonnegative().max(100_000_000).nullable().optional(),
});

/**
 * Save one cell of the rate matrix.
 *
 * Deliberately select-then-write rather than upsert. The uniqueness of a rate
 * is enforced by two *partial* indexes (one for zone rows, one for country
 * rows — see the migration), and Postgres cannot infer a partial index in an
 * ON CONFLICT clause: it raises 42P10. Looking the row up first sidesteps that
 * without needing a schema change.
 *
 * The partial indexes still guard against a concurrent double-insert, so a
 * lost race surfaces as 23505 and is retried as an update.
 */
export async function saveRate(input: unknown): Promise<SEResult> {
  await requireAdmin();
  const parsed = rateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid rate.");
  const d = parsed.data;

  const scoped = Boolean(d.zoneId) !== Boolean(d.countryCode);
  if (!scoped) return fail("A rate belongs to either a zone or a country, not both.");

  const admin = createSupabaseAdminClient();
  const countryCode = d.countryCode ? d.countryCode.toUpperCase() : null;
  const values = {
    price: Math.round(d.priceNaira * 100),
    free_over: d.freeOverNaira == null ? null : Math.round(d.freeOverNaira * 100),
    enabled: true,
  };

  const findExisting = async () => {
    let query = admin
      .from("shipping_rates")
      .select("id")
      .eq("method_id", d.methodId)
      .eq("bracket_id", d.bracketId);
    query = d.zoneId
      ? query.eq("zone_id", d.zoneId)
      : query.eq("country_code", countryCode as string);
    const { data } = await query.maybeSingle();
    return data?.id ?? null;
  };

  const existingId = await findExisting();
  if (existingId) {
    const { error } = await admin
      .from("shipping_rates")
      .update(values)
      .eq("id", existingId);
    if (error) return fail(error.message);
  } else {
    const { error } = await admin.from("shipping_rates").insert({
      zone_id: d.zoneId ?? null,
      country_code: countryCode,
      method_id: d.methodId,
      bracket_id: d.bracketId,
      ...values,
    });
    if (error) {
      if (error.code !== "23505") return fail(error.message);
      // Someone else inserted the same cell between our read and write.
      const raced = await findExisting();
      if (!raced) return fail(error.message);
      const { error: updateError } = await admin
        .from("shipping_rates")
        .update(values)
        .eq("id", raced);
      if (updateError) return fail(updateError.message);
    }
  }

  revalidatePath("/admin/shipping");
  return ok("Rate saved.");
}

export async function deleteRate(id: string): Promise<SEResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("shipping_rates").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/admin/shipping");
  return ok("Rate cleared.");
}

/* --- Tax / discount / default weight ------------------------------------------ */

const settingsSchema = z.object({
  taxEnabled: z.boolean(),
  taxPercent: z.number().min(0).max(100),
  taxLabel: z.string().trim().min(1).max(30),
  discountEnabled: z.boolean(),
  discountPercent: z.number().min(0).max(100),
  discountLabel: z.string().trim().min(1).max(30),
  defaultItemWeightGrams: z.number().int().min(0).max(500_000),
});

export async function saveChargeSettings(input: unknown): Promise<SEResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid settings.");
  const d = parsed.data;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("shipping_settings")
    .update({
      tax_enabled: d.taxEnabled,
      // Percent -> basis points, so 7.5% stores exactly as 750.
      tax_rate_bps: Math.round(d.taxPercent * 100),
      tax_label: d.taxLabel,
      discount_enabled: d.discountEnabled,
      discount_bps: Math.round(d.discountPercent * 100),
      discount_label: d.discountLabel,
      default_item_weight_grams: d.defaultItemWeightGrams,
    })
    .eq("id", true);

  if (error) return fail(error.message);
  revalidatePath("/admin/shipping");
  revalidatePath("/checkout");
  return ok("Settings saved.");
}

/* --- Preview -------------------------------------------------------------------- */

export interface PreviewResult {
  ok: boolean;
  error?: string;
  weightGrams?: number;
  bracketLabel?: string | null;
  zoneName?: string | null;
  options?: {
    method: string;
    priceNaira: number;
    free: boolean;
    source: string;
    days: string;
  }[];
  totals?: { subtotal: number; shipping: number; discount: number; tax: number; total: number };
}

/**
 * Dry-run the engine for a hypothetical order. Runs the exact same
 * `calculateShipping` the checkout uses, so what the admin previews is what a
 * customer would be charged.
 */
export async function previewShipping(input: {
  countryCode: string;
  weight: number;
  unit: WeightUnit;
  subtotalNaira: number;
}): Promise<PreviewResult> {
  await requireAdmin();
  try {
    const repo = await getShippingRepository();
    const [table, settings] = await Promise.all([
      repo.getRateTable(),
      repo.getSettings(),
    ]);

    const weightGrams = toGrams(input.weight, input.unit);
    const subtotalNgn = Math.round(input.subtotalNaira * 100);

    const result = calculateShipping(table, {
      countryCode: input.countryCode,
      weightGrams,
      subtotalNgn,
    });

    const cheapest =
      result.options.length > 0
        ? Math.min(...result.options.map((o) => o.priceNgn))
        : 0;
    const totals = computeTotals(
      { subtotal: subtotalNgn, shipping: cheapest },
      settings,
    );

    return {
      ok: true,
      weightGrams,
      bracketLabel: result.bracket?.label ?? null,
      zoneName: result.zone?.name ?? null,
      options: result.options.map((o) => ({
        method: o.methodName,
        priceNaira: o.priceNgn / 100,
        free: o.free,
        source: o.source === "country-override" ? "Country override" : "Zone rate",
        days: `${o.minDays}–${o.maxDays} days`,
      })),
      totals: {
        subtotal: totals.subtotal / 100,
        shipping: totals.shipping / 100,
        discount: totals.discount / 100,
        tax: totals.tax / 100,
        total: totals.total / 100,
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
