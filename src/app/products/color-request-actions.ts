"use server";

import { headers } from "next/headers";

import { db } from "@/infrastructure/db/client";
import { colorRequests } from "@/infrastructure/db/schema";
import { colorRequestSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/ai-rate-limit";

export interface ColorRequestResult {
  ok: boolean;
  error?: string;
}

/**
 * Public: submit an on-demand colour request.
 *
 * Runs entirely server-side, so the color_requests table — which holds customer
 * PII — is never reachable from the browser. That used to be true because the
 * write went through the service-role key; it is now true because there is no
 * browser-facing database API at all.
 */
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
    await db.insert(colorRequests).values({
      productId: v.productId ?? null,
      productName: v.productName,
      productSku: v.productSku ?? null,
      requestedColor: v.requestedColor,
      requestedSize: v.requestedSize ?? null,
      quantity: v.quantity,
      customerName: v.customerName,
      customerEmail: v.customerEmail,
      customerPhone: v.customerPhone ?? null,
      note: v.note ?? null,
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not submit request.",
    };
  }
}
