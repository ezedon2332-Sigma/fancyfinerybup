import { getProductBySlug } from "@/application/use-cases/catalog";
import { getCatalogDeps } from "@/infrastructure/db/catalog-service";
import { loadExchangeRates } from "@/infrastructure/db/exchange-rate-service";
import { listApprovedReviews } from "@/infrastructure/db/review-service";

import { requestCurrency } from "../../../../_lib/context";
import { productDetailDto } from "../../../../_lib/dto";
import { fail, handler, ok } from "../../../../_lib/respond";

/**
 * GET /api/mobile/v1/catalog/products/[slug]
 *
 * The product screen needs the garment, its media, its variants AND its reviews
 * to render. Those are three round trips on a phone network if the client has
 * to ask separately, so they are composed server-side into one response —
 * reviews included, since the product page always shows them.
 */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;

    const [deps, currency, rates] = await Promise.all([
      getCatalogDeps(),
      requestCurrency(),
      loadExchangeRates(),
    ]);

    const product = await getProductBySlug(deps, slug);
    if (!product) return fail("not_found", "That piece is no longer available.");

    const reviews = await listApprovedReviews(product.id);

    return ok({
      product: productDetailDto(product, currency, rates),
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        authorName: r.authorName,
        // Marks a review left by someone who actually bought the garment. The
        // app badges those, which is most of what makes a review row credible.
        verified: r.verified,
        fitFeedback: r.fitFeedback,
        helpfulCount: r.helpfulCount,
        createdAt: r.createdAt,
      })),
    });
  },
);
