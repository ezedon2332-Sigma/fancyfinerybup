/**
 * Display-currency formatting.
 *
 * This is a PRESENTATION rule, not a currency conversion. Catalogue prices are
 * stored — and charged — in NGN minor units (kobo). Selecting another currency
 * only changes how that same stored price is *written*:
 *
 *   NGN  → the full stored price          ₦300,000
 *   else → the leading value + symbol     $300  €300  £300  ¥300
 *
 * "Leading value" means the naira amount with its thousands portion removed,
 * i.e. ₦300,000 reads as 300. There is deliberately no exchange rate anywhere
 * in this file: the number a shopper sees in USD is not claimed to be a dollar
 * conversion of the naira price, and nothing here talks to a rates API.
 */

export type DisplayCurrency = "NGN" | "USD" | "EUR" | "GBP" | "CNY";

export const DISPLAY_CURRENCIES = [
  "NGN",
  "USD",
  "EUR",
  "GBP",
  "CNY",
] as const satisfies readonly DisplayCurrency[];

export interface CurrencyMeta {
  symbol: string;
  name: string;
  /** Regional-indicator flag, for the selector. */
  flag: string;
}

export const CURRENCY_META: Record<DisplayCurrency, CurrencyMeta> = {
  NGN: { symbol: "₦", name: "Nigerian Naira", flag: "🇳🇬" },
  USD: { symbol: "$", name: "US Dollar", flag: "🇺🇸" },
  EUR: { symbol: "€", name: "Euro", flag: "🇪🇺" },
  GBP: { symbol: "£", name: "British Pound", flag: "🇬🇧" },
  CNY: { symbol: "¥", name: "Chinese Yuan", flag: "🇨🇳" },
};

/**
 * Cookie the chosen currency is persisted in. Lives here, not in the provider,
 * so the root layout can read it server-side — importing a value from a
 * "use client" module into a server component yields a client reference, not
 * the value itself.
 */
export const CURRENCY_COOKIE = "ff_currency";

export function isDisplayCurrency(v: unknown): v is DisplayCurrency {
  return (
    typeof v === "string" &&
    (DISPLAY_CURRENCIES as readonly string[]).includes(v)
  );
}

/** The step removed from a naira price to leave its leading value. */
const THOUSANDS = 1000;

/**
 * Strip the thousands portion from a naira amount (major units).
 *
 *   300,000 → 300          1,250,000 → 1,250          45,000 → 45
 *
 * Amounts below ₦1,000 have no thousands portion to remove, so they are
 * returned untouched — dividing them anyway would price a ₦500 item at under a
 * single unit, which is worse than leaving it alone.
 *
 * Truncates rather than rounds, so the displayed figure is never higher than
 * the rule implies (₦45,900 reads as 45, not 46).
 */
export function leadingValue(ngnMajor: number): number {
  if (!Number.isFinite(ngnMajor)) return 0;
  const abs = Math.abs(ngnMajor);
  if (abs < THOUSANDS) return ngnMajor;
  return Math.sign(ngnMajor) * Math.floor(abs / THOUSANDS);
}

/**
 * Render a number with grouping separators, showing decimals only when the
 * value actually has them — so ₦300,000 does not read as "₦300,000.00" while
 * a genuine ₦300,000.50 still shows its kobo.
 */
function group(value: number): string {
  // Both bounds move together: without the minimum, ₦300,000.50 would render
  // as "₦300,000.5" — which reads as five naira fifty, not fifty kobo.
  const digits = Math.abs(value % 1) > 1e-9 ? 2 : 0;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Format an NGN minor-unit (kobo) amount in the shopper's chosen display
 * currency.
 *
 * @param ngnMinor amount in kobo, as stored
 */
export function formatDisplayPrice(
  ngnMinor: number,
  currency: DisplayCurrency,
): string {
  const major = (Number.isFinite(ngnMinor) ? ngnMinor : 0) / 100;
  const { symbol } = CURRENCY_META[currency] ?? CURRENCY_META.NGN;

  // Naira shows the real, full, stored price — it is the price.
  const value = currency === "NGN" ? major : leadingValue(major);

  return value < 0 ? `-${symbol}${group(-value)}` : `${symbol}${group(value)}`;
}
