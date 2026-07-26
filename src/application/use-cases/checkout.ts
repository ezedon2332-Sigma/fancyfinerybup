import type { ShippingDetails } from "@/domain/entities/order";
import type {
  NewOrderItem,
  OrderRepository,
} from "@/domain/repositories/order-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import type { ShippingRepository } from "@/domain/repositories/shipping-repository";
import { convertFromNgnMinor } from "@/domain/shipping/currency";
import { chargeableWeightGrams } from "@/domain/entities/product";
import {
  totalCartWeight,
  type CartWeightLine,
} from "@/domain/shipping/engine";
import { resolveShipping, ShippingError } from "@/application/use-cases/shipping";

export interface CheckoutDeps {
  products: ProductRepository;
  orders: OrderRepository;
  shipping: ShippingRepository;
}

export interface CheckoutLine {
  productId: string;
  variantId: string | null;
  qty: number;
}

export interface PlaceOrderInput {
  userId: string;
  shipping: ShippingDetails;
  /** Shipping method *code* — legacy "standard"/"express" or an engine code. */
  method: string;
  lines: CheckoutLine[];
}

export class CheckoutError extends Error {}

/**
 * Place an order. Prices, names, stock, AND shipping cost are taken from the DB
 * — never trusted from the client — so a tampered cart or shipping selection
 * cannot change what's charged. Amounts are converted into the order's currency
 * (NGN for Nigeria, USD elsewhere) authoritatively here.
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
    weightLines.push({ weightGrams: chargeableWeightGrams(product), qty: line.qty });
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

  // 2) Resolve shipping + order currency authoritatively. Weight is recomputed
  //     here from the catalogue for the same reason the subtotal is: a client
  //     could otherwise declare a featherweight cart and underpay postage.
  let resolved;
  try {
    const settings = await deps.shipping.getSettings();
    const weightGrams = totalCartWeight(
      weightLines,
      settings.defaultItemWeightGrams,
    );
    resolved = await resolveShipping(deps, {
      countryCode: input.shipping.countryCode,
      method: input.method,
      subtotalNgn,
      weightGrams,
    });
  } catch (e) {
    if (e instanceof ShippingError) throw new CheckoutError(e.message);
    throw e;
  }

  // 3) Snapshot each line's unit price in the order currency.
  const items: NewOrderItem[] = priced.map(({ item, priceNgn }) => ({
    ...item,
    unitPrice: convertFromNgnMinor(priceNgn, resolved.currency, resolved.ngnPerUsd),
  }));

  return deps.orders.create({
    userId: input.userId,
    currency: resolved.currency,
    subtotal: resolved.subtotal,
    shippingCost: resolved.shippingCost,
    tax: resolved.tax,
    discount: resolved.discount,
    totalWeightGrams: resolved.weightGrams,
    total: resolved.total,
    shippingMethod: resolved.method,
    shipping: input.shipping,
    items,
  });
}
