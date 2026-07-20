import "server-only";

import type { CheckoutDeps } from "@/application/use-cases/checkout";
import type { OrderRepository } from "@/domain/repositories/order-repository";
import { createSupabaseServerClient } from "./server-client";
import { createOrderRepository } from "./repositories/order-repository";
import { createProductRepository } from "./repositories/product-repository";
import { createShippingRepository } from "./repositories/shipping-repository";

/** Deps for placing an order (product pricing + shipping + order writes), RLS-scoped. */
export async function getCheckoutDeps(): Promise<CheckoutDeps> {
  const client = await createSupabaseServerClient();
  return {
    products: createProductRepository(client),
    orders: createOrderRepository(client),
    shipping: createShippingRepository(client),
  };
}

/** Order repository bound to the current user's session (RLS-scoped). */
export async function getOrderRepository(): Promise<OrderRepository> {
  const client = await createSupabaseServerClient();
  return createOrderRepository(client);
}
