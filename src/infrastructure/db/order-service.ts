import "server-only";

import type { CheckoutDeps } from "@/application/use-cases/checkout";
import type { OrderRepository } from "@/domain/repositories/order-repository";
import { db } from "./client";
import { discountRedemptions } from "./schema";
import { createOrderRepository } from "./repositories/order-repository";
import { createProductRepository } from "./repositories/product-repository";
import { findDestination as findNgDestination } from "./nigeria-shipping-service";
import {
  defaultItemWeightGrams,
  findDiscountCode,
  isFirstOrder,
  loadPricingTable,
} from "./pricing-service";

/**
 * Deps for placing an order.
 *
 * Under Supabase this function juggled two clients: an RLS-scoped one for the
 * catalogue and a service-role one for order writes, because a customer holding
 * the publishable key could otherwise POST a forged order straight to PostgREST.
 * There is no PostgREST any more — the database is only reachable from server
 * code — so that split has no meaning here and one connection does both.
 *
 * What has NOT changed is the reason the split existed: `placeOrder` recomputes
 * every figure (subtotal, shipping, tax, total, unit prices) from the catalogue
 * and never trusts a number from the browser. That was the actual control; the
 * service-role client was only its enforcement mechanism.
 *
 * The pricing table is a thunk rather than a value so it is fetched at the
 * moment of the order — an admin changing a rate or a tax rule takes effect on
 * the very next checkout, with no cache to invalidate and no redeploy.
 */
export async function getCheckoutDeps(): Promise<CheckoutDeps> {
  return {
    products: createProductRepository(db),
    orders: createOrderRepository(db),
    pricing: loadPricingTable,
    defaultItemWeightGrams,
    findDiscountCode,
    isFirstOrder,
    findNgDestination,
    recordRedemption: async ({ codeId, orderId, userId, amountKobo }) => {
      await db.insert(discountRedemptions).values({
        codeId,
        orderId,
        userId,
        amountKobo,
      });
    },
  };
}

/** Order repository for the current request. */
export async function getOrderRepository(): Promise<OrderRepository> {
  return createOrderRepository(db);
}
