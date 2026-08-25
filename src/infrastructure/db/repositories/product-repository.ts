import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import type {
  ProductSummary,
  ProductWithDetails,
} from "@/domain/entities/product";
import type {
  ProductQuery,
  ProductRepository,
} from "@/domain/repositories/product-repository";
import type { Database } from "../client";
import { categories, products } from "../schema";
import { toProductSummary, toProductWithDetails } from "../mappers";

/**
 * Drizzle-backed ProductRepository.
 *
 * The `status = 'published'` filter is now load-bearing. Under Supabase it was
 * belt-and-braces — an RLS policy (`products_select_published_or_admin`) applied
 * it whether the query did or not, and the old adapter said as much. There is no
 * policy any more: this predicate IS the rule that keeps drafts and archived
 * products off the storefront. Every method here must carry it.
 */
export function createProductRepository(db: Database): ProductRepository {
  return {
    async listPublished(query: ProductQuery = {}): Promise<ProductSummary[]> {
      const filters = [eq(products.status, "published")];
      if (query.featuredOnly) filters.push(eq(products.featured, true));
      if (query.categorySlug) {
        // A subquery rather than a second round trip. If the slug matches no
        // category the IN list is empty and the result is [], which is the
        // behaviour the previous two-step lookup produced explicitly.
        filters.push(
          inArray(
            products.categoryId,
            db
              .select({ id: categories.id })
              .from(categories)
              .where(eq(categories.slug, query.categorySlug)),
          ),
        );
      }

      const rows = await db.query.products.findMany({
        where: and(...filters),
        with: { productImages: true },
        orderBy: [desc(products.featured), desc(products.createdAt)],
        ...(typeof query.limit === "number"
          ? { limit: query.limit, offset: query.offset ?? 0 }
          : {}),
      });

      return rows.map(toProductSummary);
    },

    async findPublishedBySlug(slug: string): Promise<ProductWithDetails | null> {
      const row = await db.query.products.findFirst({
        where: and(eq(products.slug, slug), eq(products.status, "published")),
        with: { productImages: true, productVariants: true },
      });
      return row ? toProductWithDetails(row) : null;
    },

    async findPublishedById(id: string): Promise<ProductWithDetails | null> {
      const row = await db.query.products.findFirst({
        where: and(eq(products.id, id), eq(products.status, "published")),
        with: { productImages: true, productVariants: true },
      });
      return row ? toProductWithDetails(row) : null;
    },
  };
}
