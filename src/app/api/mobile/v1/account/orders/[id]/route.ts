import { getOrderRepository } from "@/infrastructure/db/order-service";
import { isCurrencyPayable } from "@/infrastructure/payments/providers";

import { requireUser } from "../../../../_lib/context";
import { orderDetailDto } from "../../../../_lib/dto";
import { fail, handler, ok } from "../../../../_lib/respond";

/**
 * GET /api/mobile/v1/account/orders/[id] — one order, with its line items.
 *
 * `findByIdForUser` returns null both when the order does not exist and when it
 * belongs to somebody else, and the caller cannot tell which. That is the
 * point: a 404 either way means an order id cannot be probed for existence.
 */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;

    const repo = await getOrderRepository();
    const order = await repo.findByIdForUser(id, user.id);
    if (!order) return fail("not_found", "Order not found.");

    const payable =
      order.paymentStatus === "unpaid" && isCurrencyPayable(order.currency);

    return ok({ order: orderDetailDto(order, payable) });
  },
);

/**
 * DELETE /api/mobile/v1/account/orders/[id] — cancel an unpaid order.
 *
 * `cancelUnpaidForUser` carries all four conditions — right owner, right order,
 * not paid, not already progressed — in a single conditional statement, so the
 * database decides once. A read-then-write here would leave a window in which a
 * payment lands between the check and the update, cancelling an order the
 * customer has just been charged for.
 *
 * Stock goes back on the shelf only if a row actually changed, and
 * `restoreStock` is idempotent per order, so a retried request cannot credit
 * inventory twice.
 */
export const DELETE = handler(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;

    const repo = await getOrderRepository();
    const cancelled = await repo.cancelUnpaidForUser(id, user.id);
    if (!cancelled) {
      return fail(
        "conflict",
        "This order can no longer be cancelled. If it has already been paid, contact us and we'll sort it out.",
      );
    }

    await repo.restoreStock(id);
    return ok({ cancelled: true });
  },
);
