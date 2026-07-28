/** Reviews & ratings — vocabulary and pure helpers. No framework, no I/O. */

export const REVIEW_STATUSES = ["pending", "approved", "rejected", "spam"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const FIT_FEEDBACK = [
  { id: "small", label: "Runs small" },
  { id: "true", label: "True to size" },
  { id: "large", label: "Runs large" },
] as const;
export type FitFeedback = (typeof FIT_FEEDBACK)[number]["id"];

export function fitFeedbackLabel(id: string | null): string | null {
  return FIT_FEEDBACK.find((f) => f.id === id)?.label ?? null;
}

/** Reviews per IP inside the window — a cheap brake on flooding. */
export const REVIEW_RATE_LIMIT = { max: 3, windowMinutes: 60 } as const;

export interface Review {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  verified: boolean;
  status: ReviewStatus;
  fitFeedback: FitFeedback | null;
  helpfulCount: number;
  createdAt: string;
}

export interface RatingSummary {
  /** Mean to one decimal, 0 when there are none. */
  average: number;
  count: number;
  /** Reviews at each star, 1..5. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  /** Share reporting each fit, null when nobody has said. */
  fit: { small: number; true: number; large: number } | null;
}

/**
 * Average from the denormalised sum and count.
 *
 * Kept as sum+count on the product rather than a stored average because an
 * average cannot be updated correctly without also knowing the count, and a
 * rounded average accumulates error every time a review lands.
 */
export function averageFromTotals(sum: number, count: number): number {
  if (count <= 0) return 0;
  return Math.round((sum / count) * 10) / 10;
}

/** Summary for a set of reviews, for the product page breakdown. */
export function summarise(reviews: Review[]): RatingSummary {
  const approved = reviews.filter((r) => r.status === "approved");
  const distribution: RatingSummary["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  const fitCounts = { small: 0, true: 0, large: 0 };
  let fitTotal = 0;

  for (const r of approved) {
    const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[star] += 1;
    sum += r.rating;
    if (r.fitFeedback) {
      fitCounts[r.fitFeedback] += 1;
      fitTotal += 1;
    }
  }

  return {
    average: averageFromTotals(sum, approved.length),
    count: approved.length,
    distribution,
    fit:
      fitTotal === 0
        ? null
        : {
            small: Math.round((fitCounts.small / fitTotal) * 100),
            true: Math.round((fitCounts.true / fitTotal) * 100),
            large: Math.round((fitCounts.large / fitTotal) * 100),
          },
  };
}

/** Whole, half and empty star counts for a 0–5 average. */
export function starParts(average: number): {
  full: number;
  half: boolean;
  empty: number;
} {
  const clamped = Math.max(0, Math.min(5, average));
  const full = Math.floor(clamped);
  // Half only in the middle of a step; .9 reads as a whole star, not a half.
  const remainder = clamped - full;
  const half = remainder >= 0.25 && remainder < 0.75;
  const rounded = remainder >= 0.75 ? full + 1 : full;
  return {
    full: half ? full : rounded,
    half,
    empty: 5 - (half ? full + 1 : rounded),
  };
}
