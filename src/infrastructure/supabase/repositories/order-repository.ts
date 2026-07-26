import type { SupabaseClient } from "@supabase/supabase-js";

import type { Order, OrderWithItems } from "@/domain/entities/order";
import type {
  NewOrder,
  OrderRepository,
} from "@/domain/repositories/order-repository";
import type { Database } from "../database.types";
import { toOrder, toOrderWithItems } from "../mappers";

/** PostgREST schema-cache miss (PGRST204) or Postgres "undefined column". */
function isUnknownColumn(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /column .* does not exist/i.test(error.message ?? "")
  );
}

export function createOrderRepository(
  client: SupabaseClient<Database>,
): OrderRepository {
  return {
    async create(input: NewOrder): Promise<string> {
      const base = {
        user_id: input.userId,
        status: "processing" as const,
        subtotal: input.subtotal,
        shipping_cost: input.shippingCost,
        total: input.total,
        currency: input.currency,
        shipping_method: input.shippingMethod,
        shipping_name: input.shipping.name,
        shipping_email: input.shipping.email,
        shipping_phone: input.shipping.phone,
        shipping_address: input.shipping.address,
        shipping_apartment: input.shipping.apartment,
        shipping_city: input.shipping.city,
        shipping_state: input.shipping.state,
        shipping_country: input.shipping.country,
        shipping_country_code: input.shipping.countryCode,
        shipping_postal: input.shipping.postal,
        shipping_lat: input.shipping.lat,
        shipping_lng: input.shipping.lng,
      };

      // tax / discount / total_weight_grams arrive with the shipping-engine
      // migration. If the deploy lands before the migration is applied, retry
      // without them rather than failing the sale — the grand total is already
      // correct in `total`, so the only loss is the itemised breakdown.
      let { data: order, error } = await client
        .from("orders")
        .insert({
          ...base,
          tax: input.tax,
          discount: input.discount,
          total_weight_grams: input.totalWeightGrams,
        })
        .select("id")
        .single();

      if (error && isUnknownColumn(error)) {
        console.warn(
          "[orders] tax/discount columns missing — apply the shipping-engine migration",
        );
        ({ data: order, error } = await client
          .from("orders")
          .insert(base)
          .select("id")
          .single());
      }
      if (error) throw error;
      if (!order) throw new Error("Order insert returned no row.");

      const items = input.items.map((it) => ({
        order_id: order.id,
        product_id: it.productId,
        variant_id: it.variantId,
        name_snapshot: it.nameSnapshot,
        unit_price: it.unitPrice,
        qty: it.qty,
      }));
      const { error: itemsError } = await client
        .from("order_items")
        .insert(items);
      if (itemsError) throw itemsError;

      return order.id;
    },

    async listByUser(userId: string): Promise<Order[]> {
      const { data, error } = await client
        .from("orders")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toOrder);
    },

    async findById(id: string): Promise<OrderWithItems | null> {
      const { data, error } = await client
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? toOrderWithItems(data) : null;
    },
  };
}
