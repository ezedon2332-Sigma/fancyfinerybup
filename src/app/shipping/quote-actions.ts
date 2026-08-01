"use server";

import { z } from "zod";

import {
  checkDiscount,
  discountAmount,
  formatWeight,
  priceOrder,
  resolveTax,
  shippingOptionsFor,
  totalCartWeight,
  type CartWeightLine,
  type PriceBreakdown,
  type ShippingOption,
} from "@/domain/shipping/pricing";
import {
  defaultItemWeightGrams,
  findDiscountCode,
  isFirstOrder,
  loadPricingTable,
} from "@/infrastructure/supabase/pricing-service";
import { getCurrentUser } from "@/infrastructure/supabase/auth";
import { getCatalogDeps } from "@/infrastructure/supabase/catalog-service";
import {
  DEFAULT_ORDER_CURRENCY,
  discountCodeInCurrency,
} from "@/domain/shipping/currency";
import {
  isDisplayCurrency,
  priceInMinor,
  CURRENCY_COOKIE,
} from "@/domain/shared/display-price";
import { cookies } from "next/headers";
import {
  LOCAL_DELIVERY_ID,
  isNigeria,
  localFeeKobo,
} from "@/domain/shipping/nigeria";
import { findDestination } from "@/infrastructure/supabase/nigeria-shipping-service";

/**
 * The one quote endpoint.
 *
 * Product page, cart, checkout and order review all call this, so no two
 * screens can show different money. Subtotal and weight are always recomputed
 * from the catalogue — a client that understated either would otherwise be
 * quoted the wrong postage.
 */

const lineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  qty: z.number().int().positive().max(99),
});

const quoteSchema = z.object({
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine((c) => /^[A-Z]{2}$/.test(c), "Select a destination"),
  items: z.array(lineSchema).min(1, "Nothing to price"),
  courierId: z.string().uuid().nullable().optional(),
  // Nigeria local delivery. Only the id travels: the price is read from the
  // database here, never taken from the browser.
  ngDestinationId: z.string().uuid().nullable().optional(),
  couponCode: z.string().trim().max(64).nullable().optional(),
});

export interface QuoteOption extends ShippingOption {
  /** Converted into the destination's order currency, for display. */
  priceDisplay: number;
}

export interface Quote {
  ok: true;
  countryCode: string;
  currency: string;
  weightGrams: number;
  weightLabel: string;
  bracketLabel: string | null;
  zoneName: string | null;
  options: QuoteOption[];
  selected: QuoteOption | null;
  /** Every figure already in the display currency. */
  breakdown: {
    subtotal: number;
    shipping: number;
    tax: number;
    discount: number;
    total: number;
    taxLabel: string;
    taxRateBps: number | null;
    discountCode: string | null;
  };
  coupon: { applied: boolean; code: string | null; message: string | null };
  /** Why no option is on offer, so the UI can say something true. */
  unavailable: "over-max-weight" | "no-zone" | "no-rate" | null;
}

export interface QuoteFailure {
  ok: false;
  error: string;
}

export type QuoteResult = Quote | QuoteFailure;

export async function quoteShipping(payload: unknown): Promise<QuoteResult> {
  const parsed = quoteSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }
  const input = parsed.data;

  try {
    const { products } = await getCatalogDeps();

    // Recompute both from the catalogue — never trust the client.
    let subtotalKobo = 0;
    const unitPricesNgn: { price: number; qty: number }[] = [];
    const weightLines: CartWeightLine[] = [];
    for (const line of input.items) {
      const product = await products.findPublishedById(line.productId);
      if (!product) continue;
      subtotalKobo += product.price * line.qty;
      unitPricesNgn.push({ price: product.price, qty: line.qty });
      weightLines.push({ weightGrams: product.weightGrams, qty: line.qty });
    }
    if (subtotalKobo === 0) {
      return { ok: false, error: "Nothing in this bag is available." };
    }

    const [table, defaultWeight] = await Promise.all([
      loadPricingTable(),
      defaultItemWeightGrams(),
    ]);

    const weightGrams = totalCartWeight(weightLines, defaultWeight);
    const lookup = shippingOptionsFor(table, {
      countryCode: input.countryCode,
      weightGrams,
      subtotalKobo,
    });

    // The currency the shopper picked in the header is the currency they pay
    // in, so the quote is produced in it — and the checkout screen therefore
    // shows exactly the figures the order will be created with.
    const cookieCurrency = (await cookies()).get(CURRENCY_COOKIE)?.value;
    const currency = isDisplayCurrency(cookieCurrency)
      ? cookieCurrency
      : DEFAULT_ORDER_CURRENCY;
    const toDisplay = (kobo: number) => priceInMinor(kobo, currency);

    // Summed from converted unit prices rather than converting the naira
    // subtotal, because the rule truncates and the per-line figures are the
    // ones a customer can add up themselves.
    const subtotalCharged = unitPricesNgn.reduce(
      (sum, l) => sum + priceInMinor(l.price, currency) * l.qty,
      0,
    );

    const options: QuoteOption[] = lookup.options.map((o) => ({
      ...o,
      priceDisplay: toDisplay(o.priceKobo),
    }));

    // Nigeria local delivery.
    //
    // A flat fee for a named area replaces the weight bracket entirely — but
    // only once the customer has actually picked one, and only after the price
    // has been read back from the database. Everything else, Nigeria included
    // while no area is chosen, falls through to the international engine
    // untouched. That fallback is deliberate: it means a state nobody has
    // priced yet still quotes rather than blocking the order.
    const ngDestination =
      isNigeria(input.countryCode) && input.ngDestinationId
        ? await findDestination(input.ngDestinationId)
        : null;

    const ngFeeKobo = localFeeKobo({
      countryCode: input.countryCode,
      destinationId: input.ngDestinationId,
      destinations: ngDestination ? [ngDestination] : [],
    });

    const localOption: QuoteOption | null =
      ngFeeKobo !== null && ngDestination
        ? {
            courierId: LOCAL_DELIVERY_ID,
            courierCode: "NG-LOCAL",
            courierName: `Delivery to ${ngDestination.name}`,
            priceKobo: ngFeeKobo,
            free: ngFeeKobo === 0,
            minDays: 1,
            maxDays: 3,
            source: "country-override",
            priceDisplay: toDisplay(ngFeeKobo),
          }
        : null;

    const selected =
      localOption ??
      options.find((o) => o.courierId === input.courierId) ??
      options[0] ??
      null;
    const shippingKobo = selected?.priceKobo ?? 0;
    const shippingCharged = toDisplay(shippingKobo);

    // Coupon, if one was supplied. An invalid code never blocks the quote —
    // the rest of the figures are still correct and the message explains why.
    let applied: { code: import("@/domain/shipping/pricing").DiscountCode; amountKobo: number } | null = null;
    let couponMessage: string | null = null;

    if (input.couponCode) {
      const code = await findDiscountCode(input.couponCode);
      const user = await getCurrentUser();
      const verdict = checkDiscount(code, {
        subtotalKobo,
        isFirstOrder: await isFirstOrder(user?.id ?? null),
        now: new Date(),
      });
      if (verdict.valid && code) {
        applied = {
          code,
          amountKobo: discountAmount(discountCodeInCurrency(code, currency), {
            subtotalKobo: subtotalCharged,
            shippingKobo: shippingCharged,
          }),
        };
      } else {
        couponMessage = verdict.message ?? "That code can't be applied.";
      }
    }

    const taxRule = resolveTax(table, input.countryCode);
    const priced: PriceBreakdown = priceOrder({
      subtotalKobo: subtotalCharged,
      shippingKobo: shippingCharged,
      taxRule,
      discount: applied,
    });

    return {
      ok: true,
      countryCode: input.countryCode,
      currency,
      weightGrams,
      weightLabel: formatWeight(weightGrams),
      bracketLabel: lookup.bracket?.label ?? null,
      zoneName: lookup.zone?.name ?? null,
      options: localOption ? [localOption, ...options] : options,
      selected,
      breakdown: {
        subtotal: priced.subtotalKobo,
        shipping: priced.shippingKobo,
        tax: priced.taxKobo,
        discount: priced.discountKobo,
        total: priced.totalKobo,
        taxLabel: priced.taxLabel,
        taxRateBps: priced.taxRateBps,
        discountCode: priced.discountCode,
      },
      coupon: {
        applied: applied !== null,
        code: applied?.code.code ?? null,
        message: couponMessage,
      },
      // A resolved local delivery is quotable even when the weight engine has
      // nothing to say about Nigeria — the flat fee IS the rate.
      unavailable: localOption
        ? null
        : lookup.reason === "ok"
          ? null
          : lookup.reason,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        process.env.NODE_ENV === "production"
          ? "Could not calculate shipping."
          : `Could not calculate shipping: ${(e as Error).message}`,
    };
  }
}
