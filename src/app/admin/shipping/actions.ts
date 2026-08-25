"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/infrastructure/auth/session";
import { and, count, eq, inArray } from "drizzle-orm";

import { db } from "@/infrastructure/db/client";
import {
  shippingMethods,
  shippingRates,
  shippingWeightBrackets,
  shippingZoneCountries,
  shippingZones,
} from "@/infrastructure/db/schema";

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

  try {
    await db
      .update(shippingMethods)
      .set({
        displayName: d.displayName,
        minDays: d.minDays,
        maxDays: d.maxDays,
        enabled: d.enabled,
      })
      .where(eq(shippingMethods.id, d.id));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

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
  const values = { code: d.code, name: d.name, enabled: d.enabled };
  try {
    if (d.id) {
      await db.update(shippingZones).set(values).where(eq(shippingZones.id, d.id));
    } else {
      await db.insert(shippingZones).values(values);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: /duplicate|unique/i.test(message)
        ? "A zone with that code already exists."
        : message,
    };
  }
  refresh();
  return { ok: true, message: "Zone saved." };
}

export async function deleteZone(id: string): Promise<ShipActionResult> {
  await requireAdmin();
  // Rates hang off zones. Deleting silently would wipe pricing, so say so.
  let affected = 0;
  try {
    // Count and delete in one transaction: reporting a number that a concurrent
    // write has already changed would be a confident lie about what happened.
    affected = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ n: count() })
        .from(shippingRates)
        .where(eq(shippingRates.zoneId, id));
      await tx.delete(shippingZones).where(eq(shippingZones.id, id));
      return row?.n ?? 0;
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  refresh();
  return {
    ok: true,
    message:
      affected > 0
        ? `Zone deleted, along with ${affected} rate${affected === 1 ? "" : "s"}.`
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

  try {
    // One transaction. Between the clear and the insert the zone has NO
    // countries, so a quote priced in that window would silently miss its zone
    // and fall through to a different rate. Atomicity closes that window.
    await db.transaction(async (tx) => {
      // A country belongs to one zone. Clear it from any other first, or the
      // engine's zone lookup becomes order-dependent.
      if (countryCodes.length > 0) {
        await tx
          .delete(shippingZoneCountries)
          .where(inArray(shippingZoneCountries.countryCode, countryCodes));
      }
      await tx
        .delete(shippingZoneCountries)
        .where(eq(shippingZoneCountries.zoneId, zoneId));

      if (countryCodes.length > 0) {
        await tx
          .insert(shippingZoneCountries)
          .values(countryCodes.map((c) => ({ zoneId, countryCode: c })));
      }
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
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

  const row = {
    label: d.label,
    minGrams: d.minGrams,
    maxGrams: d.maxGrams,
    sortOrder: d.sortOrder,
  };
  try {
    if (d.id) {
      await db
        .update(shippingWeightBrackets)
        .set(row)
        .where(eq(shippingWeightBrackets.id, d.id));
    } else {
      await db.insert(shippingWeightBrackets).values(row);
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  refresh();
  return { ok: true, message: "Weight band saved." };
}

export async function deleteBracket(id: string): Promise<ShipActionResult> {
  await requireAdmin();
  let affected = 0;
  try {
    affected = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ n: count() })
        .from(shippingRates)
        .where(eq(shippingRates.bracketId, id));
      await tx
        .delete(shippingWeightBrackets)
        .where(eq(shippingWeightBrackets.id, id));
      return row?.n ?? 0;
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  refresh();
  return {
    ok: true,
    message:
      affected > 0
        ? `Band deleted, along with ${affected} rate${affected === 1 ? "" : "s"}.`
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
 * Still select-then-write rather than an upsert: uniqueness on this table comes
 * from partial indexes (one for zone rates, one for country overrides), and
 * ON CONFLICT would have to repeat each index predicate to target them. The
 * read and the write now share a transaction, which is what actually makes the
 * pattern safe against two admins editing the same cell at once — PostgREST
 * could not express that at all.
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

  const scope = d.countryCode
    ? eq(shippingRates.countryCode, d.countryCode)
    : eq(shippingRates.zoneId, d.zoneId!);

  try {
    const cleared = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: shippingRates.id })
        .from(shippingRates)
        .where(
          and(
            eq(shippingRates.methodId, d.courierId),
            eq(shippingRates.bracketId, d.bracketId),
            scope,
          ),
        )
        .limit(1);

      // Clearing the price removes the cell entirely, so the engine falls back
      // to the zone rate (or offers nothing) rather than quoting zero.
      if (d.priceNaira === null) {
        if (existing) {
          await tx.delete(shippingRates).where(eq(shippingRates.id, existing.id));
          return true;
        }
        return false;
      }

      const row = {
        price: Math.round(d.priceNaira * 100),
        freeOver:
          d.freeOverNaira === null ? null : Math.round(d.freeOverNaira * 100),
        enabled: true,
      };

      if (existing) {
        await tx
          .update(shippingRates)
          .set(row)
          .where(eq(shippingRates.id, existing.id));
      } else {
        await tx.insert(shippingRates).values({
          ...row,
          methodId: d.courierId,
          bracketId: d.bracketId,
          zoneId: d.countryCode ? null : d.zoneId,
          countryCode: d.countryCode,
        });
      }
      return false;
    });

    if (d.priceNaira === null && !cleared) return { ok: true };
    refresh();
    return cleared ? { ok: true, message: "Rate cleared." } : { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
