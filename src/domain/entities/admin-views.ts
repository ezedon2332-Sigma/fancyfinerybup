import type { OrderStatus } from "./order";
import type { ProductStatus } from "./product";

/**
 * Read models for the admin screens.
 *
 * These lived in `src/infrastructure/supabase/admin-service.ts`, which meant
 * `CategoryManager.tsx`, `ProductForm.tsx`, `CustomersTable.tsx` and
 * `NigeriaShippingPanel.tsx` imported their prop types from a Supabase module —
 * a database row shape reaching all the way into JSX. Declaring them here
 * inverts that: the shapes are the domain's, and the infrastructure layer's job
 * is to produce them.
 *
 * They are deliberately NOT the entities in this folder. An admin table needs a
 * denormalised row (category *name*, media count, item count) that no aggregate
 * should be forced to carry; keeping them apart lets each change independently.
 */

export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  featured: boolean;
  price: number;
  currency: string;
  categoryName: string | null;
  thumbnail: string | null;
  mediaCount: number;
}

export interface AdminProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceNaira: number;
  categoryId: string | null;
  status: ProductStatus;
  featured: boolean;
  /** Appears on the Lookbook page (see lookbook-service for the full rule). */
  lookbook: boolean;
  weightGrams: number;
  weightUnit: "g" | "kg";
  media: {
    storagePath: string;
    mediaType: "image" | "video";
    alt: string | null;
  }[];
  variants: {
    id: string;
    size: string | null;
    color: string | null;
    sku: string | null;
    stockQty: number;
  }[];
}

export interface AdminCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  productCount: number;
}

export interface AdminOrderRow {
  id: string;
  status: OrderStatus;
  paymentStatus: string;
  total: number;
  currency: string;
  customerName: string | null;
  customerEmail: string | null;
  createdAt: string;
  itemCount: number;
}
