export type ProductStatus = "draft" | "published" | "archived";

export interface ProductImage {
  readonly id: string;
  readonly storagePath: string;
  readonly alt: string | null;
  readonly sortOrder: number;
}

export interface ProductVariant {
  readonly id: string;
  readonly size: string | null;
  readonly color: string | null;
  readonly sku: string | null;
  readonly stockQty: number;
}

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  /** Price in minor units (kobo). */
  readonly price: number;
  readonly currency: string;
  readonly categoryId: string | null;
  readonly status: ProductStatus;
  readonly featured: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Lightweight list read model — a product plus its primary image. */
export interface ProductSummary extends Product {
  readonly primaryImage: ProductImage | null;
}

/** A product with its related media and variants — the storefront read model. */
export interface ProductWithDetails extends Product {
  readonly images: ProductImage[];
  readonly variants: ProductVariant[];
}

export function isInStock(product: ProductWithDetails): boolean {
  return product.variants.some((v) => v.stockQty > 0);
}
