import type { SupabaseClient } from "@supabase/supabase-js";

import type { Order, OrderWithItems } from "@/domain/entities/order";
import type {
  NewOrder,
  OrderRepository,
} from "@/domain/repositories/order-repository";
import type { Database } from "../database.types";
import { toOrder, toOrderWithItems } from "../mappers";

export function createOrderRepository(
  client: SupabaseClient<Database>,
): OrderRepository {
  return {
    async create(input: NewOrder): Promise<string> {
      const { data: order, error } = await client
        .from("orders")
        .insert({
          user_id: input.userId,
          status: "pending",
          total: input.total,
          currency: input.currency,
          shipping_name: input.shipping.name,
          shipping_email: input.shipping.email,
          shipping_phone: input.shipping.phone,
          shipping_address: input.shipping.address,
          shipping_city: input.shipping.city,
          shipping_state: input.shipping.state,
          shipping_country: input.shipping.country,
          shipping_lat: input.shipping.lat,
          shipping_lng: input.shipping.lng,
        })
        .select("id")
        .single();
      if (error) throw error;

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
