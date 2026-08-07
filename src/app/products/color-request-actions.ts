"use server";

import { headers } from "next/headers";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import { colorRequestSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/ai-rate-limit";

export interface ColorRequestResult {
  ok: boolean;
  error?: string;
}

/** Public: submit an on-demand colour request. Inserts via the service-role
 *  client (server-side) so the request is stored without exposing the
 *  color_requests table (and its PII) to the public API. */
export async function submitColorRequestAction(
  payload: unknown,
): Promise<ColorRequestResult> {
  const parsed = colorRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }
  const v = parsed.data;

  // Throttle by client IP — this writes attacker-controlled PII via the service
  // role, so an unthrottled public action is a spam / storage-exhaustion sink.
  const h = await headers();
  const ip =
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown";
  if (!rateLimit(`color:${ip}`, 5, 60_000).ok) {
    return { ok: false, error: "Please wait a moment before requesting again." };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("color_requests").insert({
      product_id: v.productId ?? null,
      product_name: v.productName,
      product_sku: v.productSku ?? null,
      requested_color: v.requestedColor,
      requested_size: v.requestedSize ?? null,
      quantity: v.quantity,
      customer_name: v.customerName,
      customer_email: v.customerEmail,
      customer_phone: v.customerPhone ?? null,
      note: v.note ?? null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not submit request.",
    };
  }
}
