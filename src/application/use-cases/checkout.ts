import type { ShippingDetails } from "@/domain/entities/order";
import type {
  NewOrderItem,
  OrderRepository,
} from "@/domain/repositories/order-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";

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
 * Place a pending order. Prices, names, and stock are taken from the DB — never
 * trusted from the client — so a tampered cart cannot change what's charged.
 */
export async function placeOrder(
  deps: CheckoutDeps,
  input: PlaceOrderInput,
): Promise<string> {
  if (input.lines.length === 0) {
    throw new CheckoutError("Your bag is empty.");
  }

  const items: NewOrderItem[] = [];
  let total = 0;
  let currency = "NGN";

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

    currency = product.currency;
    total += product.price * line.qty;
    items.push({
      productId: product.id,
      variantId,
      nameSnapshot: variantLabel
        ? `${product.name} (${variantLabel})`
        : product.name,
      unitPrice: product.price,
      qty: line.qty,
    });
  }

  return deps.orders.create({
    userId: input.userId,
    currency,
    total,
    shipping: input.shipping,
    items,
  });
}
