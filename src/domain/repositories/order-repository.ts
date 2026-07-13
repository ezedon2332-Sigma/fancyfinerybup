import type { Order, OrderWithItems } from "../entities/order";

/** Port: order persistence, independent of Supabase. */
export interface OrderRepository {
  /** Orders belonging to a single user, newest first. */
  listByUser(userId: string): Promise<Order[]>;
  /** A single order with its line items (ownership enforced by the caller/RLS). */
  findById(id: string): Promise<OrderWithItems | null>;
}
