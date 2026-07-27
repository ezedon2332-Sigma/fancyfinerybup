"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";

export interface ShipActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/** Rates change what customers are charged, so every write revalidates the
 *  surfaces that display them. Quotes read live and need no invalidation. */
function refresh() {
  revalidatePath("/admin/shipping");
  revalidatePath("/shipping");
}

// --- Couriers ---------------------------------------------------------------

const courierSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().trim().min(1, "A name is required").max(60),
  minDays: z.number().int().min(0).max(120),
  maxDays: z.number().int().min(0).max(120),
  enabled: z.boolean(),
});

export async function saveCourier(input: unknown): Promise<ShipActionResult> {
  await requireAdmin();
  const parsed = courierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid courier." };
  }
  const d = parsed.data;
  if (d.maxDays < d.minDays) {
    return { ok: false, error: "Maximum days cannot be less than minimum days." };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("shipping_methods")
    .update({
      display_name: d.displayName,
      min_days: d.minDays,
      max_days: d.maxDays,
      enabled: d.enabled,
    })
    .eq("id", d.id);
  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true, message: "Courier updated." };
}

// --- Zones ------------------------------------------------------------------

const zoneSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Code: lowercase letters, numbers and dashes")
    .max(40),
  name: z.string().trim().min(2, "A name is required").max(80),
  enabled: z.boolean(),
});

export async function saveZone(input: unknown): Promise<ShipActionResult> {
  await requireAdmin();
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid zone." };
  }
  const d = parsed.data;
  const admin = createSupabaseAdminClient();

  const { error } = d.id
    ? await admin
        .from("shipping_zones")
        .update({ code: d.code, name: d.name, enabled: d.enabled })
        .eq("id", d.id)
    : await admin
        .from("shipping_zones")
        .insert({ code: d.code, name: d.name, enabled: d.enabled });

  if (error) {
    return {
      ok: false,
      error: /duplicate|unique/i.test(error.message)
        ? "A zone with that code already exists."
        : error.message,
    };
  }
  refresh();
  return { ok: true, message: "Zone saved." };
}

export async function deleteZone(id: string): Promise<ShipActionResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  // Rates hang off zones. Deleting silently would wipe pricing, so say so.
  const { count } = await admin
    .from("shipping_rates")
    .select("id", { count: "exact", head: true })
    .eq("zone_id", id);

  const { error } = await admin.from("shipping_zones").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  refresh();
  return {
    ok: true,
    message:
      (count ?? 0) > 0
        ? `Zone deleted, along with ${count} rate${count === 1 ? "" : "s"}.`
        : "Zone deleted.",
  };
}

const assignSchema = z.object({
  zoneId: z.string().uuid(),
  countryCodes: z.array(z.string().trim().toUpperCase().length(2)).max(300),
});

/** Replace a zone's country list wholesale — simpler to reason about than
 *  diffing, and the lists are small. */
export async function setZoneCountries(input: unknown): Promise<ShipActionResult> {
  await requireAdmin();
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid selection." };
  }
  const { zoneId, countryCodes } = parsed.data;
  const admin = createSupabaseAdminClient();

  // A country belongs to one zone. Clear it from any other first, or the
  // engine's zone lookup becomes order-dependent.
  if (countryCodes.length > 0) {
    await admin
      .from("shipping_zone_countries")
      .delete()
      .in("country_code", countryCodes);
  }
  await admin.from("shipping_zone_countries").delete().eq("zone_id", zoneId);

  if (countryCodes.length > 0) {
    const { error } = await admin
      .from("shipping_zone_countries")
      .insert(countryCodes.map((c) => ({ zone_id: zoneId, country_code: c })));
    if (error) return { ok: false, error: error.message };
  }

  refresh();
  return { ok: true, message: `${countryCodes.length} countries assigned.` };
}

// --- Weight brackets ---------------------------------------------------------

const bracketSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1, "A label is required").max(40),
  minGrams: z.number().int().min(0).max(1_000_000),
  /** null means the open-ended top band. */
  maxGrams: z.number().int().min(1).max(1_000_000).nullable(),
  sortOrder: z.number().int().min(0).max(10000),
});

export async function saveBracket(input: unknown): Promise<ShipActionResult> {
  await requireAdmin();
  const parsed = bracketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid bracket." };
  }
  const d = parsed.data;
  if (d.maxGrams !== null && d.maxGrams <= d.minGrams) {
    return { ok: false, error: "Maximum weight must be above the minimum." };
  }

  const admin = createSupabaseAdminClient();
  const row = {
    label: d.label,
    min_grams: d.minGrams,
    max_grams: d.maxGrams,
    sort_order: d.sortOrder,
  };
  const { error } = d.id
    ? await admin.from("shipping_weight_brackets").update(row).eq("id", d.id)
    : await admin.from("shipping_weight_brackets").insert(row);
  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true, message: "Weight band saved." };
}

export async function deleteBracket(id: string): Promise<ShipActionResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { count } = await admin
    .from("shipping_rates")
    .select("id", { count: "exact", head: true })
    .eq("bracket_id", id);

  const { error } = await admin
    .from("shipping_weight_brackets")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  refresh();
  return {
    ok: true,
    message:
      (count ?? 0) > 0
        ? `Band deleted, along with ${count} rate${count === 1 ? "" : "s"}.`
        : "Band deleted.",
  };
}

// --- Rates --------------------------------------------------------------------

const rateSchema = z.object({
  courierId: z.string().uuid(),
  bracketId: z.string().uuid(),
  zoneId: z.string().uuid().nullable(),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  /** Entered in Naira; stored as kobo. Empty clears the cell. */
  priceNaira: z.number().min(0).max(100_000_000).nullable(),
  freeOverNaira: z.number().min(0).max(100_000_000).nullable(),
});

/**
 * Save one cell of the rate matrix.
 *
 * Uses select-then-write rather than an upsert: uniqueness on this table comes
 * from partial indexes (one for zone rates, one for country overrides), and
 * Postgres cannot infer ON CONFLICT from a partial index without repeating its
 * predicate, which PostgREST gives no way to express.
 */
export async function saveRate(input: unknown): Promise<ShipActionResult> {
  await requireAdmin();
  const parsed = rateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rate." };
  }
  const d = parsed.data;
  if (!d.zoneId && !d.countryCode) {
    return { ok: false, error: "A rate needs either a zone or a country." };
  }

  const admin = createSupabaseAdminClient();
  let lookup = admin
    .from("shipping_rates")
    .select("id")
    .eq("method_id", d.courierId)
    .eq("bracket_id", d.bracketId);
  lookup = d.countryCode
    ? lookup.eq("country_code", d.countryCode)
    : lookup.eq("zone_id", d.zoneId!);

  const { data: existing } = await lookup.maybeSingle();

  // Clearing the price removes the cell entirely, so the engine falls back to
  // the zone rate (or offers nothing) rather than quoting zero.
  if (d.priceNaira === null) {
    if (existing) {
      await admin.from("shipping_rates").delete().eq("id", existing.id);
      refresh();
      return { ok: true, message: "Rate cleared." };
    }
    return { ok: true };
  }

  const row = {
    price: Math.round(d.priceNaira * 100),
    free_over: d.freeOverNaira === null ? null : Math.round(d.freeOverNaira * 100),
    enabled: true,
  };

  const { error } = existing
    ? await admin.from("shipping_rates").update(row).eq("id", existing.id)
    : await admin.from("shipping_rates").insert({
        ...row,
        method_id: d.courierId,
        bracket_id: d.bracketId,
        zone_id: d.countryCode ? null : d.zoneId,
        country_code: d.countryCode,
      });

  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
