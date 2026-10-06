import { getOrderRepository } from "@/infrastructure/db/order-service";
import { isCurrencyPayable } from "@/infrastructure/payments/providers";

import { requireUser } from "../../../_lib/context";
import { orderSummaryDto } from "../../../_lib/dto";
import { handler, ok } from "../../../_lib/respond";

/**
 * GET /api/mobile/v1/account/orders — the signed-in customer's order history.
 *
 * `listByUser` is scoped to the id it is given, and that id comes from the
 * session. There is no query parameter for it, so no request can ask for
 * somebody else's orders.
 */
export const GET = handler(async () => {
  const user = await requireUser();
  const repo = await getOrderRepository();
  const orders = await repo.listByUser(user.id);

  return ok({
    items: orders.map((order) =>
      orderSummaryDto(
        order,
        // The list read model carries no line items, so the per-order item
        // count is not available without a second query per row. The app shows
        // a total, not a count, on this screen; the detail screen has both.
        0,
        order.paymentStatus === "unpaid" && isCurrencyPayable(order.currency),
      ),
    ),
  });
});
