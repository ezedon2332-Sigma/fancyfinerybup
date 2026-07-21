"use server";

import { getCurrentUser } from "@/infrastructure/supabase/auth";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
import {
  isPaystackEnabled,
  paystackInitialize,
} from "@/infrastructure/payments/paystack";

export interface StartPaymentResult {
  ok: boolean;
  url?: string;
  error?: string;
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://fancyfinerybup.vercel.app"
  );
}

/** Begin online payment for an order and return the provider's redirect URL.
 *  Only runs when a provider is configured; otherwise the order stays
 *  pay-on-delivery. */
export async function startPaymentAction(
  orderId: string,
): Promise<StartPaymentResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in to pay." };
  if (!isPaystackEnabled()) {
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

  const reference = `FF-${order.id}-${Date.now().toString(36)}`;
  try {
    const { authorizationUrl } = await paystackInitialize({
      email: order.shipping_email || user.email || "",
      amountMinor: order.total,
      currency: order.currency,
      reference,
      callbackUrl: `${siteUrl()}/payment/callback`,
      metadata: { orderId: order.id },
    });

    // Store the reference so the callback/webhook can match this charge.
    await supabase
      .from("orders")
      .update({ paystack_reference: reference, payment_provider: "paystack" })
      .eq("id", order.id);

    return { ok: true, url: authorizationUrl };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not start payment.",
    };
  }
}
