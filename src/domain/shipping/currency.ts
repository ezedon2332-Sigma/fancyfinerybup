/**
 * Order currency policy.
 *
 * The currency a shopper selects in the header is the currency they are
 * charged in. There is no exchange rate: a stored naira price is re-expressed
 * by the leading-value rule in `domain/shared/display-price`, and that same
 * function produces both the figure on the price tag and the figure on the
 * order — ₦300,000 is shown as $300 and charged as $300.
 *
 * Everything here exists to keep the arithmetic honest once the currency
 * changes: line items, thresholds and discount ceilings are all stored in
 * naira, and each needs converting at the right moment or a summary stops
 * adding up.
 */

import {
  priceInMinor,
  type DisplayCurrency,
} from "@/domain/shared/display-price";
import type { DiscountCode } from "./pricing";

export type OrderCurrency = DisplayCurrency;

/** Used when a request carries no valid currency of its own. */
export const DEFAULT_ORDER_CURRENCY: OrderCurrency = "NGN";

export const DOMESTIC_COUNTRY = "NG";

/**
 * Re-denominate a discount code's cash fields.
 *
 * `amountKobo` and `maxDiscountKobo` are naira constants set by the merchant.
 * Handing them to `discountAmount` alongside a dollar subtotal would read
 * "₦5,000 off" as "$50 off", so they are converted by the same rule as prices.
 *
 * `minSubtotalKobo` is deliberately left alone: eligibility is judged against
 * the naira subtotal, where the merchant set the threshold, so the same basket
 * qualifies for the same codes no matter which currency it is being viewed in.
 */
export function discountCodeInCurrency(
  code: DiscountCode,
  currency: OrderCurrency,
): DiscountCode {
  if (currency === "NGN") return code;
  return {
    ...code,
    amountKobo:
      code.amountKobo == null ? null : priceInMinor(code.amountKobo, currency),
    maxDiscountKobo:
      code.maxDiscountKobo == null
        ? null
        : priceInMinor(code.maxDiscountKobo, currency),
  };
}
