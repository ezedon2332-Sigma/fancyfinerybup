"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/infrastructure/auth/session";
import { getOrderRepository } from "@/infrastructure/db/order-service";

export interface CancelOrderResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/**
 * Let a customer cancel their own unpaid order.
 *
 * The authorization is the `userId` argument, not a check above it: the
 * repository's predicate matches the order id AND the owner in one statement,
 * so a customer passing someone else's order id changes nothing and is told the
 * same thing as if the id were nonsense. There is deliberately no separate
 * "does this belong to you" read — that would be a second query whose answer
 * could be stale by the time the write ran.
 *
 * Cancellable means: not paid (unpaid or failed) and still `processing`. Once a
 * charge has cleared, cancelling is a refund and belongs with the team; once it
 * is packed or shipped, it is physically in motion.
 */
export async function cancelOrder(orderId: string): Promise<CancelOrderResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return { ok: false, error: "Invalid order." };
  }

  let cancelled = false;
  try {
    const orders = await getOrderRepository();
    cancelled = await orders.cancelUnpaidForUser(orderId, user.id);
    // Placing the order took the stock; cancelling puts it back, or the item
    // stays invisible on the storefront while sitting on the shelf.
    if (cancelled) await orders.restoreStock(orderId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  if (!cancelled) {
    // One message for "not yours", "already paid" and "already shipped". The
    // customer only ever sees their own orders, so the distinction that matters
    // to them is the actionable one.
    return {
      ok: false,
      error:
        "This order can no longer be cancelled. If you have been charged, contact us for a refund.",
    };
  }

  revalidatePath("/account");
  revalidatePath(`/account/orders/${orderId}`);
  return { ok: true, message: "Order cancelled." };
}
