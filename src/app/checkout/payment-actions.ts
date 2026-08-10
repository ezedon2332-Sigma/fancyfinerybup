"use server";

import { getCurrentUser } from "@/infrastructure/supabase/auth";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import { paystackInitialize } from "@/infrastructure/payments/paystack";
import { stripeCreateCheckoutSession } from "@/infrastructure/payments/stripe";
import {
  onlinePaymentEnabled,
  providerForCurrency,
} from "@/infrastructure/payments/providers";
import { recordPaymentAttempt } from "@/infrastructure/payments/events";

export interface StartPaymentResult {
  ok: boolean;
  url?: string;
  error?: string;
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://fancyfinerybup.com"
  );
}

/** Begin online payment for an order and return the provider's redirect URL.
 *  Routes NGN/USD to Paystack and EUR/GBP to Stripe; if no live provider can
 *  settle the order's currency, it stays pay-on-delivery. */
export async function startPaymentAction(
  orderId: string,
): Promise<StartPaymentResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in to pay." };
  if (!onlinePaymentEnabled()) {
    return { ok: false, error: "Online payment isn't enabled yet." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, user_id, total, currency, payment_status, shipping_email")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) return { ok: false, error: "Order not found." };
  if (order.user_id !== user.id) return { ok: false, error: "Not your order." };
  if (order.payment_status === "paid") {
    return { ok: false, error: "This order is already paid." };
  }
  if (order.payment_status === "refunded") {
    return { ok: false, error: "This order has been refunded." };
  }

  const provider = providerForCurrency(order.currency);
  if (!provider) {
    return {
      ok: false,
      error: `Card payment isn't available for ${order.currency} orders. This order is payable on delivery.`,
    };
  }

  const email = order.shipping_email || user.email || "";

  // providerForCurrency's type spans providers that aren't implemented yet, but
  // it only ever returns one of these two — and the branch below already treats
  // "not paystack" as Stripe. Narrowing here keeps that assumption in one place
  // and lets the ledger record a precise provider.
  const settleWith: "paystack" | "stripe" =
    provider === "paystack" ? "paystack" : "stripe";

  try {
    let reference: string;
    let url: string;

    if (settleWith === "paystack") {
      reference = `FF-${order.id}-${Date.now().toString(36)}`;
      const init = await paystackInitialize({
        email,
        amountMinor: order.total,
        currency: order.currency,
        reference,
        callbackUrl: `${siteUrl()}/payment/callback`,
        metadata: { orderId: order.id },
        // Offer every channel the account allows — card, bank transfer, USSD,
        // QR, mobile money. The customer picks on Paystack's hosted page.
        channels: [
          "card",
          "bank",
          "bank_transfer",
          "ussd",
          "qr",
          "mobile_money",
          "eft",
        ],
      });
      url = init.authorizationUrl;
    } else {
      const session = await stripeCreateCheckoutSession({
        email,
        amountMinor: order.total,
        currency: order.currency,
        orderId: order.id,
        successUrl: `${siteUrl()}/payment/stripe/callback?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${siteUrl()}/account/orders/${order.id}?canceled=1`,
      });
      reference = session.id;
      url = session.url;
    }

    // Store the reference so the callback + webhook can match this charge.
    // Uses the service-role client because orders are admin-only for UPDATE
    // under RLS — a customer-context write would be silently filtered to zero
    // rows, leaving the charge unlinkable. Ownership was already checked above.
    // paystack_reference is mirrored for the paystack path (legacy + its unique
    // index); the generic payment_reference is the canonical lookup key.
    const admin = createSupabaseAdminClient();
    const { error: refError } = await admin
      .from("orders")
      .update({
        payment_reference: reference,
        payment_provider: settleWith,
        ...(settleWith === "paystack" ? { paystack_reference: reference } : {}),
      })
      .eq("id", order.id);
    if (refError) {
      return {
        ok: false,
        error: "Could not start payment. Please try again.",
      };
    }

    // Keep this attempt's reference on the ledger. The column above only holds
    // the newest one, so without this a charge completed on an earlier checkout
    // tab is invisible to the reconcile sweep. Best-effort: failing to log an
    // attempt must not stop the customer from paying.
    await recordPaymentAttempt({
      provider: settleWith,
      reference,
      orderId: order.id,
    });

    return { ok: true, url };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not start payment.",
    };
  }
}
