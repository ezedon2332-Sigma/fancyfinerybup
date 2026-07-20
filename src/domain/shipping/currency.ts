/**
 * Multi-currency policy for worldwide shipping.
 *
 * All catalogue prices are stored in NGN minor units (kobo) — that never
 * changes. An *order's* currency is decided by its destination:
 *   - Nigeria (NG)  → NGN (charged/displayed in Naira)
 *   - everywhere else → USD (converted from NGN at a configurable rate)
 *
 * Conversion is integer-safe: NGN kobo ÷ (NGN per USD) = USD cents, because
 * both sides are ×100 minor units. e.g. ₦450,000 (45_000_000 kobo) ÷ 1600 =
 * 28_125 cents = $281.25.
 */

export type OrderCurrency = "NGN" | "USD";

/** Fallback exchange rate (NGN per 1 USD) if the DB setting is unavailable. */
export const DEFAULT_NGN_PER_USD = 1600;

export const DOMESTIC_COUNTRY = "NG";

/** The currency an order to `countryCode` is charged/displayed in. */
export function orderCurrencyForCountry(
  countryCode: string | null | undefined,
): OrderCurrency {
  return (countryCode ?? "").trim().toUpperCase() === DOMESTIC_COUNTRY
    ? "NGN"
    : "USD";
}

/**
 * Convert an amount in NGN minor units (kobo) into `currency` minor units.
 * Returns kobo unchanged for NGN; rounds to whole USD cents otherwise.
 */
export function convertFromNgnMinor(
  ngnMinor: number,
  currency: OrderCurrency,
  ngnPerUsd: number = DEFAULT_NGN_PER_USD,
): number {
  if (currency === "NGN") return ngnMinor;
  const rate = ngnPerUsd > 0 ? ngnPerUsd : DEFAULT_NGN_PER_USD;
  return Math.round(ngnMinor / rate);
}
