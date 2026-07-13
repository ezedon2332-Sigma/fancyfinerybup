export type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled";

export interface ShippingDetails {
  readonly name: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly country: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
}

export interface OrderItem {
  readonly id: string;
  readonly productId: string | null;
  readonly variantId: string | null;
  /** Name captured at purchase time, so history is stable if the product changes. */
  readonly nameSnapshot: string;
  /** Unit price in minor units at purchase time. */
  readonly unitPrice: number;
  readonly qty: number;
}

export interface Order {
  readonly id: string;
  readonly userId: string;
  readonly status: OrderStatus;
  /** Total in minor units. */
  readonly total: number;
  readonly currency: string;
  readonly paystackReference: string | null;
  readonly shipping: ShippingDetails;
  readonly createdAt: string;
}

export interface OrderWithItems extends Order {
  readonly items: OrderItem[];
}
