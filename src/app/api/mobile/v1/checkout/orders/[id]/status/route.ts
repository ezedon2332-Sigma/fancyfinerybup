import { getOrderRepository } from "@/infrastructure/db/order-service";

import { requireUser } from "../../../../../_lib/context";
import { fail, handler, ok } from "../../../../../_lib/respond";

/**
 * GET /api/mobile/v1/checkout/orders/[id]/status
 *
 * A deliberately tiny response for the one thing the app polls: did the charge
 * clear? The customer returns from the provider's hosted page and the app asks
 * this every couple of seconds for a short window.
 *
 * It exists separately from the full order endpoint because that one carries
 * every line item and the whole address, which is a wasteful payload to fetch
 * repeatedly on a phone network to read a single enum.
 *
 * Polling is the right mechanism rather than a weakness: settlement is
 * confirmed by the provider's webhook, with the nightly reconcile sweep behind
 * it, so an order becomes paid whether or not the app ever asks. This only
 * decides how quickly the screen notices.
 */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;

    const repo = await getOrderRepository();
    const order = await repo.findByIdForUser(id, user.id);
    if (!order) return fail("not_found", "Order not found.");

    return ok({
      orderId: order.id,
      paymentStatus: order.paymentStatus,
      status: order.status,
      paidAt: order.paidAt,
    });
  },
);
