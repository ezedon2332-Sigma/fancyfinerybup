"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
import { ORDER_STATUSES, type OrderStatus } from "@/domain/entities/order";
import { generateTrackingNumber } from "@/domain/shipping/tracking";
import { isShipped } from "@/lib/order-status";
import { notifyOrderStatusChanged } from "@/infrastructure/notifications/email";
import { paystackRefund } from "@/infrastructure/payments/paystack";
import { stripeRefundBySession } from "@/infrastructure/payments/stripe";

const statusSchema = z.enum(ORDER_STATUSES as unknown as [string, ...string[]]);

export interface OrderActionResult {
  ok: boolean;
  error?: string;
}

export async function updateOrderStatus(
  id: string,
  status: string,
): Promise<OrderActionResult> {
  await requireAdmin();
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Invalid status." };
  const nextStatus = parsed.data as OrderStatus;

  const supabase = await createSupabaseServerClient();

  // Only generate a tracking number once, on the first transition into shipping.
  const { data: existing } = await supabase
    .from("orders")
    .select("tracking_number")
    .eq("id", id)
    .maybeSingle();

  const needsTracking = isShipped(nextStatus) && !existing?.tracking_number;

  if (needsTracking) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await supabase
        .from("orders")
        .update({ status: nextStatus, tracking_number: generateTrackingNumber() })
        .eq("id", id);
      if (!error) break;
      const collision = /tracking_number|duplicate|unique/i.test(error.message);
      if (!collision) return { ok: false, error: error.message };
      if (attempt === 4) {
        return { ok: false, error: "Could not assign a tracking number. Try again." };
      }
    }
  } else {
    const { error } = await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  }

  await notifyOrderStatusChanged(id, nextStatus);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/account/orders");
  return { ok: true };
}

/**
 * Refund a paid order in full through its original provider, then mark it
 * refunded. Admin-gated. The status write is guarded on `payment_status = paid`
 * so a double-click can't fire two refunds against the same charge.
 */
export async function refundOrder(id: string): Promise<OrderActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, payment_status, payment_provider, payment_reference")
    .eq("id", id)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found." };
  if (order.payment_status !== "paid") {
    return { ok: false, error: "Only a paid order can be refunded." };
  }
  if (!order.payment_reference || !order.payment_provider) {
    return { ok: false, error: "No charge reference on this order." };
  }

  // Claim the refund in the DB BEFORE moving money: flip paid → refunded
  // conditionally, so a concurrent second click finds the row already
  // not-paid and cannot fire a second provider refund against the same charge.
  const { data: claimed, error: claimError } = await supabase
    .from("orders")
    .update({ payment_status: "refunded" })
    .eq("id", id)
    .eq("payment_status", "paid")
    .select("id");
  if (claimError) return { ok: false, error: claimError.message };
  if (!claimed || claimed.length === 0) {
    return { ok: false, error: "Order is no longer refundable." };
  }

  // Helper to undo the claim if the provider call fails, so it can be retried.
  const revert = () =>
    supabase
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", id)
      .eq("payment_status", "refunded");

  try {
    if (order.payment_provider === "paystack") {
      await paystackRefund(order.payment_reference);
    } else if (order.payment_provider === "stripe") {
      await stripeRefundBySession(order.payment_reference);
    } else {
      await revert();
      return {
        ok: false,
        error: `Unknown payment provider: ${order.payment_provider}`,
      };
    }
  } catch (e) {
    await revert();
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Refund failed at the provider.",
    };
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/account/orders");
  return { ok: true };
}
