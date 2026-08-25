"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/infrastructure/auth/session";
import { eq } from "drizzle-orm";

import { db } from "@/infrastructure/db/client";
import { taxRules } from "@/infrastructure/db/schema";

export interface TaxActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/** Rates are entered as a percentage and stored as basis points, so 7.5
 *  becomes 750. Two decimal places is the finest any real jurisdiction uses. */
const ruleSchema = z.object({
  id: z.string().uuid().optional(),
  scope: z.enum(["global", "zone", "country"]),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a two-letter country code")
    .nullable()
    .optional(),
  zoneId: z.string().uuid().nullable().optional(),
  ratePercent: z
    .number()
    .min(0, "Rate cannot be negative")
    .max(100, "Rate cannot exceed 100%"),
  label: z.string().trim().min(1, "A label is required").max(40),
  appliesToShipping: z.boolean(),
  enabled: z.boolean(),
});

export async function saveTaxRule(input: unknown): Promise<TaxActionResult> {
  await requireAdmin();
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rule." };
  }
  const d = parsed.data;

  if (d.scope === "country" && !d.countryCode) {
    return { ok: false, error: "Choose a country for a country-scoped rule." };
  }
  if (d.scope === "zone" && !d.zoneId) {
    return { ok: false, error: "Choose a zone for a zone-scoped rule." };
  }

  const row = {
    scope: d.scope,
    countryCode: d.scope === "country" ? (d.countryCode ?? null) : null,
    zoneId: d.scope === "zone" ? (d.zoneId ?? null) : null,
    rateBps: Math.round(d.ratePercent * 100),
    label: d.label,
    appliesToShipping: d.appliesToShipping,
    enabled: d.enabled,
  };

  try {
    if (d.id) {
      await db.update(taxRules).set(row).where(eq(taxRules.id, d.id));
    } else {
      await db.insert(taxRules).values(row);
    }
  } catch (e) {
    // The partial unique indexes make a duplicate scope a real possibility.
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: /duplicate|unique/i.test(message)
        ? "A rule already exists for that scope. Edit it instead."
        : message,
    };
  }

  // Nothing is cached, but revalidating keeps any statically-rendered
  // surface honest the moment a rate changes.
  revalidatePath("/admin/tax");
  revalidatePath("/checkout");
  return { ok: true, message: "Saved. New orders use this rate immediately." };
}

export async function deleteTaxRule(id: string): Promise<TaxActionResult> {
  await requireAdmin();
  try {
    await db.delete(taxRules).where(eq(taxRules.id, id));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/admin/tax");
  return { ok: true };
}

export async function setTaxRuleEnabled(
  id: string,
  enabled: boolean,
): Promise<TaxActionResult> {
  await requireAdmin();
  try {
    await db.update(taxRules).set({ enabled }).where(eq(taxRules.id, id));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/admin/tax");
  revalidatePath("/checkout");
  return { ok: true };
}
