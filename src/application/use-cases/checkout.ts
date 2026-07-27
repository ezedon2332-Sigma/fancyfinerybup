import type { ShippingDetails } from "@/domain/entities/order";
import type {
  NewOrderItem,
  OrderRepository,
} from "@/domain/repositories/order-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import {
  convertFromNgnMinor,
  orderCurrencyForCountry,
} from "@/domain/shipping/currency";
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
import { getExchangeRate } from "@/infrastructure/exchange-rate/service";

export interface CheckoutDeps {
  products: ProductRepository;
  orders: OrderRepository;
  /** Loaded fresh per order — a rate or tax change must apply immediately. */
  pricing: () => Promise<PricingTable>;
  defaultItemWeightGrams: () => Promise<number>;
  findDiscountCode: (code: string) => Promise<DiscountCode | null>;
  isFirstOrder: (userId: string) => Promise<boolean>;
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
}

export class CheckoutError extends Error {}

/**
 * Place an order.
 *
 * Prices, names and stock are taken from the database — never trusted from the
 * client — so a tampered cart cannot change what is charged. Amounts are
 * converted into the order's currency (NGN for Nigeria, USD elsewhere) here.
 *
 * Delivery is currently free: the shipping module has been removed and no rate
 * engine exists, so every order is placed with a zero shipping cost. The
 * address is still captured in full, and orders carry `shipping_cost` and
 * `shipping_method` columns, so reinstating a charge later is a change in this
 * function rather than a schema migration.
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
  const [table, defaultWeight, { ngnPerUsd }] = await Promise.all([
    deps.pricing(),
    deps.defaultItemWeightGrams(),
    getExchangeRate(),
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
  const shippingKobo = courier?.priceKobo ?? 0;

  // 3) Coupon. Re-validated here — a code that expired between the quote and
  //    the submit must not be honoured.
  let applied: { code: DiscountCode; amountKobo: number } | null = null;
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
        amountKobo: discountAmount(code, {
          subtotalKobo: subtotalNgn,
          shippingKobo,
        }),
      };
    }
    // An invalid code is silently dropped rather than failing the order: the
    // customer still wants the goods, and they are charged the correct,
    // undiscounted amount.
  }

  const breakdown = priceOrder({
    subtotalKobo: subtotalNgn,
    shippingKobo,
    taxRule: resolveTax(table, input.shipping.countryCode),
    discount: applied,
  });

  // 4) Convert once, into the order's currency.
  const currency = orderCurrencyForCountry(input.shipping.countryCode);
  const toOrder = (kobo: number) => convertFromNgnMinor(kobo, currency, ngnPerUsd);

  const items: NewOrderItem[] = priced.map(({ item, priceNgn }) => ({
    ...item,
    unitPrice: toOrder(priceNgn),
  }));

  const orderId = await deps.orders.create({
    userId: input.userId,
    currency,
    subtotal: toOrder(breakdown.subtotalKobo),
    shippingCost: toOrder(breakdown.shippingKobo),
    tax: toOrder(breakdown.taxKobo),
    discount: toOrder(breakdown.discountKobo),
    totalWeightGrams: weightGrams,
    total: toOrder(breakdown.totalKobo),
    shippingMethod: courier?.courierCode ?? null,
    shipping: input.shipping,
    items,
  });

  // 5) Record the redemption so usage limits actually bind. Best-effort: the
  //    order is already placed and must not fail over a counter.
  if (applied) {
    try {
      await deps.recordRedemption({
        codeId: applied.code.id,
        orderId,
        userId: input.userId,
        amountKobo: applied.amountKobo,
      });
    } catch {
      /* counter drift is preferable to a lost order */
    }
  }

  return orderId;
}
