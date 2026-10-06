import { CheckoutError, placeOrder } from "@/application/use-cases/checkout";
import { OutOfStockError } from "@/domain/repositories/order-repository";
import { getCheckoutDeps } from "@/infrastructure/db/order-service";
import { saveDeliveryAddress } from "@/infrastructure/db/profile-service";
import { notifyOrderPlaced } from "@/infrastructure/notifications/email";
import {
  isCurrencyPayable,
  providerForCurrency,
} from "@/infrastructure/payments/providers";
import { checkoutSchema } from "@/lib/validation";

import { jsonBody, requestCurrency, requireUser } from "../../../_lib/context";
import { fail, handler, ok } from "../../../_lib/respond";

/**
 * POST /api/mobile/v1/checkout/orders — place an order.
 *
 * Mirrors `placeOrderAction` exactly, including the part that is easy to miss:
 * the order confirmation email is sent here ONLY for a pay-on-delivery order.
 * An order that will be settled online is unpaid at this point — the customer
 * has not reached the provider's page yet — so mailing "we've received your
 * order" now would claim the purchase went through before any money moved, and
 * would still arrive if they abandoned the payment page. Those orders are
 * confirmed by `notifyPaymentReceived` once the charge actually clears.
 *
 * The response tells the client whether to proceed to payment rather than
 * leaving it to guess from the currency, so the app does not need its own copy
 * of the routing rules — which is exactly the knowledge that went stale when
 * Paystack stopped settling USD.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();

  const body = await jsonBody(req);
  if (body === null) return fail("invalid_request", "Expected a JSON body.");

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(
      "invalid_request",
      issue?.message ?? "Invalid details.",
      issue?.path.join("."),
    );
  }
  const input = parsed.data;
  const currency = await requestCurrency();

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

    // Remember the delivery details for next time, exactly as the web checkout
    // does. Non-fatal: the order is already placed and must not fail over this.
    try {
      await saveDeliveryAddress(user.id, {
        phone: input.phone,
        address: input.address,
        city: input.city,
        state: input.state,
        country: input.country,
      });
    } catch {
      /* ignored */
    }

    const payable = isCurrencyPayable(currency);
    if (!payable) {
      // Nothing left to pay online, so this order really is confirmed the
      // moment it is placed — and no payment-confirmation mail would ever
      // follow. It keeps the "order received" email.
      await notifyOrderPlaced(orderId);
    }

    return ok(
      {
        orderId,
        /** True → the app should call `/checkout/orders/{id}/pay` next. */
        requiresPayment: payable,
        paymentProvider: providerForCurrency(currency),
        currency,
      },
      { status: 201 },
    );
  } catch (e) {
    // Both of these name something the customer can act on — remove the line,
    // choose another size, fix an address — so they are surfaced verbatim
    // rather than flattened into "please try again".
    if (e instanceof OutOfStockError) return fail("out_of_stock", e.message);
    if (e instanceof CheckoutError) return fail("invalid_request", e.message);
    throw e;
  }
});
