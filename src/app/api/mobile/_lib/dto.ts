import type { Category } from "@/domain/entities/category";
import type {
  ProductImage,
  ProductSummary,
  ProductVariant,
  ProductWithDetails,
} from "@/domain/entities/product";
import type { Order, OrderWithItems } from "@/domain/entities/order";
import {
  formatMinor,
  priceInMinor,
  type DisplayCurrency,
  type ExchangeRates,
} from "@/domain/shared/display-price";
import { resolveMediaUrl } from "@/lib/media-url";
import { SITE_URL } from "@/lib/site";

/**
 * Domain entity → mobile wire format.
 *
 * Two transformations happen here and nowhere else, because getting either one
 * wrong in a single endpoint is how a client ends up showing one price and
 * charging another.
 *
 * **Money.** The catalogue stores naira kobo. The app never does that
 * arithmetic itself: every amount crosses the wire already converted into the
 * shopper's currency, as both an integer in minor units (for totals the client
 * sums) and a preformatted string (for display). The string is produced by the
 * storefront's own `formatMinor`, so a price tag in the app is formatted by the
 * same code as the price tag on the website.
 *
 * **Media.** `resolveMediaUrl` answers a browser-relative `/women.jpg` for seed
 * images that live in `public/`. A native client has no origin to resolve that
 * against, so every URL leaving here is made absolute.
 */

/** An amount, in one shape the client can both display and total. */
export interface MoneyDto {
  /** Minor units of `currency` — what the client sums. */
  readonly amount: number;
  readonly currency: DisplayCurrency;
  /** Preformatted for display, e.g. "₦300,000" or "$300". */
  readonly formatted: string;
}

/** Convert a stored naira amount into the shopper's currency. */
export function money(
  ngnMinor: number,
  currency: DisplayCurrency,
  rates?: ExchangeRates,
): MoneyDto {
  const amount = priceInMinor(ngnMinor, currency, rates);
  return { amount, currency, formatted: formatMinor(amount, currency) };
}

/** Wrap an amount that is ALREADY in `currency`'s minor units. */
export function moneyAsIs(
  minor: number,
  currency: DisplayCurrency,
): MoneyDto {
  return { amount: minor, currency, formatted: formatMinor(minor, currency) };
}

/** Absolute URL for a stored media path. */
export function mediaUrl(storagePath: string): string {
  const resolved = resolveMediaUrl(storagePath);
  return resolved.startsWith("/") ? `${SITE_URL}${resolved}` : resolved;
}

export interface ImageDto {
  readonly id: string;
  readonly url: string;
  readonly alt: string | null;
  readonly sortOrder: number;
  readonly mediaType: "image" | "video";
}

export function imageDto(image: ProductImage): ImageDto {
  return {
    id: image.id,
    url: mediaUrl(image.storagePath),
    alt: image.alt,
    sortOrder: image.sortOrder,
    mediaType: image.mediaType,
  };
}

export interface VariantDto {
  readonly id: string;
  readonly size: string | null;
  readonly color: string | null;
  readonly sku: string | null;
  readonly stockQty: number;
  readonly inStock: boolean;
}

export function variantDto(variant: ProductVariant): VariantDto {
  return {
    id: variant.id,
    size: variant.size,
    color: variant.color,
    sku: variant.sku,
    stockQty: variant.stockQty,
    inStock: variant.stockQty > 0,
  };
}

export interface ProductSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly price: MoneyDto;
  readonly categoryId: string | null;
  readonly featured: boolean;
  readonly image: ImageDto | null;
  /** Null when nobody has rated it — distinct from an average of zero. */
  readonly rating: number | null;
  readonly ratingCount: number;
}

export function productSummaryDto(
  product: ProductSummary,
  currency: DisplayCurrency,
  rates?: ExchangeRates,
): ProductSummaryDto {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: money(product.price, currency, rates),
    categoryId: product.categoryId,
    featured: product.featured,
    image: product.primaryImage ? imageDto(product.primaryImage) : null,
    rating: averageRating(product.ratingSum, product.ratingCount),
    ratingCount: product.ratingCount,
  };
}

export interface ProductDetailDto extends Omit<ProductSummaryDto, "image"> {
  readonly description: string | null;
  readonly images: ImageDto[];
  readonly variants: VariantDto[];
  readonly inStock: boolean;
  readonly fitType: string;
  readonly weightGrams: number;
  /** Present only when all three are recorded — a partial set is not useful. */
  readonly model: { heightCm: number; weightKg: number; size: string } | null;
}

export function productDetailDto(
  product: ProductWithDetails,
  currency: DisplayCurrency,
  rates?: ExchangeRates,
): ProductDetailDto {
  const hasModel =
    product.modelHeightCm != null &&
    product.modelWeightKg != null &&
    product.modelSize != null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: money(product.price, currency, rates),
    categoryId: product.categoryId,
    featured: product.featured,
    rating: averageRating(product.ratingSum, product.ratingCount),
    ratingCount: product.ratingCount,
    images: [...product.images].sort((a, b) => a.sortOrder - b.sortOrder).map(imageDto),
    variants: product.variants.map(variantDto),
    inStock: product.variants.some((v) => v.stockQty > 0),
    fitType: product.fitType,
    weightGrams: product.weightGrams,
    model: hasModel
      ? {
          heightCm: product.modelHeightCm!,
          weightKg: product.modelWeightKg!,
          size: product.modelSize!,
        }
      : null,
  };
}

/**
 * Average rating from the stored sum/count pair.
 *
 * The aggregates are kept as sum and count (not a running average) precisely so
 * this division can be done once, at read time, without accumulated rounding.
 * Rounded to one decimal because that is the most a star row can express.
 */
function averageRating(sum: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round((sum / count) * 10) / 10;
}

export interface CategoryDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly sortOrder: number;
}

export function categoryDto(category: Category): CategoryDto {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    sortOrder: category.sortOrder,
  };
}

export interface OrderItemDto {
  readonly id: string;
  readonly productId: string | null;
  readonly variantId: string | null;
  readonly name: string;
  readonly qty: number;
  readonly unitPrice: MoneyDto;
  readonly lineTotal: MoneyDto;
}

export interface OrderSummaryDto {
  readonly id: string;
  readonly status: string;
  readonly paymentStatus: string;
  readonly total: MoneyDto;
  readonly currency: string;
  readonly itemCount: number;
  readonly trackingNumber: string | null;
  readonly createdAt: string;
  /** True when an online charge can still be started for this order. */
  readonly payable: boolean;
  /** True when the customer may still cancel it themselves. */
  readonly cancellable: boolean;
}

export interface OrderDetailDto extends OrderSummaryDto {
  readonly items: OrderItemDto[];
  readonly subtotal: MoneyDto;
  readonly shipping: MoneyDto;
  readonly tax: MoneyDto;
  readonly discount: MoneyDto;
  readonly shippingMethod: string | null;
  readonly courierName: string | null;
  readonly estimatedMinDays: number | null;
  readonly estimatedMaxDays: number | null;
  readonly discountCode: string | null;
  readonly taxLabel: string | null;
  readonly paidAt: string | null;
  readonly address: {
    readonly name: string | null;
    readonly email: string | null;
    readonly phone: string | null;
    readonly address: string | null;
    readonly apartment: string | null;
    readonly city: string | null;
    readonly state: string | null;
    readonly country: string | null;
    readonly countryCode: string | null;
    readonly postal: string | null;
  };
}

/**
 * An order's amounts are stored in the currency it was CHARGED in, so they are
 * wrapped as-is rather than converted. Re-pricing order history into whatever
 * currency the app happens to be set to today would restate what the customer
 * actually paid, which is both wrong and unauditable.
 */
export function orderSummaryDto(
  order: Order,
  itemCount: number,
  payable: boolean,
): OrderSummaryDto {
  const currency = orderCurrency(order.currency);
  return {
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: moneyAsIs(order.total, currency),
    currency: order.currency,
    itemCount,
    trackingNumber: order.trackingNumber,
    createdAt: order.createdAt,
    payable,
    cancellable:
      order.paymentStatus === "unpaid" && order.status === "processing",
  };
}

export function orderDetailDto(
  order: OrderWithItems,
  payable: boolean,
): OrderDetailDto {
  const currency = orderCurrency(order.currency);
  const items = order.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    name: item.nameSnapshot,
    qty: item.qty,
    unitPrice: moneyAsIs(item.unitPrice, currency),
    lineTotal: moneyAsIs(item.unitPrice * item.qty, currency),
  }));

  const itemCount = items.reduce((n, i) => n + i.qty, 0);

  return {
    ...orderSummaryDto(order, itemCount, payable),
    items,
    subtotal: moneyAsIs(order.subtotal, currency),
    shipping: moneyAsIs(order.shippingCost, currency),
    tax: moneyAsIs(order.tax, currency),
    discount: moneyAsIs(order.discount, currency),
    shippingMethod: order.shippingMethod,
    courierName: order.courierName,
    estimatedMinDays: order.estimatedMinDays,
    estimatedMaxDays: order.estimatedMaxDays,
    discountCode: order.discountCode,
    taxLabel: order.taxLabel,
    paidAt: order.paidAt,
    address: {
      name: order.shipping.name,
      email: order.shipping.email,
      phone: order.shipping.phone,
      address: order.shipping.address,
      apartment: order.shipping.apartment,
      city: order.shipping.city,
      state: order.shipping.state,
      country: order.shipping.country,
      countryCode: order.shipping.countryCode,
      postal: order.shipping.postal,
    },
  };
}

/**
 * An order's stored currency is a free `text` column, so it is narrowed here
 * before being handed to the formatter. Anything unrecognised formats as naira,
 * which is what the column has held for every order the store has ever taken.
 */
function orderCurrency(value: string): DisplayCurrency {
  const upper = value.trim().toUpperCase();
  return upper === "USD" || upper === "EUR" || upper === "GBP"
    ? upper
    : "NGN";
}
