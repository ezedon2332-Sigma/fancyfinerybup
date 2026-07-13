import "server-only";

import type { CatalogDeps } from "@/application/use-cases/catalog";
import { createSupabaseServerClient } from "./server-client";
import { createCategoryRepository } from "./repositories/category-repository";
import { createProductRepository } from "./repositories/product-repository";

/**
 * Composition root for storefront catalog reads. Builds the RLS-scoped server
 * client and wires the concrete repositories into the application use cases'
 * dependency shape. Server-only.
 */
export async function getCatalogDeps(): Promise<CatalogDeps> {
  const client = await createSupabaseServerClient();
  return {
    products: createProductRepository(client),
    categories: createCategoryRepository(client),
  };
}
