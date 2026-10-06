
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
  /** Tax charged, in minor units. Zero when the destination has no tax rule. */
  readonly tax: number;
  /** Discount applied, in minor units, as a POSITIVE amount to subtract. */
  readonly discount: number;
  /** The code that produced `discount`, for the receipt. */
  readonly discountCode: string | null;
  /** What the tax was called at checkout, e.g. "VAT (7.5%)". */
  readonly taxLabel: string | null;
  /**
   * Grand total in minor units: subtotal - discount + shippingCost + tax.
   *
   * These four parts were already stored per order but were not carried on the
   * entity, so a reader had to infer the breakdown from the total — and could
   * not, because one equation cannot separate tax from discount. They are
   * surfaced here so a receipt can state what was actually charged.
   */
  readonly total: number;
  readonly currency: string;
  readonly shippingMethod: string | null;
  /** Courier chosen at checkout, for the receipt and tracking screen. */
  readonly courierName: string | null;
  readonly estimatedMinDays: number | null;
  readonly estimatedMaxDays: number | null;
  readonly trackingNumber: string | null;
  readonly paystackReference: string | null;
  /** Provider-agnostic charge reference (Paystack ref or Stripe session id). */
  readonly paymentReference: string | null;
  /** 'unpaid' | 'paid' | 'failed' | 'refunded'. */
  readonly paymentStatus: PaymentStatus;
  /** 'paystack' | 'stripe' | null. */
  readonly paymentProvider: string | null;
  readonly paidAt: string | null;
  readonly shipping: ShippingDetails;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type PaymentStatus = "unpaid" | "paid" | "failed" | "refunded";

export interface OrderWithItems extends Order {
  readonly items: OrderItem[];
}
