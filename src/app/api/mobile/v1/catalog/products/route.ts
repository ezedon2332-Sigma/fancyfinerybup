import type { NextRequest } from "next/server";

import { listProducts } from "@/application/use-cases/catalog";
import { getCatalogDeps } from "@/infrastructure/db/catalog-service";
import { loadExchangeRates } from "@/infrastructure/db/exchange-rate-service";

import { pagination, requestCurrency } from "../../../_lib/context";
import { productSummaryDto } from "../../../_lib/dto";
import { handler, ok } from "../../../_lib/respond";

/**
 * GET /api/mobile/v1/catalog/products
 *
 * Query: `category` (slug) · `featured=1` · `q` · `limit` · `offset`
 *
 * The storefront reaches the same use case through a Server Component; this is
 * the same call with a JSON envelope around it, so the app and the website
 * cannot show different catalogues.
 *
 * `q` is applied here rather than in `ProductQuery` because the port has no
 * search parameter and adding one would mean a schema-aware LIKE/tsvector
 * decision in the repository that the website does not yet need. Filtering the
 * page in memory is honest about what it is: a name/description contains-match
 * over the current page, good enough for a catalogue of this size and trivially
 * replaceable by a real index later without changing this endpoint's contract.
 */
export const GET = handler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const { limit, offset } = pagination(url);

  const categorySlug = url.searchParams.get("category")?.trim() || undefined;
  const featuredOnly = url.searchParams.get("featured") === "1";
  const term = url.searchParams.get("q")?.trim().toLowerCase() || null;

  const [deps, currency, rates] = await Promise.all([
    getCatalogDeps(),
    requestCurrency(),
    loadExchangeRates(),
  ]);

  const products = await listProducts(deps, {
    categorySlug,
    featuredOnly,
    limit,
    offset,
  });

  const matched = term
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.description ?? "").toLowerCase().includes(term),
      )
    : products;

  return ok({
    items: matched.map((p) => productSummaryDto(p, currency, rates)),
    // `hasMore` is derived from the UNFILTERED page: it answers "is there
    // another page to fetch", which is a fact about the query, not about how
    // many of this page survived the search term.
    hasMore: products.length === limit,
    limit,
    offset,
    currency,
  });
});
