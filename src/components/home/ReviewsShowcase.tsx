import Link from "next/link";
import { BadgeCheck, Quote } from "lucide-react";

import { averageFromTotals, type Review } from "@/domain/reviews";
import { Card, PAGE, SectionHeading } from "@/components/ui";
import { Stars } from "@/components/catalog/Stars";

export type ShowcaseReview = Review & {
  productName: string;
  productSlug: string;
};

/**
 * Customer reviews on the homepage.
 *
 * Renders nothing at all when there is nothing to show. A testimonial strip
 * with one review, or with placeholder quotes, actively damages trust — an
 * empty section is better than a thin one, and this is a section that only
 * earns its place once real customers have written.
 */
export function ReviewsShowcase({
  reviews,
  totalSum,
  totalCount,
}: {
  reviews: ShowcaseReview[];
  /** Catalogue-wide totals, for the headline average. */
  totalSum: number;
  totalCount: number;
}) {
  if (reviews.length < 2) return null;

  const average = averageFromTotals(totalSum, totalCount);

  return (
    <section className={`${PAGE} py-16 lg:py-20`} aria-labelledby="reviews-showcase">
      <SectionHeading eyebrow="In their words" title="What our clients say" />

      {totalCount > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Stars rating={average} size="md" showValue />
          <span className="text-xs text-gray-500">
            from {totalCount} review{totalCount === 1 ? "" : "s"} across the
            collection
          </span>
        </div>
      )}

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((r) => (
          <Card key={r.id} as="li" interactive className="flex flex-col p-5">
            <Quote className="h-4 w-4 shrink-0 text-yellow-600/70" aria-hidden />

            {r.title && (
              <p className="mt-3 font-display text-base text-white">{r.title}</p>
            )}

            {/* Clamped rather than truncated with an ellipsis in the data, so
                the full text is still in the DOM for search engines. */}
            <p className="mt-2 line-clamp-5 flex-1 text-sm leading-relaxed text-gray-300">
              {r.body}
            </p>

            <div className="mt-4 border-t border-white/8 pt-3.5">
              <Stars rating={r.rating} />
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
                <span>{r.authorName}</span>
                {r.verified && (
                  <span className="inline-flex items-center gap-1 text-green-400">
                    <BadgeCheck className="h-3 w-3" /> Verified
                  </span>
                )}
              </div>
              {r.productSlug && (
                <Link
                  href={`/products/${r.productSlug}`}
                  className="mt-2 inline-block text-[11px] text-yellow-500 underline decoration-yellow-600/40 underline-offset-4 transition-colors hover:text-yellow-300"
                >
                  {r.productName}
                </Link>
              )}
            </div>
          </Card>
        ))}
      </ul>
    </section>
  );
}
