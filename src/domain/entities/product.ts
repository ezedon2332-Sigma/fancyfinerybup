export type ProductStatus = "draft" | "published" | "archived";

export type MediaType = "image" | "video";

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
  /** Parcel dimensions in millimetres. 0 = not recorded. */
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly shippingClass: ShippingClass;
  readonly isFragile: boolean;
  readonly isOversized: boolean;
  /** Cannot be consolidated with other items — ships in its own parcel. */
  readonly shipsSeparately: boolean;
  readonly freeShippingEligible: boolean;
  readonly warehouseLocation: string | null;
  readonly countryOfOrigin: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const SHIPPING_CLASSES = [
  "standard",
  "fragile",
  "oversized",
  "hazardous",
  "jewellery",
] as const;

export type ShippingClass = (typeof SHIPPING_CLASSES)[number];

/**
 * Volumetric ("dimensional") weight in grams, the figure couriers bill on when
 * a parcel is bulky but light. The 5000 divisor is the express-industry
 * standard for centimetres; here the maths is done in millimetres, hence
 * 5,000,000.
 */
export function volumetricWeightGrams(p: {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}): number {
  if (p.lengthMm <= 0 || p.widthMm <= 0 || p.heightMm <= 0) return 0;
  return Math.round((p.lengthMm * p.widthMm * p.heightMm) / 5000);
}

/** What a courier actually charges on: the greater of actual and volumetric. */
export function chargeableWeightGrams(p: {
  weightGrams: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}): number {
  return Math.max(p.weightGrams, volumetricWeightGrams(p));
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
