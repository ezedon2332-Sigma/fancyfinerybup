import type {
  Order,
  OrderWithItems,
  ShippingDetails,
} from "@/domain/entities/order";

export interface NewOrderItem {
  productId: string;
  variantId: string | null;
  nameSnapshot: string;
  unitPrice: number; // minor units
  qty: number;
}

export interface NewOrder {
  userId: string;
  currency: string;
  total: number; // minor units
  shipping: ShippingDetails;
  items: NewOrderItem[];
}

/** Port: order persistence, independent of Supabase. */
export interface OrderRepository {
  /** Create a pending order with its line items. Returns the new order id. */
  create(input: NewOrder): Promise<string>;
  /** Orders belonging to a single user, newest first. */
  listByUser(userId: string): Promise<Order[]>;
  /** A single order with its line items (ownership enforced by the caller/RLS). */
  findById(id: string): Promise<OrderWithItems | null>;
}
