import type { Product, ProductWithDetails } from "../entities/product";

export interface ProductQuery {
  /** Restrict to a category slug. */
  readonly categorySlug?: string;
  /** Only featured products. */
  readonly featuredOnly?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

/** Port: storefront + admin reads/writes for products, independent of Supabase. */
export interface ProductRepository {
  /** Published products for the storefront. */
  listPublished(query?: ProductQuery): Promise<Product[]>;
  /** A single published product with images + variants, by slug. */
  findPublishedBySlug(slug: string): Promise<ProductWithDetails | null>;
}
