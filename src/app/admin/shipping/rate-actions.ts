"use server";

import { requireAdmin } from "@/infrastructure/auth/session";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/infrastructure/db/client";
import {
  shippingMethods,
  shippingRates,
  shippingWeightBrackets,
  shippingZones,
} from "@/infrastructure/db/schema";

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
    // Country overrides and zone rates are distinct rows; never mix them.
    const scope = input.countryCode
      ? eq(shippingRates.countryCode, input.countryCode.toUpperCase())
      : and(
          isNull(shippingRates.countryCode),
          eq(shippingRates.zoneId, input.zoneId!),
        );

    const rows = await db
      .select({
        bracketId: shippingRates.bracketId,
        price: shippingRates.price,
        freeOver: shippingRates.freeOver,
      })
      .from(shippingRates)
      .where(
        and(
          eq(shippingRates.methodId, input.courierId),
          eq(shippingRates.enabled, true),
          scope,
        ),
      );

    return {
      ok: true,
      rates: rows.map((r) => ({
        bracketId: r.bracketId,
        priceNaira: Math.round(r.price / 100),
        freeOverNaira: r.freeOver == null ? null : Math.round(r.freeOver / 100),
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

  const country = input.countryCode?.toUpperCase() ?? null;
  const priceKobo = Math.round(input.priceNaira * 100);

  const scope = country
    ? eq(shippingRates.countryCode, country)
    : and(isNull(shippingRates.countryCode), eq(shippingRates.zoneId, input.zoneId!));

  try {
    // One transaction. The docstring above already argued that a partial
    // failure "would leave the ladder half-priced with no way to tell where" —
    // two independent statements could still do exactly that. Now they cannot.
    await db.transaction(async (tx) => {
      // Which of these bands already have a row in this scope?
      const existing = await tx
        .select({ id: shippingRates.id, bracketId: shippingRates.bracketId })
        .from(shippingRates)
        .where(
          and(
            eq(shippingRates.methodId, input.courierId),
            inArray(shippingRates.bracketId, input.bracketIds),
            scope,
          ),
        );

      const have = new Map(existing.map((r) => [r.bracketId, r.id]));
      const ids = [...have.values()];
      const missing = input.bracketIds.filter((b) => !have.has(b));

      if (ids.length > 0) {
        await tx
          .update(shippingRates)
          .set({ price: priceKobo, enabled: true })
          .where(inArray(shippingRates.id, ids));
      }

      if (missing.length > 0) {
        await tx.insert(shippingRates).values(
          missing.map((bracketId) => ({
            methodId: input.courierId,
            bracketId,
            zoneId: country ? null : input.zoneId,
            countryCode: country,
            price: priceKobo,
            enabled: true,
          })),
        );
      }
    });

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
    const [rates, couriers, brackets, zones] = await Promise.all([
      db.select().from(shippingRates).limit(50_000),
      db
        .select({
          id: shippingMethods.id,
          code: shippingMethods.code,
          display_name: shippingMethods.displayName,
          name: shippingMethods.name,
        })
        .from(shippingMethods),
      db
        .select({
          id: shippingWeightBrackets.id,
          label: shippingWeightBrackets.label,
          min_grams: shippingWeightBrackets.minGrams,
          max_grams: shippingWeightBrackets.maxGrams,
        })
        .from(shippingWeightBrackets)
        .orderBy(asc(shippingWeightBrackets.minGrams)),
      db
        .select({
          id: shippingZones.id,
          code: shippingZones.code,
          name: shippingZones.name,
        })
        .from(shippingZones),
    ]);

    const courierBy = new Map(couriers.map((c) => [c.id, c]));
    const bracketBy = new Map(brackets.map((b) => [b.id, b]));
    const zoneBy = new Map(zones.map((z) => [z.id, z]));

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

    const rows = rates
      .map((r) => {
        const b = bracketBy.get(r.bracketId);
        const c = courierBy.get(r.methodId);
        return {
          sort: b?.min_grams ?? 0,
          cells: [
            c?.display_name || c?.name || "",
            r.countryCode ? "Country override" : "Zone",
            r.zoneId ? (zoneBy.get(r.zoneId)?.name ?? "") : "",
            r.countryCode ?? "",
            b?.label ?? "",
            String(b?.min_grams ?? ""),
            b?.max_grams == null ? "" : String(b.max_grams),
            String(Math.round(r.price / 100)),
            r.freeOver == null ? "" : String(Math.round(r.freeOver / 100)),
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
