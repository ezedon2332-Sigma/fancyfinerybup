import { listCategories } from "@/application/use-cases/catalog";
import { getCatalogDeps } from "@/infrastructure/db/catalog-service";

import { categoryDto } from "../../../_lib/dto";
import { handler, ok } from "../../../_lib/respond";

/** GET /api/mobile/v1/catalog/categories — the storefront's category list. */
export const GET = handler(async () => {
  const deps = await getCatalogDeps();
  const categories = await listCategories(deps);
  return ok({ items: categories.map(categoryDto) });
});
