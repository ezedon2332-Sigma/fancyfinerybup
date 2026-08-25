"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/infrastructure/auth/session";
import { and, eq } from "drizzle-orm";

import { db } from "@/infrastructure/db/client";
import { orders } from "@/infrastructure/db/schema";
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

  // Only generate a tracking number once, on the first transition into shipping.
  const existing = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    columns: { trackingNumber: true },
  });
  if (!existing) return { ok: false, error: "Order not found." };

  const needsTracking = isShipped(nextStatus) && !existing.trackingNumber;

  if (needsTracking) {
    // Retry on the unique-index collision a generated number can hit.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await db
          .update(orders)
          .set({ status: nextStatus, trackingNumber: generateTrackingNumber() })
          .where(eq(orders.id, id));
        break;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (!/tracking_number|duplicate|unique/i.test(message)) {
          return { ok: false, error: message };
        }
        if (attempt === 4) {
          return { ok: false, error: "Could not assign a tracking number. Try again." };
        }
      }
    }
  } else {
    try {
      await db.update(orders).set({ status: nextStatus }).where(eq(orders.id, id));
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Cancelling from the admin side must return stock exactly as the customer
  // path does — restoreStock is idempotent, so the two cannot double-credit.
  if (nextStatus === "cancelled") {
    try {
      const { getOrderRepository } = await import(
        "@/infrastructure/db/order-service"
      );
      await (await getOrderRepository()).restoreStock(id);
    } catch (e) {
      // The status change already succeeded; a stock-restore failure is worth
      // knowing about but must not report the cancellation as failed.
      console.error("[orders] stock restore failed", { id, error: e });
    }
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

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    columns: {
      id: true,
      paymentStatus: true,
      paymentProvider: true,
      paymentReference: true,
    },
  });
  if (!order) return { ok: false, error: "Order not found." };
  if (order.paymentStatus !== "paid") {
    return { ok: false, error: "Only a paid order can be refunded." };
  }
  if (!order.paymentReference || !order.paymentProvider) {
    return { ok: false, error: "No charge reference on this order." };
  }

  // Claim the refund in the DB BEFORE moving money: flip paid → refunded
  // conditionally, so a concurrent second click finds the row already
  // not-paid and cannot fire a second provider refund against the same charge.
  let claimed;
  try {
    claimed = await db
      .update(orders)
      .set({ paymentStatus: "refunded" })
      .where(and(eq(orders.id, id), eq(orders.paymentStatus, "paid")))
      .returning({ id: orders.id });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (claimed.length === 0) {
    return { ok: false, error: "Order is no longer refundable." };
  }

  // Helper to undo the claim if the provider call fails, so it can be retried.
  const revert = () =>
    db
      .update(orders)
      .set({ paymentStatus: "paid" })
      .where(and(eq(orders.id, id), eq(orders.paymentStatus, "refunded")));

  try {
    if (order.paymentProvider === "paystack") {
      await paystackRefund(order.paymentReference);
    } else if (order.paymentProvider === "stripe") {
      await stripeRefundBySession(order.paymentReference);
    } else {
      await revert();
      return {
        ok: false,
        error: `Unknown payment provider: ${order.paymentProvider}`,
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
