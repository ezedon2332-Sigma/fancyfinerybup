import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ProductSummary,
  ProductWithDetails,
} from "@/domain/entities/product";
import type {
  ProductQuery,
  ProductRepository,
} from "@/domain/repositories/product-repository";
import type { Database } from "../database.types";
import { toProductSummary, toProductWithDetails } from "../mappers";

/**
 * Supabase-backed ProductRepository. Relies on RLS for the "published only"
 * rule (see migrations), so storefront reads are safe even without an explicit
 * status filter — but we filter anyway to be explicit and index-friendly.
 */
export function createProductRepository(
  client: SupabaseClient<Database>,
): ProductRepository {
  return {
    async listPublished(query: ProductQuery = {}): Promise<ProductSummary[]> {
      let q = client
        .from("products")
        .select("*, product_images(*)")
        .eq("status", "published");

      if (query.featuredOnly) q = q.eq("featured", true);
      if (query.categorySlug) {
        const { data: cat } = await client
          .from("categories")
          .select("id")
          .eq("slug", query.categorySlug)
          .maybeSingle();
        if (!cat) return [];
        q = q.eq("category_id", cat.id);
      }

      q = q.order("featured", { ascending: false }).order("created_at", {
        ascending: false,
      });
      if (typeof query.limit === "number") {
        q = q.range(query.offset ?? 0, (query.offset ?? 0) + query.limit - 1);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(toProductSummary);
    },

    async findPublishedBySlug(
      slug: string,
    ): Promise<ProductWithDetails | null> {
      const { data, error } = await client
        .from("products")
        .select("*, product_images(*), product_variants(*)")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data ? toProductWithDetails(data) : null;
    },

    async findPublishedById(id: string): Promise<ProductWithDetails | null> {
      const { data, error } = await client
        .from("products")
        .select("*, product_images(*), product_variants(*)")
        .eq("id", id)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data ? toProductWithDetails(data) : null;
    },
  };
}
