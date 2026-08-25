import "server-only";

import type { CatalogDeps } from "@/application/use-cases/catalog";
import { db } from "./client";
import { createCategoryRepository } from "./repositories/category-repository";
import { createProductRepository } from "./repositories/product-repository";

/**
 * Composition root for storefront catalogue reads. Wires the concrete
 * repositories into the application use cases' dependency shape.
 *
 * No longer async: the Supabase version had to `await createSupabaseServerClient()`
 * because that client read the session from `cookies()`. Catalogue reads carry
 * no user identity, so there is nothing to await — the storefront's visibility
 * rule (`status = 'published'`) lives in the repository, where it is the same
 * for everyone. Kept returning a Promise so the dozens of `await getCatalogDeps()`
 * call sites did not all have to change.
 */
export async function getCatalogDeps(): Promise<CatalogDeps> {
  return {
    products: createProductRepository(db),
    categories: createCategoryRepository(db),
  };
}
