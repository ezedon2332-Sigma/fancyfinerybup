"use server";

import { cookies } from "next/headers";

import { computeQuote } from "@/infrastructure/db/quote-service";
import { DEFAULT_ORDER_CURRENCY } from "@/domain/shipping/currency";
import {
  isDisplayCurrency,
  CURRENCY_COOKIE,
} from "@/domain/shared/display-price";

/**
 * The storefront's quote entry point.
 *
 * All of the arithmetic moved to `infrastructure/db/quote-service` so that the
 * mobile API prices through exactly the same code (see
 * `api/mobile/v1/shipping/quote`). What is left here is the one thing that is
 * genuinely web-specific: the shopper's currency comes from the `ff_currency`
 * cookie, read server-side so the quote is produced in the same currency the
 * prices they browsed were rendered in.
 */

export type {
  Quote,
  QuoteFailure,
  QuoteOption,
  QuoteResult,
} from "@/infrastructure/db/quote-service";

export async function quoteShipping(payload: unknown) {
  const cookieCurrency = (await cookies()).get(CURRENCY_COOKIE)?.value;
  const currency = isDisplayCurrency(cookieCurrency)
    ? cookieCurrency
    : DEFAULT_ORDER_CURRENCY;

  return computeQuote(payload, currency);
}
