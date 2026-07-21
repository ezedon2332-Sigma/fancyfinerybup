import "server-only";

import { isPaystackEnabled } from "./paystack";

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
      configured: Boolean(process.env.STRIPE_SECRET_KEY),
      implemented: false,
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
