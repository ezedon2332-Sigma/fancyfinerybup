"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentProfile } from "@/infrastructure/supabase/auth";
import { hashIp } from "@/infrastructure/supabase/newsletter-service";
import { submitReview } from "@/infrastructure/supabase/review-service";
import { FIT_FEEDBACK } from "@/domain/reviews";

const schema = z.object({
  productId: z.string().uuid(),
  productSlug: z.string().trim().min(1).max(200),
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
  /** Hidden honeypot — populated only by bots. */
  website: z.string().max(0).optional(),
});

export interface ReviewResult {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Submit a review. Always lands as `pending`: nothing appears under a product
 * until an admin approves it.
 */
export async function submitReviewAction(input: unknown): Promise<ReviewResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "form");
      if (!fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  // Answer normally so a bot learns nothing from the response.
  if (parsed.data.website) return { ok: true, message: "Thank you — your review is with us for approval." };

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;

  // Signing in is not required to review, but it is what makes a verified badge
  // possible, since the purchase has to be traceable to someone.
  const profile = await getCurrentProfile().catch(() => null);

  try {
    const outcome = await submitReview({
      productId: parsed.data.productId,
      profileId: profile?.id ?? null,
      authorName: parsed.data.authorName,
      rating: parsed.data.rating,
      title: parsed.data.title?.trim() || null,
      body: parsed.data.body,
      fitFeedback: (parsed.data.fitFeedback ?? null) as never,
      ipHash: hashIp(ip),
    });

    if (outcome.kind === "rate-limited") {
      return {
        ok: false,
        error: "You have submitted several reviews recently. Please try again later.",
      };
    }
    if (outcome.kind === "duplicate") {
      return { ok: false, error: "You have already reviewed this piece." };
    }

    revalidatePath(`/products/${parsed.data.productSlug}`);
    return {
      ok: true,
      message: outcome.verified
        ? "Thank you. Your review is with us for approval and will show as a verified purchase."
        : "Thank you — your review is with us for approval.",
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
