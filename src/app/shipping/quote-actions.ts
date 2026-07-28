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
import { ORDER_CURRENCY } from "@/domain/shipping/currency";

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
    const weightLines: CartWeightLine[] = [];
    for (const line of input.items) {
      const product = await products.findPublishedById(line.productId);
      if (!product) continue;
      subtotalKobo += product.price * line.qty;
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

    // Quoted in the currency the order is placed in — kobo, unconverted.
    const currency = ORDER_CURRENCY;
    const toDisplay = (kobo: number) => kobo;

    const options: QuoteOption[] = lookup.options.map((o) => ({
      ...o,
      priceDisplay: toDisplay(o.priceKobo),
    }));

    const selected =
      options.find((o) => o.courierId === input.courierId) ?? options[0] ?? null;
    const shippingKobo = selected?.priceKobo ?? 0;

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
          amountKobo: discountAmount(code, { subtotalKobo, shippingKobo }),
        };
      } else {
        couponMessage = verdict.message ?? "That code can't be applied.";
      }
    }

    const taxRule = resolveTax(table, input.countryCode);
    const priced: PriceBreakdown = priceOrder({
      subtotalKobo,
      shippingKobo,
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
      options,
      selected,
      breakdown: {
        subtotal: toDisplay(priced.subtotalKobo),
        shipping: toDisplay(priced.shippingKobo),
        tax: toDisplay(priced.taxKobo),
        discount: toDisplay(priced.discountKobo),
        total: toDisplay(priced.totalKobo),
        taxLabel: priced.taxLabel,
        taxRateBps: priced.taxRateBps,
        discountCode: priced.discountCode,
      },
      coupon: {
        applied: applied !== null,
        code: applied?.code.code ?? null,
        message: couponMessage,
      },
      unavailable: lookup.reason === "ok" ? null : lookup.reason,
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
