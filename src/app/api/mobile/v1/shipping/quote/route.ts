import { computeQuote } from "@/infrastructure/db/quote-service";

import { jsonBody, requestCurrency } from "../../../_lib/context";
import { moneyAsIs } from "../../../_lib/dto";
import { fail, handler, ok } from "../../../_lib/respond";

/**
 * POST /api/mobile/v1/shipping/quote
 *
 * Body: `{ countryCode, items[], courierId?, ngDestinationId?, couponCode? }`
 *
 * The same `computeQuote` the website's checkout calls, so the figures in the
 * app and the figures on the site are produced by one implementation. The
 * client sends only ids and quantities; prices, postage and the Nigerian flat
 * fee are all read back from the database here.
 *
 * Amounts come back wrapped as `MoneyDto` rather than as bare integers. The raw
 * quote already returns them in the shopper's currency, so this only attaches
 * the formatted string — which means the app never formats money itself, and a
 * total on a phone reads exactly as it does in a browser.
 */
export const POST = handler(async (req: Request) => {
  const body = await jsonBody(req);
  if (body === null) return fail("invalid_request", "Expected a JSON body.");

  const currency = await requestCurrency();
  const quote = await computeQuote(body, currency);

  if (!quote.ok) return fail("invalid_request", quote.error);

  const asMoney = (minor: number) => moneyAsIs(minor, currency);

  return ok({
    countryCode: quote.countryCode,
    currency: quote.currency,
    weightGrams: quote.weightGrams,
    weightLabel: quote.weightLabel,
    zoneName: quote.zoneName,
    bracketLabel: quote.bracketLabel,
    options: quote.options.map((o) => ({
      courierId: o.courierId,
      courierCode: o.courierCode,
      courierName: o.courierName,
      price: asMoney(o.priceDisplay),
      free: o.free,
      minDays: o.minDays,
      maxDays: o.maxDays,
    })),
    selectedCourierId: quote.selected?.courierId ?? null,
    breakdown: {
      subtotal: asMoney(quote.breakdown.subtotal),
      shipping: asMoney(quote.breakdown.shipping),
      tax: asMoney(quote.breakdown.tax),
      discount: asMoney(quote.breakdown.discount),
      total: asMoney(quote.breakdown.total),
      taxLabel: quote.breakdown.taxLabel,
      taxRateBps: quote.breakdown.taxRateBps,
      discountCode: quote.breakdown.discountCode,
    },
    coupon: quote.coupon,
    // Null when the order is quotable. Otherwise names why nothing is on offer,
    // so the app can say something true instead of showing an empty list.
    unavailable: quote.unavailable,
  });
});
