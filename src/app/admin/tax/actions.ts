"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";

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
    country_code: d.scope === "country" ? d.countryCode : null,
    zone_id: d.scope === "zone" ? d.zoneId : null,
    rate_bps: Math.round(d.ratePercent * 100),
    label: d.label,
    applies_to_shipping: d.appliesToShipping,
    enabled: d.enabled,
  };

  const admin = createSupabaseAdminClient();
  const { error } = d.id
    ? await admin.from("tax_rules").update(row).eq("id", d.id)
    : await admin.from("tax_rules").insert(row);

  if (error) {
    // The partial unique indexes make a duplicate scope a real possibility.
    return {
      ok: false,
      error: /duplicate|unique/i.test(error.message)
        ? "A rule already exists for that scope. Edit it instead."
        : error.message,
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
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("tax_rules").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/tax");
  return { ok: true };
}

export async function setTaxRuleEnabled(
  id: string,
  enabled: boolean,
): Promise<TaxActionResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("tax_rules").update({ enabled }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/tax");
  revalidatePath("/checkout");
  return { ok: true };
}
