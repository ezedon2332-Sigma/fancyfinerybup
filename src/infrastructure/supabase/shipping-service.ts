import "server-only";

import type { ShippingRepository } from "@/domain/repositories/shipping-repository";
import { createSupabaseServerClient } from "./server-client";
import { createShippingRepository } from "./repositories/shipping-repository";

/** Shipping repository bound to the current session (RLS: public read, admin write). */
export async function getShippingRepository(): Promise<ShippingRepository> {
  const client = await createSupabaseServerClient();
  return createShippingRepository(client);
}
