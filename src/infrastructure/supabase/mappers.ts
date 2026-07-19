import type { Category } from "@/domain/entities/category";
import type {
  Order,
  OrderItem,
  OrderWithItems,
} from "@/domain/entities/order";
import type {
  Product,
  ProductImage,
  ProductSummary,
  ProductVariant,
  ProductWithDetails,
} from "@/domain/entities/product";
import type { Database } from "./database.types";

type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export function toCategory(row: Row<"categories">): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order,
  };
}

export function toProduct(row: Row<"products">): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: row.price,
    currency: row.currency,
    categoryId: row.category_id,
    status: row.status,
    featured: row.featured,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toProductImage(row: Row<"product_images">): ProductImage {
  return {
    id: row.id,
    storagePath: row.storage_path,
    alt: row.alt,
    sortOrder: row.sort_order,
    mediaType: row.media_type,
  };
}

export function toProductVariant(row: Row<"product_variants">): ProductVariant {
  return {
    id: row.id,
    size: row.size,
    color: row.color,
    sku: row.sku,
    stockQty: row.stock_qty,
  };
}

export function toProductSummary(
  row: Row<"products"> & {
    product_images?: Row<"product_images">[] | null;
  },
): ProductSummary {
  const media = (row.product_images ?? [])
    .map(toProductImage)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  // Cards use a still image; fall back to first media only if no image exists.
  const primaryImage =
    media.find((m) => m.mediaType === "image") ?? media[0] ?? null;
  return { ...toProduct(row), primaryImage };
}

export function toOrder(row: Row<"orders">): Order {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    total: row.total,
    currency: row.currency,
    paystackReference: row.paystack_reference,
    shipping: {
      name: row.shipping_name,
      email: row.shipping_email,
      phone: row.shipping_phone,
      address: row.shipping_address,
      city: row.shipping_city,
      state: row.shipping_state,
      country: row.shipping_country,
      lat: row.shipping_lat,
      lng: row.shipping_lng,
    },
    createdAt: row.created_at,
  };
}

export function toOrderItem(row: Row<"order_items">): OrderItem {
  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    nameSnapshot: row.name_snapshot,
    unitPrice: row.unit_price,
    qty: row.qty,
  };
}

export function toOrderWithItems(
  row: Row<"orders"> & { order_items?: Row<"order_items">[] | null },
): OrderWithItems {
  return {
    ...toOrder(row),
    items: (row.order_items ?? []).map(toOrderItem),
  };
}

export function toProductWithDetails(
  row: Row<"products"> & {
    product_images?: Row<"product_images">[] | null;
    product_variants?: Row<"product_variants">[] | null;
  },
): ProductWithDetails {
  const images = (row.product_images ?? [])
    .map(toProductImage)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const variants = (row.product_variants ?? []).map(toProductVariant);
  return { ...toProduct(row), images, variants };
}
