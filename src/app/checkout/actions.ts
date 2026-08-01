"use server";

import { placeOrder, CheckoutError } from "@/application/use-cases/checkout";
import { getCheckoutDeps } from "@/infrastructure/supabase/order-service";
import { getCurrentUser } from "@/infrastructure/supabase/auth";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
import { notifyOrderPlaced } from "@/infrastructure/notifications/email";
import { checkoutSchema } from "@/lib/validation";
import { cookies } from "next/headers";
import {
  CURRENCY_COOKIE,
  isDisplayCurrency,
} from "@/domain/shared/display-price";
import { DEFAULT_ORDER_CURRENCY } from "@/domain/shipping/currency";

export interface PlaceOrderResult {
  ok: boolean;
  orderId?: string;
  error?: string;
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

  // Read server-side rather than accepting it from the form: the currency
  // decides what the customer is charged, so it comes from the same place the
  // prices they browsed were rendered from.
  const cookieCurrency = (await cookies()).get(CURRENCY_COOKIE)?.value;
  const currency = isDisplayCurrency(cookieCurrency)
    ? cookieCurrency
    : DEFAULT_ORDER_CURRENCY;

  try {
    const deps = await getCheckoutDeps();
    const orderId = await placeOrder(deps, {
      userId: user.id,
      courierId: input.courierId ?? null,
      couponCode: input.couponCode ?? null,
      ngDestinationId: input.ngDestinationId ?? null,
      currency,
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
