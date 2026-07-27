"use server";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";

/**
 * Scoped rate reads for the admin matrix.
 *
 * The matrix only ever shows one courier against one zone-or-country at a
 * time — at most a few dozen cells. Shipping the whole rate table so the
 * client can slice it locally costs ~91 KB today and grows linearly: three
 * couriers over fifty destinations at a hundred bands is ~15,000 rows, which
 * is megabytes before the page is interactive.
 *
 * So the page sends structure only (couriers, zones, bands) and the matrix
 * asks for the cells it is about to draw. The client caches each answer, so
 * flicking back to a scope already visited costs nothing.
 */

export interface ScopedRate {
  bracketId: string;
  priceNaira: number;
  freeOverNaira: number | null;
}

export interface ScopedRatesResult {
  ok: boolean;
  rates?: ScopedRate[];
  error?: string;
}

export async function getRatesForScope(input: {
  courierId: string;
  zoneId: string | null;
  countryCode: string | null;
}): Promise<ScopedRatesResult> {
  await requireAdmin();

  if (!input.courierId) return { ok: false, error: "No courier selected." };
  if (!input.zoneId && !input.countryCode) {
    return { ok: false, error: "No zone or country selected." };
  }

  try {
    const admin = createSupabaseAdminClient();
    let q = admin
      .from("shipping_rates")
      .select("bracket_id, price, free_over")
      .eq("method_id", input.courierId)
      .eq("enabled", true);

    // Country overrides and zone rates are distinct rows; never mix them.
    q = input.countryCode
      ? q.eq("country_code", input.countryCode.toUpperCase())
      : q.is("country_code", null).eq("zone_id", input.zoneId!);

    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };

    return {
      ok: true,
      rates: (data ?? []).map((r) => ({
        bracketId: r.bracket_id,
        priceNaira: Math.round(r.price / 100),
        freeOverNaira: r.free_over == null ? null : Math.round(r.free_over / 100),
      })),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Apply one price across many bands in a single scope.
 *
 * Done server-side in two statements rather than one request per cell: a
 * hundred-band ladder would otherwise be a hundred round trips, and a partial
 * failure would leave the ladder half-priced with no way to tell where.
 */
export async function bulkSetRates(input: {
  courierId: string;
  zoneId: string | null;
  countryCode: string | null;
  bracketIds: string[];
  priceNaira: number;
}): Promise<{ ok: boolean; written?: number; error?: string }> {
  await requireAdmin();

  if (!input.zoneId && !input.countryCode) {
    return { ok: false, error: "A rate needs either a zone or a country." };
  }
  if (input.bracketIds.length === 0) {
    return { ok: false, error: "No weight bands selected." };
  }
  if (!Number.isFinite(input.priceNaira) || input.priceNaira < 0) {
    return { ok: false, error: "Enter a price of zero or more." };
  }

  const admin = createSupabaseAdminClient();
  const country = input.countryCode?.toUpperCase() ?? null;
  const priceKobo = Math.round(input.priceNaira * 100);

  try {
    // Which of these bands already have a row in this scope?
    let existingQuery = admin
      .from("shipping_rates")
      .select("id, bracket_id")
      .eq("method_id", input.courierId)
      .in("bracket_id", input.bracketIds);
    existingQuery = country
      ? existingQuery.eq("country_code", country)
      : existingQuery.is("country_code", null).eq("zone_id", input.zoneId!);

    const { data: existing, error: readErr } = await existingQuery;
    if (readErr) return { ok: false, error: readErr.message };

    const have = new Map((existing ?? []).map((r) => [r.bracket_id, r.id]));
    const ids = [...have.values()];
    const missing = input.bracketIds.filter((b) => !have.has(b));

    if (ids.length > 0) {
      const { error } = await admin
        .from("shipping_rates")
        .update({ price: priceKobo, enabled: true })
        .in("id", ids);
      if (error) return { ok: false, error: error.message };
    }

    if (missing.length > 0) {
      const { error } = await admin.from("shipping_rates").insert(
        missing.map((bracketId) => ({
          method_id: input.courierId,
          bracket_id: bracketId,
          zone_id: country ? null : input.zoneId,
          country_code: country,
          price: priceKobo,
          enabled: true,
        })),
      );
      if (error) return { ok: false, error: error.message };
    }

    return { ok: true, written: input.bracketIds.length };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Every rate as CSV, for spreadsheet editing or an offline record. */
export async function exportRatesCsv(): Promise<{
  ok: boolean;
  csv?: string;
  error?: string;
}> {
  await requireAdmin();
  try {
    const admin = createSupabaseAdminClient();
    const [{ data: rates }, { data: couriers }, { data: brackets }, { data: zones }] =
      await Promise.all([
        admin.from("shipping_rates").select("*").limit(50_000),
        admin.from("shipping_methods").select("id, code, display_name, name"),
        admin
          .from("shipping_weight_brackets")
          .select("id, label, min_grams, max_grams")
          .order("min_grams"),
        admin.from("shipping_zones").select("id, code, name"),
      ]);

    const courierBy = new Map((couriers ?? []).map((c) => [c.id, c]));
    const bracketBy = new Map((brackets ?? []).map((b) => [b.id, b]));
    const zoneBy = new Map((zones ?? []).map((z) => [z.id, z]));

    const header = [
      "Courier",
      "Scope",
      "Zone",
      "Country",
      "Weight band",
      "Min (g)",
      "Max (g)",
      "Price (NGN)",
      "Free over (NGN)",
      "Enabled",
    ];

    const rows = (rates ?? [])
      .map((r) => {
        const b = bracketBy.get(r.bracket_id);
        const c = courierBy.get(r.method_id);
        return {
          sort: b?.min_grams ?? 0,
          cells: [
            c?.display_name || c?.name || "",
            r.country_code ? "Country override" : "Zone",
            r.zone_id ? (zoneBy.get(r.zone_id)?.name ?? "") : "",
            r.country_code ?? "",
            b?.label ?? "",
            String(b?.min_grams ?? ""),
            b?.max_grams == null ? "" : String(b.max_grams),
            String(Math.round(r.price / 100)),
            r.free_over == null ? "" : String(Math.round(r.free_over / 100)),
            r.enabled ? "yes" : "no",
          ],
        };
      })
      .sort((a, b) => a.sort - b.sort)
      .map((r) => r.cells.map(csvCell).join(","));

    return { ok: true, csv: [header.join(","), ...rows].join("\r\n") };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Quote for CSV, and neutralise the leading characters spreadsheets treat as
 *  formulas — a zone name must not execute when the file is opened. */
function csvCell(value: string): string {
  const v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${v.replace(/"/g, '""')}"`;
}
