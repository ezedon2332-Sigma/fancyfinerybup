/**
 * Shipping domain types — methods, per-country config, and computed quotes.
 * All monetary fields are NGN minor units (kobo); conversion to an order's
 * currency happens at quote/checkout time (see ./currency).
 */

import type { OrderCurrency } from "./currency";
import type { ShippingZone } from "./countries";
import type { MoneyBreakdown, TaxDiscountConfig } from "./engine";

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

/** Global shipping settings (single row: exchange rate, tax, discount). */
export interface ShippingSettings {
  /** NGN per 1 USD, used to convert international orders. */
  readonly ngnPerUsd: number;
  readonly taxEnabled: boolean;
  /** Basis points — 7.5% is 750. Integer maths, no float drift. */
  readonly taxRateBps: number;
  readonly taxLabel: string;
  readonly discountEnabled: boolean;
  readonly discountBps: number;
  readonly discountLabel: string;
  /** Used for products with no weight recorded, so a gap over-estimates. */
  readonly defaultItemWeightGrams: number;
}

/** A computed shipping offer for one method, ready to display/charge.
 *  `method` is the method *code* — "standard"/"express" from the legacy table,
 *  or any admin-defined code such as "ups-express" from the rate engine. */
export interface ShippingQuoteOption {
  readonly method: string;
  /** Human label from the engine; legacy options fall back to the code. */
  readonly methodName?: string;
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
  /** Total cart weight the quote was priced on. */
  readonly weightGrams: number;
  /** Which weight bracket applied, when the rate engine priced this. */
  readonly bracketLabel: string | null;
  readonly zoneName: string | null;
  readonly options: ShippingQuoteOption[];
  /** Subtotal / shipping / discount / tax / grand total for the cheapest option. */
  readonly breakdown: MoneyBreakdown;
  /**
   * Tax and discount rules, sent so the checkout summary can recompute the
   * breakdown as the shopper switches method using the *same* pure function
   * the server uses. Rates only — never an amount the client could tamper
   * with, since the order is re-priced server-side at placement anyway.
   */
  readonly taxConfig: TaxDiscountConfig;
}
