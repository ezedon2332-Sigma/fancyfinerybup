"use server";

import { z } from "zod";

import { placeOrder, CheckoutError } from "@/application/use-cases/checkout";
import {
  getShippingQuote,
  ShippingError,
} from "@/application/use-cases/shipping";
import { getCheckoutDeps } from "@/infrastructure/supabase/order-service";
import { getCurrentUser } from "@/infrastructure/supabase/auth";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
import { notifyOrderPlaced } from "@/infrastructure/notifications/email";
import { checkoutSchema } from "@/lib/validation";
import type { ShippingQuote } from "@/domain/shipping/shipping";

export interface PlaceOrderResult {
  ok: boolean;
  orderId?: string;
  error?: string;
}

const cartLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  qty: z.number().int().positive().max(99),
});

const quoteSchema = z.object({
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine((c) => /^[A-Z]{2}$/.test(c), "Select a country"),
  items: z.array(cartLineSchema).min(1, "Your bag is empty"),
});

export interface QuoteResult {
  ok: boolean;
  quote?: ShippingQuote;
  error?: string;
}

/** Server action: live shipping quote. Subtotal is recomputed from the DB so
 *  the quote can't be manipulated from the client. */
export async function getShippingQuoteAction(
  payload: unknown,
): Promise<QuoteResult> {
  const parsed = quoteSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }
  try {
    const deps = await getCheckoutDeps();
    let subtotalNgn = 0;
    for (const line of parsed.data.items) {
      const product = await deps.products.findPublishedById(line.productId);
      if (product) subtotalNgn += product.price * line.qty;
    }
    const quote = await getShippingQuote(deps, {
      countryCode: parsed.data.countryCode,
      subtotalNgn,
    });
    return { ok: true, quote };
  } catch (e) {
    const message =
      e instanceof ShippingError ? e.message : "Could not calculate shipping.";
    return { ok: false, error: message };
  }
}

/** Server action: validate the full shipping address, place the order. */
export async function placeOrderAction(
  payload: unknown,
): Promise<PlaceOrderResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in to place an order." };

  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }
  const input = parsed.data;

  try {
    const deps = await getCheckoutDeps();
    const orderId = await placeOrder(deps, {
      userId: user.id,
      method: input.method,
      shipping: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        apartment: input.apartment ?? null,
        city: input.city,
        state: input.state,
        country: input.country,
        countryCode: input.countryCode,
        postal: input.postal,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
      },
      lines: input.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        qty: i.qty,
      })),
    });

    // Automatically remember the customer's shipping details for next time.
    try {
      const supabase = await createSupabaseServerClient();
      await supabase
        .from("profiles")
        .update({
          phone: input.phone,
          address: input.address,
          city: input.city,
          state: input.state,
          country: input.country,
        })
        .eq("id", user.id);
    } catch {
      /* non-fatal — the order is already placed */
    }

    // Shipping confirmation email (no-ops until an email provider is configured).
    await notifyOrderPlaced(orderId);

    return { ok: true, orderId };
  } catch (e) {
    const message =
      e instanceof CheckoutError
        ? e.message
        : "Could not place your order. Please try again.";
    return { ok: false, error: message };
  }
}
