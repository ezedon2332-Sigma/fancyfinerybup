import type { Category } from "@/domain/entities/category";
import type {
  ProductSummary,
  ProductWithDetails,
} from "@/domain/entities/product";
import type { CategoryRepository } from "@/domain/repositories/category-repository";
import type {
  ProductQuery,
  ProductRepository,
} from "@/domain/repositories/product-repository";

/**
 * Catalog use cases — application business rules for the storefront. Pure:
 * they depend only on domain ports, never on Supabase or Next. The delivery
 * layer supplies concrete repositories.
 */
export interface CatalogDeps {
  products: ProductRepository;
  categories: CategoryRepository;
}

export function listProducts(
  deps: CatalogDeps,
  query?: ProductQuery,
): Promise<ProductSummary[]> {
  return deps.products.listPublished(query);
}

export function listFeaturedProducts(
  deps: CatalogDeps,
  limit = 4,
): Promise<ProductSummary[]> {
  return deps.products.listPublished({ featuredOnly: true, limit });
}

export function getProductBySlug(
  deps: CatalogDeps,
  slug: string,
): Promise<ProductWithDetails | null> {
  return deps.products.findPublishedBySlug(slug);
}

export function listCategories(deps: CatalogDeps): Promise<Category[]> {
  return deps.categories.listAll();
}
