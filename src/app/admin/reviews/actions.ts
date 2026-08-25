"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/infrastructure/auth/session";
import {
  deleteReview,
  setReviewStatus,
} from "@/infrastructure/db/review-service";
import { REVIEW_STATUSES } from "@/domain/reviews";

export interface ModResult {
  ok: boolean;
  error?: string;
  message?: string;
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(REVIEW_STATUSES),
});

/** Approve, reject or mark spam. Approving is what makes a review public, and
 *  the product's rating aggregates are recomputed by a database trigger. */
export async function moderateReview(input: unknown): Promise<ModResult> {
  await requireAdmin();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid moderation request." };

  const res = await setReviewStatus(parsed.data.id, parsed.data.status);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/admin/reviews");
  // The product page shows approved reviews and its rating, both of which just
  // changed. Revalidating the collection too keeps card stars in step.
  revalidatePath("/collections");
  return { ok: true, message: `Review ${parsed.data.status}.` };
}

export async function removeReview(id: string): Promise<ModResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid review." };
  }
  const res = await deleteReview(id);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/admin/reviews");
  revalidatePath("/collections");
  return { ok: true, message: "Review deleted." };
}
