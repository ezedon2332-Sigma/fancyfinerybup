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
import { getExchangeRate } from "@/infrastructure/exchange-rate/service";

export interface CheckoutDeps {
  products: ProductRepository;
  orders: OrderRepository;
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
  let subtotalNgn = 0;
  let totalWeightGrams = 0;

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
    totalWeightGrams += product.weightGrams * line.qty;
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

  // 2) Order currency follows the destination; the live rate converts into it.
  const currency = orderCurrencyForCountry(input.shipping.countryCode);
  const { ngnPerUsd } = await getExchangeRate();

  const subtotal = convertFromNgnMinor(subtotalNgn, currency, ngnPerUsd);

  // 3) Snapshot each line's unit price in the order currency.
  const items: NewOrderItem[] = priced.map(({ item, priceNgn }) => ({
    ...item,
    unitPrice: convertFromNgnMinor(priceNgn, currency, ngnPerUsd),
  }));

  return deps.orders.create({
    userId: input.userId,
    currency,
    subtotal,
    shippingCost: 0,
    tax: 0,
    discount: 0,
    totalWeightGrams,
    total: subtotal,
    shippingMethod: null,
    shipping: input.shipping,
    items,
  });
}
