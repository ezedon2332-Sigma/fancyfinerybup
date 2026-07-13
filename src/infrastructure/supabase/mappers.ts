import type { Category } from "@/domain/entities/category";
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
  const images = (row.product_images ?? [])
    .map(toProductImage)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return { ...toProduct(row), primaryImage: images[0] ?? null };
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
