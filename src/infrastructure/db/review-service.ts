import "server-only";

import { and, count, desc, eq, gte, sql } from "drizzle-orm";

import {
  REVIEW_RATE_LIMIT,
  type FitFeedback,
  type Review,
  type ReviewStatus,
} from "@/domain/reviews";
import { db } from "./client";
import { orderItems, orders, productReviews, products } from "./schema";

/**
 * Reviews data access.
 *
 * Public reads are filtered to `approved` here rather than at the call site, so
 * a new surface cannot accidentally publish unmoderated text by forgetting the
 * filter.
 */

type Row = typeof productReviews.$inferSelect;

function toReview(r: Row): Review {
  return {
    id: r.id,
    productId: r.productId,
    authorName: r.authorName,
    rating: r.rating,
    title: r.title,
    body: r.body,
    verified: r.verified,
    status: r.status as ReviewStatus,
    fitFeedback: r.fitFeedback as FitFeedback | null,
    helpfulCount: r.helpfulCount,
    createdAt: r.createdAt,
  };
}

/** Approved reviews for a product. Never returns anything unmoderated. */
export async function listApprovedReviews(
  productId: string,
  limit = 50,
): Promise<Review[]> {
  try {
    const rows = await db
      .select()
      .from(productReviews)
      .where(
        and(
          eq(productReviews.productId, productId),
          eq(productReviews.status, "approved"),
        ),
      )
      .orderBy(desc(productReviews.createdAt))
      .limit(limit);
    return rows.map(toReview);
  } catch {
    // A reviews outage must not take a product page down.
    return [];
  }
}

/** Admin listing, any status. Callers must have passed requireAdmin(). */
export async function listReviewsForAdmin(status?: string): Promise<Review[]> {
  const rows = await db
    .select()
    .from(productReviews)
    .where(status ? eq(productReviews.status, status) : undefined)
    .orderBy(desc(productReviews.createdAt))
    .limit(300);
  return rows.map(toReview);
}

export interface SubmitInput {
  productId: string;
  profileId: string | null;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  fitFeedback: FitFeedback | null;
  ipHash: string | null;
}

export type SubmitOutcome =
  | { kind: "queued"; verified: boolean }
  | { kind: "duplicate" }
  | { kind: "rate-limited" };

/**
 * Record a review as `pending`.
 *
 * Verified-purchase status is resolved here from a delivered order, not taken
 * from the request — a client-supplied flag would be trivially forged, and the
 * badge is only worth showing if it cannot be.
 */
export async function submitReview(input: SubmitInput): Promise<SubmitOutcome> {
  if (input.ipHash) {
    const since = new Date(
      Date.now() - REVIEW_RATE_LIMIT.windowMinutes * 60_000,
    ).toISOString();
    const [row] = await db
      .select({ n: count() })
      .from(productReviews)
      .where(
        and(
          eq(productReviews.ipHash, input.ipHash),
          gte(productReviews.createdAt, since),
        ),
      );
    if ((row?.n ?? 0) >= REVIEW_RATE_LIMIT.max) return { kind: "rate-limited" };
  }

  // One per customer per product, enforced by a unique index too — this check
  // exists to return a friendly outcome rather than a constraint error.
  if (input.profileId) {
    const existing = await db.query.productReviews.findFirst({
      where: and(
        eq(productReviews.productId, input.productId),
        eq(productReviews.profileId, input.profileId),
      ),
      columns: { id: true },
    });
    if (existing) return { kind: "duplicate" };
  }

  // Verified when this customer has a delivered order containing the product.
  let orderId: string | null = null;
  if (input.profileId) {
    const [line] = await db
      .select({ orderId: orderItems.orderId })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orderItems.productId, input.productId),
          eq(orders.userId, input.profileId),
          eq(orders.status, "delivered"),
        ),
      )
      .limit(1);
    orderId = line?.orderId ?? null;
  }

  try {
    await db.insert(productReviews).values({
      productId: input.productId,
      profileId: input.profileId,
      authorName: input.authorName,
      rating: input.rating,
      title: input.title,
      body: input.body,
      fitFeedback: input.fitFeedback,
      orderId,
      verified: orderId !== null,
      status: "pending",
      ipHash: input.ipHash,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/duplicate|unique/i.test(message)) return { kind: "duplicate" };
    throw e;
  }

  return { kind: "queued", verified: orderId !== null };
}

export async function setReviewStatus(
  id: string,
  status: ReviewStatus,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await db
      .update(productReviews)
      .set({ status })
      .where(eq(productReviews.id, id));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteReview(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.delete(productReviews).where(eq(productReviews.id, id));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface ReviewCounts {
  pending: number;
  approved: number;
  rejected: number;
  spam: number;
}

export async function reviewCounts(): Promise<ReviewCounts> {
  // One grouped query instead of four head-count round trips.
  const rows = await db
    .select({ status: productReviews.status, n: count() })
    .from(productReviews)
    .groupBy(productReviews.status);

  const by = new Map(rows.map((r) => [r.status, r.n]));
  return {
    pending: by.get("pending") ?? 0,
    approved: by.get("approved") ?? 0,
    rejected: by.get("rejected") ?? 0,
    spam: by.get("spam") ?? 0,
  };
}

/**
 * Most recent approved reviews across the whole catalogue, for the homepage
 * testimonial strip.
 *
 * Filtered to reviews with a body long enough to be worth reading — a
 * three-word review is honest but makes a poor pull quote, and the homepage is
 * showcasing, not reporting. The length test now runs in SQL rather than
 * over-fetching 3x the rows and filtering in JavaScript.
 */
export async function listRecentApprovedReviews(
  limit = 6,
): Promise<(Review & { productName: string; productSlug: string })[]> {
  try {
    const rows = await db
      .select({
        review: productReviews,
        productName: products.name,
        productSlug: products.slug,
      })
      .from(productReviews)
      .innerJoin(products, eq(products.id, productReviews.productId))
      .where(
        and(
          eq(productReviews.status, "approved"),
          gte(productReviews.rating, 4),
          sql`length(btrim(${productReviews.body})) >= 60`,
        ),
      )
      .orderBy(desc(productReviews.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      ...toReview(r.review),
      productName: r.productName,
      productSlug: r.productSlug,
    }));
  } catch {
    return [];
  }
}
