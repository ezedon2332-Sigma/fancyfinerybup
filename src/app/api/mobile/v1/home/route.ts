import { listCategories, listFeaturedProducts } from "@/application/use-cases/catalog";
import { getCatalogDeps } from "@/infrastructure/db/catalog-service";
import { loadExchangeRates } from "@/infrastructure/db/exchange-rate-service";
import { listLookbookEntries } from "@/infrastructure/db/lookbook-service";
import { listRecentApprovedReviews } from "@/infrastructure/db/review-service";

import { requestCurrency } from "../../_lib/context";
import { categoryDto, mediaUrl, productSummaryDto } from "../../_lib/dto";
import { handler, ok } from "../../_lib/respond";

/**
 * GET /api/mobile/v1/home — everything the home screen renders, in one call.
 *
 * The website composes this from five separate server components, which costs
 * it nothing because they run in one process beside the database. On a phone
 * each of those would be a separate round trip over a mobile network, and the
 * screen could not draw until the slowest finished. Composing server-side turns
 * five sequential waits into one.
 *
 * Every section degrades independently: a failure in reviews or the lookbook
 * returns an empty list rather than taking the home screen down with it. The
 * services already swallow their own errors for exactly this reason, so an
 * outage in one shelf leaves the rest of the shop standing.
 */
export const GET = handler(async () => {
  const [deps, currency, rates] = await Promise.all([
    getCatalogDeps(),
    requestCurrency(),
    loadExchangeRates(),
  ]);

  const [featured, categories, lookbook, reviews, newArrivals] = await Promise.all([
    listFeaturedProducts(deps, 8),
    listCategories(deps),
    listLookbookEntries(8),
    listRecentApprovedReviews(6),
    // Newest first is the repository's default ordering, so "new in" is simply
    // the first page with no featured filter.
    deps.products.listPublished({ limit: 8 }),
  ]);

  return ok({
    currency,
    featured: featured.map((p) => productSummaryDto(p, currency, rates)),
    newArrivals: newArrivals.map((p) => productSummaryDto(p, currency, rates)),
    categories: categories.map(categoryDto),
    lookbook: lookbook.map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      description: entry.description,
      imageUrl: mediaUrl(entry.storagePath),
    })),
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      authorName: r.authorName,
      verified: r.verified,
      productName: r.productName,
      productSlug: r.productSlug,
      createdAt: r.createdAt,
    })),
  });
});
