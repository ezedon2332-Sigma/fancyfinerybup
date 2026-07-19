/**
 * Shipping domain types — methods, per-country config, and computed quotes.
 * All monetary fields are NGN minor units (kobo); conversion to an order's
 * currency happens at quote/checkout time (see ./currency).
 */

import type { OrderCurrency } from "./currency";
import type { ShippingZone } from "./countries";

export type ShippingMethod = "standard" | "express";

export const SHIPPING_METHODS: ShippingMethod[] = ["standard", "express"];

/** Editable per-country shipping configuration (mirrors `shipping_countries`). */
export interface ShippingCountry {
  readonly code: string;
  readonly name: string;
  readonly zone: ShippingZone;
  readonly enabled: boolean;
  /** Standard shipping price in NGN kobo. */
  readonly standardPrice: number;
  readonly standardMinDays: number;
  readonly standardMaxDays: number;
  /** Express price in NGN kobo; null = express not offered to this country. */
  readonly expressPrice: number | null;
  readonly expressMinDays: number;
  readonly expressMaxDays: number;
  /**
   * Free shipping when the order's NGN subtotal is ≥ this many kobo.
   * null = no free-shipping threshold for this country.
   */
  readonly freeOver: number | null;
}

/** Global shipping settings (single row: exchange rate + toggles). */
export interface ShippingSettings {
  /** NGN per 1 USD, used to convert international orders. */
  readonly ngnPerUsd: number;
}

/** A computed shipping offer for one method, ready to display/charge. */
export interface ShippingQuoteOption {
  readonly method: ShippingMethod;
  /** Cost in the order's currency (minor units). */
  readonly cost: number;
  readonly currency: OrderCurrency;
  readonly minDays: number;
  readonly maxDays: number;
  /** True when this option is free (threshold met or price is 0). */
  readonly free: boolean;
}

/** The full quote for a destination: available options + currency context. */
export interface ShippingQuote {
  readonly countryCode: string;
  readonly countryName: string;
  readonly currency: OrderCurrency;
  /** Order subtotal converted into the order currency (minor units). */
  readonly subtotal: number;
  readonly options: ShippingQuoteOption[];
}
