import { z } from "zod";

import { getProductBySlug } from "@/application/use-cases/catalog";
import { getCatalogDeps } from "@/infrastructure/db/catalog-service";
import { submitReview } from "@/infrastructure/db/review-service";
import { FIT_FEEDBACK, type FitFeedback } from "@/domain/reviews";

import { currentUser, jsonBody } from "../../../../../_lib/context";
import { fail, handler, ok } from "../../../../../_lib/respond";

/**
 * POST /api/mobile/v1/catalog/products/[slug]/reviews — leave a review.
 *
 * Keyed by slug, not id, because the app navigates by slug and because two
 * sibling route segments cannot use different parameter names. The product id
 * is resolved here, which has the useful side effect of rejecting a review
 * against an unpublished or non-existent product before it reaches the service.
 *
 * Signing in is not required — the website allows a guest review too — so this
 * uses `currentUser` rather than `requireUser`. When there IS a session the
 * profile id travels with the review, and that is what lets the service resolve
 * verified-purchase status from a delivered order.
 *
 * Three things are decided server-side and cannot be asserted by the client:
 * the review lands as `pending` and is never published unmoderated; the
 * verified badge comes from order history, not a request field; and the
 * duplicate and rate-limit checks live in the service.
 */

const schema = z.object({
  rating: z.number().int().min(1, "Choose a rating").max(5),
  title: z.string().trim().max(120).nullable().optional(),
  body: z
    .string()
    .trim()
    .min(10, "Please write at least a sentence")
    .max(4000, "That is longer than we can store"),
  authorName: z.string().trim().min(2, "Your name is required").max(80),
  fitFeedback: z
    .enum(FIT_FEEDBACK.map((f) => f.id) as [string, ...string[]])
    .nullable()
    .optional(),
});

export const POST = handler(
  async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;

    const body = await jsonBody(req);
    if (body === null) return fail("invalid_request", "Expected a JSON body.");

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(
        "invalid_request",
        issue?.message ?? "Invalid review.",
        issue?.path.join("."),
      );
    }
    const input = parsed.data;

    const deps = await getCatalogDeps();
    const product = await getProductBySlug(deps, slug);
    if (!product) return fail("not_found", "That piece is no longer available.");

    const user = await currentUser();

    /**
     * `ipHash` is null on purpose.
     *
     * The website hashes the caller's IP with `IP_HASH_SALT` to rate-limit
     * anonymous reviewers, which works because a browser request carries a
     * meaningful client address. Mobile traffic is heavily carrier-NATed, so
     * the same hash would put thousands of unrelated customers behind one
     * network into a single bucket and rate-limit the innocent ones. The
     * duplicate check — same product, same reviewer — still applies.
     */
    const outcome = await submitReview({
      productId: product.id,
      profileId: user?.id ?? null,
      authorName: input.authorName,
      rating: input.rating,
      title: input.title?.trim() || null,
      body: input.body,
      fitFeedback: (input.fitFeedback ?? null) as FitFeedback | null,
      ipHash: null,
    });

    switch (outcome.kind) {
      case "queued":
        return ok({
          status: "pending_review",
          verified: outcome.verified,
          message: outcome.verified
            ? "Thank you. Your review is with us for approval and will show as a verified purchase."
            : "Thank you — your review is with us for approval.",
        });
      case "duplicate":
        return fail("conflict", "You have already reviewed this piece.");
      case "rate-limited":
        return fail(
          "rate_limited",
          "You have submitted several reviews recently. Please try again later.",
        );
    }
  },
);
