"use server";

import { placeOrder, CheckoutError } from "@/application/use-cases/checkout";
import { getCheckoutDeps } from "@/infrastructure/supabase/order-service";
import { getCurrentUser } from "@/infrastructure/supabase/auth";
import { checkoutSchema } from "@/lib/validation";

export interface PlaceOrderResult {
  ok: boolean;
  orderId?: string;
  error?: string;
}

/** Server action: validate delivery details, place a pending order. */
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
      shipping: {
        name: input.name,
        email: user.email,
        phone: input.phone,
        address: input.address,
        city: input.city,
        state: input.state,
        country: input.country,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
      },
      lines: input.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        qty: i.qty,
      })),
    });
    return { ok: true, orderId };
  } catch (e) {
    const message =
      e instanceof CheckoutError
        ? e.message
        : "Could not place your order. Please try again.";
    return { ok: false, error: message };
  }
}
