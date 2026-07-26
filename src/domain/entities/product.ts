export type ProductStatus = "draft" | "published" | "archived";

export type MediaType = "image" | "video";

/** Unit an admin enters a product's weight in. Storage is always grams. */
export type WeightUnit = "g" | "kg";

/** Normalise an entered weight to canonical grams. */
export function toGrams(value: number, unit: WeightUnit): number {
  const grams = unit === "kg" ? value * 1000 : value;
  return Math.max(0, Math.round(grams));
}

/** Render canonical grams in the unit the admin prefers. */
export function fromGrams(grams: number, unit: WeightUnit): number {
  return unit === "kg" ? grams / 1000 : grams;
}

export function formatWeight(grams: number): string {
  if (grams >= 1000) {
    // parseFloat drops trailing zeros, so 2500 g reads "2.5 kg", not "2.50 kg".
    return `${parseFloat((grams / 1000).toFixed(2))} kg`;
  }
  return `${grams} g`;
}

export interface ProductImage {
  readonly id: string;
  readonly storagePath: string;
  readonly alt: string | null;
  readonly sortOrder: number;
  readonly mediaType: MediaType;
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
  /** Shipping weight in canonical grams. 0 = not recorded; the shipping
   *  engine substitutes the configured default rather than treating it as
   *  weightless. */
  readonly weightGrams: number;
  /** The unit the admin entered it in — display only, never arithmetic. */
  readonly weightUnit: "g" | "kg";
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
