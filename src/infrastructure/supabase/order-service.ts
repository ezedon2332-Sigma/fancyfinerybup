import "server-only";

import type { CheckoutDeps } from "@/application/use-cases/checkout";
import type { OrderRepository } from "@/domain/repositories/order-repository";
import { createSupabaseServerClient } from "./server-client";
import { createOrderRepository } from "./repositories/order-repository";
import { createProductRepository } from "./repositories/product-repository";
import { createSupabaseAdminClient } from "./admin-client";
import {
  defaultItemWeightGrams,
  findDiscountCode,
  isFirstOrder,
  loadPricingTable,
} from "./pricing-service";

/**
 * Deps for placing an order. Catalogue and order writes stay RLS-scoped to the
 * signed-in customer; rate, tax and discount reads use the service role, since
 * those tables are deliberately not readable from the browser.
 *
 * The pricing table is a thunk rather than a value so it is fetched at the
 * moment of the order — an admin changing a rate or a tax rule takes effect on
 * the very next checkout, with no cache to invalidate and no redeploy.
 */
export async function getCheckoutDeps(): Promise<CheckoutDeps> {
  const client = await createSupabaseServerClient();
  return {
    products: createProductRepository(client),
    orders: createOrderRepository(client),
    pricing: loadPricingTable,
    defaultItemWeightGrams,
    findDiscountCode,
    isFirstOrder,
    recordRedemption: async ({ codeId, orderId, userId, amountKobo }) => {
      const admin = createSupabaseAdminClient();
      await admin.from("discount_redemptions").insert({
        code_id: codeId,
        order_id: orderId,
        user_id: userId,
        amount_kobo: amountKobo,
      });
    },
  };
}

/** Order repository bound to the current user's session (RLS-scoped). */
export async function getOrderRepository(): Promise<OrderRepository> {
  const client = await createSupabaseServerClient();
  return createOrderRepository(client);
}
