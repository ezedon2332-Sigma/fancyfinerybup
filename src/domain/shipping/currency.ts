/**
 * Order currency policy.
 *
 * Every order is placed in NGN, worldwide. Catalogue prices are stored in NGN
 * minor units (kobo) and charged exactly as stored: there is no conversion
 * step, no exchange rate, and nothing to go stale.
 *
 * This used to convert non-Nigerian orders into USD at a live rate. That was
 * removed deliberately. A shopper may now *view* prices under another symbol
 * (see `domain/shared/display-price`), but that is presentation only — it never
 * reaches an order row, a payment, or a total. Keeping one authoritative
 * currency is what stops the price a customer sees from ever disagreeing with
 * the price they are charged.
 */

export type OrderCurrency = "NGN";

/** The one currency orders are ever placed in. */
export const ORDER_CURRENCY: OrderCurrency = "NGN";

export const DOMESTIC_COUNTRY = "NG";
