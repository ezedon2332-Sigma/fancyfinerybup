import "server-only";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import {
  REVIEW_RATE_LIMIT,
  type FitFeedback,
  type Review,
  type ReviewStatus,
} from "@/domain/reviews";

/**
 * Reviews data access.
 *
 * Public reads are filtered to `approved` here rather than at the call site, so
 * a new surface cannot accidentally publish unmoderated text by forgetting the
 * filter.
 */

interface Row {
  id: string;
  product_id: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string;
  verified: boolean;
  status: ReviewStatus;
  fit_feedback: FitFeedback | null;
  helpful_count: number;
  created_at: string;
}

function toReview(r: Row): Review {
  return {
    id: r.id,
    productId: r.product_id,
    authorName: r.author_name,
    rating: r.rating,
    title: r.title,
    body: r.body,
    verified: r.verified,
    status: r.status,
    fitFeedback: r.fit_feedback,
    helpfulCount: r.helpful_count,
    createdAt: r.created_at,
  };
}

/** Approved reviews for a product. Never returns anything unmoderated. */
export async function listApprovedReviews(
  productId: string,
  limit = 50,
): Promise<Review[]> {
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("product_reviews")
      .select("*")
      .eq("product_id", productId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(limit);
    return ((data ?? []) as Row[]).map(toReview);
  } catch {
    // A reviews outage must not take a product page down.
    return [];
  }
}

/** Admin listing, any status. */
export async function listReviewsForAdmin(status?: string): Promise<Review[]> {
  const admin = createSupabaseAdminClient();
  let q = admin
    .from("product_reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (status) q = q.eq("status", status as ReviewStatus);
  const { data } = await q;
  return ((data ?? []) as Row[]).map(toReview);
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
export async function submitReview(
  input: SubmitInput,
): Promise<SubmitOutcome> {
  const admin = createSupabaseAdminClient();

  if (input.ipHash) {
    const since = new Date(
      Date.now() - REVIEW_RATE_LIMIT.windowMinutes * 60_000,
    ).toISOString();
    const { count } = await admin
      .from("product_reviews")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", input.ipHash)
      .gte("created_at", since);
    if ((count ?? 0) >= REVIEW_RATE_LIMIT.max) return { kind: "rate-limited" };
  }

  // One per customer per product, enforced by a unique index too — this check
  // exists to return a friendly outcome rather than a constraint error.
  if (input.profileId) {
    const { data: existing } = await admin
      .from("product_reviews")
      .select("id")
      .eq("product_id", input.productId)
      .eq("profile_id", input.profileId)
      .maybeSingle();
    if (existing) return { kind: "duplicate" };
  }

  // Verified when this customer has a delivered order containing the product.
  let orderId: string | null = null;
  if (input.profileId) {
    const { data: lines } = await admin
      .from("order_items")
      .select("order_id, orders!inner(user_id, status)")
      .eq("product_id", input.productId)
      .eq("orders.user_id", input.profileId)
      .eq("orders.status", "delivered")
      .limit(1);
    const first = (lines ?? [])[0] as { order_id?: string } | undefined;
    orderId = first?.order_id ?? null;
  }

  const { error } = await admin.from("product_reviews").insert({
    product_id: input.productId,
    profile_id: input.profileId,
    author_name: input.authorName,
    rating: input.rating,
    title: input.title,
    body: input.body,
    fit_feedback: input.fitFeedback,
    order_id: orderId,
    verified: orderId !== null,
    status: "pending",
    ip_hash: input.ipHash,
  });

  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { kind: "duplicate" };
    throw new Error(error.message);
  }
  return { kind: "queued", verified: orderId !== null };
}

export async function setReviewStatus(
  id: string,
  status: ReviewStatus,
): Promise<{ ok: boolean; error?: string }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("product_reviews")
    .update({ status })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteReview(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("product_reviews").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export interface ReviewCounts {
  pending: number;
  approved: number;
  rejected: number;
  spam: number;
}

export async function reviewCounts(): Promise<ReviewCounts> {
  const admin = createSupabaseAdminClient();
  const one = async (s: ReviewStatus) => {
    const { count } = await admin
      .from("product_reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", s);
    return count ?? 0;
  };
  const [pending, approved, rejected, spam] = await Promise.all([
    one("pending"),
    one("approved"),
    one("rejected"),
    one("spam"),
  ]);
  return { pending, approved, rejected, spam };
}

/**
 * Most recent approved reviews across the whole catalogue, for the homepage
 * testimonial strip.
 *
 * Filtered to reviews with a body long enough to be worth reading — a
 * three-word review is honest but makes a poor pull quote, and the homepage is
 * showcasing, not reporting. Joins the product name so each quote can link back
 * to what it is about.
 */
export async function listRecentApprovedReviews(
  limit = 6,
): Promise<(Review & { productName: string; productSlug: string })[]> {
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("product_reviews")
      .select("*, products!inner(name, slug)")
      .eq("status", "approved")
      .gte("rating", 4)
      .order("created_at", { ascending: false })
      .limit(limit * 3);

    const rows = (data ?? []) as (Row & {
      products: { name: string; slug: string } | null;
    })[];

    return rows
      .filter((r) => r.body.trim().length >= 60)
      .slice(0, limit)
      .map((r) => ({
        ...toReview(r),
        productName: r.products?.name ?? "",
        productSlug: r.products?.slug ?? "",
      }));
  } catch {
    return [];
  }
}
