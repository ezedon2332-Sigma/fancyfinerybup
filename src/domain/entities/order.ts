
/** Fulfilment lifecycle. Legacy values are remapped by migration, so live data
 *  only ever carries one of these. */
export type OrderStatus =
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

export interface ShippingDetails {
  readonly name: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  /** Apartment / suite (optional). */
  readonly apartment: string | null;
  readonly city: string | null;
  readonly state: string | null;
  /** Display country name. */
  readonly country: string | null;
  /** ISO 3166-1 alpha-2 code — the authoritative country reference. */
  readonly countryCode: string | null;
  /** ZIP / postal code. */
  readonly postal: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
}

export interface OrderItem {
  readonly id: string;
  readonly productId: string | null;
  readonly variantId: string | null;
  /** Name captured at purchase time, so history is stable if the product changes. */
  readonly nameSnapshot: string;
  /** Unit price in minor units at purchase time (in the order's currency). */
  readonly unitPrice: number;
  readonly qty: number;
}

export interface Order {
  readonly id: string;
  readonly userId: string;
  readonly status: OrderStatus;
  /** Items subtotal in minor units (order currency). */
  readonly subtotal: number;
  /** Shipping cost in minor units (order currency). */
  readonly shippingCost: number;
  /** Grand total in minor units (subtotal + shippingCost). */
  readonly total: number;
  readonly currency: string;
  readonly shippingMethod: string | null;
  readonly trackingNumber: string | null;
  readonly paystackReference: string | null;
  readonly shipping: ShippingDetails;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OrderWithItems extends Order {
  readonly items: OrderItem[];
}
