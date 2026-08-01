import type { ShippingDetails } from "@/domain/entities/order";
import type {
  NewOrderItem,
  OrderRepository,
} from "@/domain/repositories/order-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import {
  DEFAULT_ORDER_CURRENCY,
  discountCodeInCurrency,
  type OrderCurrency,
} from "@/domain/shipping/currency";
import { priceInMinor } from "@/domain/shared/display-price";
import {
  isNigeria,
  localFeeKobo,
  type NgDestination,
} from "@/domain/shipping/nigeria";
import {
  checkDiscount,
  discountAmount,
  priceOrder,
  resolveTax,
  shippingOptionsFor,
  totalCartWeight,
  type CartWeightLine,
  type DiscountCode,
  type PricingTable,
} from "@/domain/shipping/pricing";

export interface CheckoutDeps {
  products: ProductRepository;
  orders: OrderRepository;
  /** Loaded fresh per order — a rate or tax change must apply immediately. */
  pricing: () => Promise<PricingTable>;
  defaultItemWeightGrams: () => Promise<number>;
  findDiscountCode: (code: string) => Promise<DiscountCode | null>;
  isFirstOrder: (userId: string) => Promise<boolean>;
  /** Nigeria local delivery lookup. Null for every other destination. */
  findNgDestination: (id: string) => Promise<NgDestination | null>;
  recordRedemption: (input: {
    codeId: string;
    orderId: string;
    userId: string;
    amountKobo: number;
  }) => Promise<void>;
}

export interface CheckoutLine {
  productId: string;
  variantId: string | null;
  qty: number;
}

export interface PlaceOrderInput {
  userId: string;
  shipping: ShippingDetails;
  lines: CheckoutLine[];
  /** Courier the customer picked; the cheapest is used if absent or stale. */
  courierId?: string | null;
  couponCode?: string | null;
  /** Chosen Nigerian delivery area, when shipping locally. */
  ngDestinationId?: string | null;
  /** Currency the customer chose, and is charged in. Naira if absent. */
  currency?: OrderCurrency;
}

export class CheckoutError extends Error {}

/**
 * Place an order.
 *
 * Prices, names and stock are taken from the database — never trusted from the
 * client — so a tampered cart cannot change what is charged. Amounts are then
 * re-expressed in the currency the customer selected, by the same rule that
 * produced the prices they were shown, so the total matches the price tag.
 *
 * Delivery is priced one of two ways. A Nigerian address with a chosen area
 * takes that area's flat fee; everything else goes through the weight-bracket
 * engine. Both are resolved server-side from the database, so neither can be
 * set by the browser.
 */
export async function placeOrder(
  deps: CheckoutDeps,
  input: PlaceOrderInput,
): Promise<string> {
  if (input.lines.length === 0) {
    throw new CheckoutError("Your bag is empty.");
  }
  if (!input.shipping.countryCode) {
    throw new CheckoutError("Please choose a shipping country.");
  }

  // 1) Recompute the subtotal in the base currency (NGN kobo) from the DB.
  const priced: { item: Omit<NewOrderItem, "unitPrice">; priceNgn: number }[] = [];
  const weightLines: CartWeightLine[] = [];
  let subtotalNgn = 0;

  for (const line of input.lines) {
    const product = await deps.products.findPublishedById(line.productId);
    if (!product) {
      throw new CheckoutError("A product in your bag is no longer available.");
    }

    let variantId: string | null = null;
    let variantLabel = "";
    if (product.variants.length > 0) {
      const variant =
        product.variants.find((v) => v.id === line.variantId) ?? null;
      if (!variant) {
        throw new CheckoutError(`Please choose an option for ${product.name}.`);
      }
      if (variant.stockQty < line.qty) {
        throw new CheckoutError(`${product.name} is out of stock.`);
      }
      variantId = variant.id;
      variantLabel = [variant.size, variant.color].filter(Boolean).join(" · ");
    }

    subtotalNgn += product.price * line.qty;
    weightLines.push({ weightGrams: product.weightGrams, qty: line.qty });
    priced.push({
      item: {
        productId: product.id,
        variantId,
        nameSnapshot: variantLabel
          ? `${product.name} (${variantLabel})`
          : product.name,
        qty: line.qty,
      },
      priceNgn: product.price,
    });
  }

  // 2) Price the order server-side. Everything is re-derived here: the client
  //     told us the destination and the coupon, nothing more. Whatever the
  //     checkout screen displayed is irrelevant to what is charged.
  const [table, defaultWeight] = await Promise.all([
    deps.pricing(),
    deps.defaultItemWeightGrams(),
  ]);

  const weightGrams = totalCartWeight(weightLines, defaultWeight);
  const lookup = shippingOptionsFor(table, {
    countryCode: input.shipping.countryCode,
    weightGrams,
    subtotalKobo: subtotalNgn,
  });

  if (lookup.options.length === 0 && lookup.reason === "over-max-weight") {
    throw new CheckoutError(
      "This order exceeds our published weight bands. Please contact us for a freight quote.",
    );
  }

  const courier =
    lookup.options.find((o) => o.courierId === input.courierId) ??
    lookup.options[0] ??
    null;

  // Nigeria local delivery overrides the weight bracket — but the fee is read
  // back from the database here, exactly as the quote did. The browser sends an
  // id and nothing else, so a tampered price cannot reach an order row. When no
  // area is chosen, or the destination has since been withdrawn, this falls
  // through to the international engine rather than failing the order.
  const ngDestination =
    isNigeria(input.shipping.countryCode) && input.ngDestinationId
      ? await deps.findNgDestination(input.ngDestinationId)
      : null;

  const ngFeeKobo = localFeeKobo({
    countryCode: input.shipping.countryCode,
    destinationId: input.ngDestinationId,
    destinations: ngDestination ? [ngDestination] : [],
  });

  const shippingKobo = ngFeeKobo ?? courier?.priceKobo ?? 0;
  const shippingMethod =
    ngFeeKobo !== null && ngDestination
      ? `NG-LOCAL:${ngDestination.name}`
      : (courier?.courierCode ?? null);

  // 3) Move into the currency this order is charged in.
  //
  //    Line items convert first and the subtotal is summed from them, rather
  //    than converting the naira subtotal directly. The rule truncates, so the
  //    two are not the same number — and it is the per-line figures a customer
  //    can check against the total on their order, so those are the ones that
  //    have to be authoritative.
  const currency = input.currency ?? DEFAULT_ORDER_CURRENCY;
  const toCharge = (kobo: number) => priceInMinor(kobo, currency);

  const items: NewOrderItem[] = priced.map(({ item, priceNgn }) => ({
    ...item,
    unitPrice: toCharge(priceNgn),
  }));
  const subtotalCharged = items.reduce(
    (sum, i) => sum + i.unitPrice * i.qty,
    0,
  );
  const shippingCharged = toCharge(shippingKobo);

  // 4) Coupon. Re-validated here — a code that expired between the quote and
  //    the submit must not be honoured.
  //
  //    Eligibility is judged in naira, against the thresholds the merchant
  //    actually set. The cash effect is then computed in the charge currency,
  //    from a code whose own naira ceilings have been converted with it.
  let applied: { code: DiscountCode; amountKobo: number } | null = null;
  let redeemedNgn = 0;
  if (input.couponCode) {
    const code = await deps.findDiscountCode(input.couponCode);
    const verdict = checkDiscount(code, {
      subtotalKobo: subtotalNgn,
      isFirstOrder: await deps.isFirstOrder(input.userId),
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
      // The redemption ledger stays in naira whatever the order is charged in,
      // so "how much has this code cost us" remains a single addable number.
      redeemedNgn = discountAmount(code, {
        subtotalKobo: subtotalNgn,
        shippingKobo,
      });
    }
    // An invalid code is silently dropped rather than failing the order: the
    // customer still wants the goods, and they are charged the correct,
    // undiscounted amount.
  }

  // 5) Tax and totals are computed *in the charge currency*, so the percentage
  //    applies to the amount actually being paid and the lines add up exactly.
  const breakdown = priceOrder({
    subtotalKobo: subtotalCharged,
    shippingKobo: shippingCharged,
    taxRule: resolveTax(table, input.shipping.countryCode),
    discount: applied,
  });

  const orderId = await deps.orders.create({
    userId: input.userId,
    currency,
    subtotal: breakdown.subtotalKobo,
    shippingCost: breakdown.shippingKobo,
    tax: breakdown.taxKobo,
    discount: breakdown.discountKobo,
    totalWeightGrams: weightGrams,
    total: breakdown.totalKobo,
    shippingMethod,
    shipping: input.shipping,
    items,
  });

  // 6) Record the redemption so usage limits actually bind. Best-effort: the
  //    order is already placed and must not fail over a counter.
  if (applied) {
    try {
      await deps.recordRedemption({
        codeId: applied.code.id,
        orderId,
        userId: input.userId,
        amountKobo: redeemedNgn,
      });
    } catch {
      /* counter drift is preferable to a lost order */
    }
  }

  return orderId;
}
