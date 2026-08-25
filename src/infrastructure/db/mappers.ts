import type { Category } from "@/domain/entities/category";
import type {
  Order,
  OrderItem,
  OrderStatus,
  OrderWithItems,
  PaymentStatus,
} from "@/domain/entities/order";
import type {
  Product,
  ProductImage,
  ProductSummary,
  ProductVariant,
  ProductWithDetails,
} from "@/domain/entities/product";
import type { Profile } from "@/domain/entities/profile";
import type {
  categories,
  orderItems,
  orders,
  productImages,
  productVariants,
  products,
  profiles,
} from "./schema";

/**
 * The database → domain boundary. Nothing above this file sees a table row.
 *
 * Under Supabase these mappers took snake_case PostgREST rows; Drizzle already
 * returns camelCase, so the renaming work is gone, but the boundary stays —
 * it is what stops a schema change from rippling into components, and it is
 * where nullable columns are resolved to the non-null shapes the domain
 * promises.
 */

type CategoryRow = typeof categories.$inferSelect;
type ProductRow = typeof products.$inferSelect;
type ProductImageRow = typeof productImages.$inferSelect;
type ProductVariantRow = typeof productVariants.$inferSelect;
type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;
type ProfileRow = typeof profiles.$inferSelect;

export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sortOrder,
  };
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: row.price,
    currency: row.currency,
    categoryId: row.categoryId,
    status: row.status,
    featured: row.featured,
    weightGrams: row.weightGrams ?? 0,
    ratingSum: row.ratingSum ?? 0,
    ratingCount: row.ratingCount ?? 0,
    fitType: row.fitType ?? "regular",
    modelHeightCm: row.modelHeightCm ?? null,
    modelWeightKg: row.modelWeightKg ?? null,
    modelSize: row.modelSize ?? null,
    weightUnit: (row.weightUnit ?? "g") === "kg" ? "kg" : "g",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toProductImage(row: ProductImageRow): ProductImage {
  return {
    id: row.id,
    storagePath: row.storagePath,
    alt: row.alt,
    sortOrder: row.sortOrder,
    mediaType: row.mediaType as ProductImage["mediaType"],
  };
}

export function toProductVariant(row: ProductVariantRow): ProductVariant {
  return {
    id: row.id,
    size: row.size,
    color: row.color,
    sku: row.sku,
    stockQty: row.stockQty,
  };
}

export function toProductSummary(
  row: ProductRow & { productImages?: ProductImageRow[] | null },
): ProductSummary {
  const media = (row.productImages ?? [])
    .map(toProductImage)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  // Cards use a still image; fall back to first media only if no image exists.
  const primaryImage =
    media.find((m) => m.mediaType === "image") ?? media[0] ?? null;
  return { ...toProduct(row), primaryImage };
}

export function toProductWithDetails(
  row: ProductRow & {
    productImages?: ProductImageRow[] | null;
    productVariants?: ProductVariantRow[] | null;
  },
): ProductWithDetails {
  const images = (row.productImages ?? [])
    .map(toProductImage)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const variants = (row.productVariants ?? []).map(toProductVariant);
  return { ...toProduct(row), images, variants };
}

/**
 * The `order_status` enum still carries three pre-lifecycle values —
 * 'pending', 'paid', 'fulfilled' — because Postgres cannot remove an enum
 * label. Migration 20260719000011 remapped every existing row off them
 * (pending/paid -> processing, fulfilled -> delivered) and nothing writes them
 * now, but the *type* is still nine-valued and the domain models six.
 *
 * The Supabase types papered over this by declaring the column as the six-value
 * domain union, which typechecked by asserting something untrue: a legacy row
 * would have flowed straight through as an OrderStatus the UI has no label for.
 * Applying the migration's own mapping keeps the domain honest instead.
 */
const LEGACY_ORDER_STATUS: Record<string, OrderStatus> = {
  pending: "processing",
  paid: "processing",
  fulfilled: "delivered",
};

export function toAdminOrderStatus(value: string): OrderStatus {
  return normalizeOrderStatus(value);
}

function normalizeOrderStatus(value: string): OrderStatus {
  return LEGACY_ORDER_STATUS[value] ?? (value as OrderStatus);
}

const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "unpaid",
  "paid",
  "failed",
  "refunded",
];

/** Coerce the free-text DB column to the known set; unknown → 'unpaid'. */
function normalizePaymentStatus(value: string | null | undefined): PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as PaymentStatus)
    : "unpaid";
}

export function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.userId,
    status: normalizeOrderStatus(row.status),
    subtotal: row.subtotal,
    shippingCost: row.shippingCost,
    total: row.total,
    currency: row.currency,
    shippingMethod: row.shippingMethod ?? null,
    trackingNumber: row.trackingNumber,
    paystackReference: row.paystackReference,
    paymentReference: row.paymentReference ?? null,
    paymentStatus: normalizePaymentStatus(row.paymentStatus),
    paymentProvider: row.paymentProvider ?? null,
    paidAt: row.paidAt ?? null,
    shipping: {
      name: row.shippingName,
      email: row.shippingEmail,
      phone: row.shippingPhone,
      address: row.shippingAddress,
      apartment: row.shippingApartment,
      city: row.shippingCity,
      state: row.shippingState,
      country: row.shippingCountry,
      countryCode: row.shippingCountryCode,
      postal: row.shippingPostal,
      lat: row.shippingLat,
      lng: row.shippingLng,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    productId: row.productId,
    variantId: row.variantId,
    nameSnapshot: row.nameSnapshot,
    unitPrice: row.unitPrice,
    qty: row.qty,
  };
}

export function toOrderWithItems(
  row: OrderRow & { orderItems?: OrderItemRow[] | null },
): OrderWithItems {
  return {
    ...toOrder(row),
    items: (row.orderItems ?? []).map(toOrderItem),
  };
}

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    fullName: row.fullName,
    avatarUrl: row.avatarUrl,
    role: row.role,
    createdAt: row.createdAt,
    address: {
      phone: row.phone,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country,
      lat: row.lat,
      lng: row.lng,
    },
  };
}
