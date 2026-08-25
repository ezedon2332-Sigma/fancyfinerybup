import "server-only";

import { isPaystackEnabled, paystackSupportsCurrency } from "./paystack";
import { isStripeEnabled, stripeSupportsCurrency } from "./stripe";

/**
 * Pluggable payment-provider registry. A provider becomes selectable at
 * checkout only when it is BOTH implemented AND its keys are configured — so
 * new providers can be added here as they're built without touching checkout.
 *
 * Apple Pay & Google Pay are delivered through a card processor (Stripe, or
 * Paystack/Flutterwave), not as standalone entries.
 */
export type PaymentProviderId =
  | "paystack"
  | "stripe"
  | "flutterwave"
  | "paypal";

export interface PaymentProviderInfo {
  id: PaymentProviderId;
  label: string;
  /** Configured (keys present). */
  configured: boolean;
  /** Implemented in code (has an initialize/verify flow). */
  implemented: boolean;
}

export function paymentProviders(): PaymentProviderInfo[] {
  return [
    {
      id: "paystack",
      label: "Card, Bank, USSD, Apple/Google Pay (Paystack)",
      configured: isPaystackEnabled(),
      implemented: true,
    },
    {
      id: "stripe",
      label: "Card · Apple Pay · Google Pay (Stripe)",
      configured: isStripeEnabled(),
      implemented: true,
    },
    {
      id: "flutterwave",
      label: "Card / Mobile Money (Flutterwave)",
      configured: Boolean(process.env.FLUTTERWAVE_SECRET_KEY),
      implemented: false,
    },
    {
      id: "paypal",
      label: "PayPal",
      configured: Boolean(process.env.PAYPAL_CLIENT_SECRET),
      implemented: false,
    },
  ];
}

/** Providers a customer can actually pay with right now. */
export function activePaymentProviders(): PaymentProviderInfo[] {
  return paymentProviders().filter((p) => p.configured && p.implemented);
}

export function onlinePaymentEnabled(): boolean {
  return activePaymentProviders().length > 0;
}

/**
 * Which active provider should settle a charge in `currency`.
 *
 * The storefront charges in the currency the shopper chose. Paystack settles
 * NGN and USD; Stripe covers EUR and GBP (the two Paystack cannot take). The
 * preferred routing encodes that split, then falls back to whichever single
 * provider is live and supports the currency — so the store still takes payment
 * if only one of the two is configured. Returns null when no live provider can
 * settle the currency, in which case the order stays pay-on-delivery.
 */
export function providerForCurrency(currency: string): PaymentProviderId | null {
  const cur = currency.trim().toUpperCase();
  const paystackOk = isPaystackEnabled() && paystackSupportsCurrency(cur);
  const stripeOk = isStripeEnabled() && stripeSupportsCurrency(cur);

  // Paystack first for EVERY currency it settles — NGN, USD, GHS, ZAR, KES.
  //
  // This used to name NGN and USD explicitly and let the other three arrive by
  // falling through the Stripe branch below. Same outcome, but the rule was
  // invisible: someone adding a currency to PAYSTACK_CURRENCIES would have had
  // no way to tell whether routing followed. It is one condition now, and the
  // supported set is the single source of truth.
  if (paystackOk) return "paystack";

  // Stripe covers what Paystack cannot settle (EUR, GBP).
  if (stripeOk) return "stripe";

  // Neither provider takes this currency, or neither is configured. The order
  // stays pay-on-delivery rather than failing at the redirect with a provider
  // error the customer cannot act on.
  return null;
}

/** Whether an online charge can be started for `currency` right now. */
export function isCurrencyPayable(currency: string): boolean {
  return providerForCurrency(currency) !== null;
}
