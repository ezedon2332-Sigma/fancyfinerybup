/**
 * Money is always represented as an integer number of MINOR units (e.g. kobo
 * for NGN, cents for USD) to avoid floating-point rounding errors. Formatting
 * to a human string happens only at the presentation edge.
 */
export interface Money {
  /** Integer amount in minor units (e.g. ₦1,500.00 -> 150000). */
  readonly amount: number;
  /** ISO 4217 currency code, e.g. "NGN". */
  readonly currency: string;
}

export function money(amount: number, currency = "NGN"): Money {
  if (!Number.isInteger(amount)) {
    throw new Error(`Money amount must be an integer (minor units): ${amount}`);
  }
  return { amount, currency };
}

/** Format minor units for display, e.g. formatMoney(150000, "NGN") -> "₦1,500.00". */
export function formatMoney(amount: number, currency = "NGN"): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
  }).format(amount / 100);
}
