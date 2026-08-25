"use server";

import { placeOrder, CheckoutError } from "@/application/use-cases/checkout";
import { getCheckoutDeps } from "@/infrastructure/db/order-service";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { eq } from "drizzle-orm";

import { db } from "@/infrastructure/db/client";
import { profiles } from "@/infrastructure/db/schema";
import { notifyOrderPlaced } from "@/infrastructure/notifications/email";
import { OutOfStockError } from "@/domain/repositories/order-repository";
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
      // Scoped to the signed-in user's own id. The old RLS policy
      // (profiles_update_self_or_admin) is what made that true before.
      await db
        .update(profiles)
        .set({
          phone: input.phone,
          address: input.address,
          city: input.city,
          state: input.state,
          country: input.country,
        })
        .where(eq(profiles.id, user.id));
    } catch {
      /* non-fatal — the order is already placed */
    }

    // Shipping confirmation email (no-ops until an email provider is configured).
    await notifyOrderPlaced(orderId);

    return { ok: true, orderId };
  } catch (e) {
    // OutOfStockError is thrown by the repository when the conditional stock
    // decrement matches no rows — someone else took the last one between this
    // basket being priced and being written. It carries the item name, and the
    // customer can act on it (remove the line, choose another size), so it is
    // surfaced verbatim rather than flattened into "please try again".
    const message =
      e instanceof OutOfStockError || e instanceof CheckoutError
        ? e.message
        : "Could not place your order. Please try again.";
    return { ok: false, error: message };
  }
}
