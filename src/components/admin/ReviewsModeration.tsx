"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { BadgeCheck, Check, MessageSquare, Trash2, X } from "lucide-react";

import { moderateReview, removeReview } from "@/app/admin/reviews/actions";
import {
  REVIEW_STATUSES,
  fitFeedbackLabel,
  type Review,
  type ReviewStatus,
} from "@/domain/reviews";
import { Badge, Card, EmptyState, Notice, Spinner } from "@/components/ui";
import { Stars } from "@/components/catalog/Stars";

const TONE: Record<ReviewStatus, "gold" | "green" | "red" | "neutral"> = {
  pending: "gold",
  approved: "green",
  rejected: "neutral",
  spam: "red",
};

/**
 * Review moderation queue.
 *
 * Pending first by default, because that is the only status that needs action —
 * an approved review needs nothing from an admin, and burying the queue behind
 * a filter is how moderation quietly stops happening.
 */
export function ReviewsModeration({
  reviews,
  productNames,
  activeStatus,
}: {
  reviews: Review[];
  /** productId -> name, so the queue does not show bare UUIDs. */
  productNames: Record<string, string>;
  activeStatus: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const setFilter = (status: string) => {
    const next = new URLSearchParams(params.toString());
    if (status) next.set("status", status);
    else next.delete("status");
    start(() => router.push(`/admin/reviews?${next.toString()}`));
  };

  async function act(id: string, status: ReviewStatus) {
    setBusy(id);
    const res = await moderateReview({ id, status });
    setBusy(null);
    setNotice(res.ok ? (res.message ?? "Done.") : (res.error ?? "Failed."));
    router.refresh();
  }

  async function destroy(id: string) {
    if (!confirm("Delete this review permanently? This cannot be undone.")) return;
    setBusy(id);
    const res = await removeReview(id);
    setBusy(null);
    setNotice(res.ok ? (res.message ?? "Deleted.") : (res.error ?? "Failed."));
    router.refresh();
  }

  return (
    <section>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("")}
          aria-pressed={!activeStatus}
          className={chip(!activeStatus)}
        >
          All
        </button>
        {REVIEW_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            aria-pressed={activeStatus === s}
            className={chip(activeStatus === s)}
          >
            {s}
          </button>
        ))}
      </div>

      {notice && (
        <div className="mt-4">
          <Notice>{notice}</Notice>
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<MessageSquare className="h-5 w-5" />}
            title={activeStatus ? `No ${activeStatus} reviews` : "No reviews yet"}
            body="Reviews submitted from product pages arrive here for approval before they appear publicly."
          />
        </div>
      ) : (
        <ul className={`mt-6 space-y-3 ${pending ? "opacity-60" : ""}`}>
          {reviews.map((r) => (
            <Card key={r.id} as="li" className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars rating={r.rating} />
                    <Badge tone={TONE[r.status]}>{r.status}</Badge>
                    {r.verified && (
                      <Badge tone="green">
                        <BadgeCheck className="h-3 w-3" /> Verified
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {productNames[r.productId] ?? r.productId.slice(0, 8)} ·{" "}
                    {r.authorName} ·{" "}
                    {new Date(r.createdAt).toLocaleDateString()}
                    {r.fitFeedback && ` · ${fitFeedbackLabel(r.fitFeedback)}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {r.status !== "approved" && (
                    <IconButton
                      label="Approve"
                      onClick={() => act(r.id, "approved")}
                      disabled={busy === r.id}
                      tone="green"
                    >
                      <Check className="h-4 w-4" />
                    </IconButton>
                  )}
                  {r.status !== "rejected" && (
                    <IconButton
                      label="Reject"
                      onClick={() => act(r.id, "rejected")}
                      disabled={busy === r.id}
                    >
                      <X className="h-4 w-4" />
                    </IconButton>
                  )}
                  {r.status !== "spam" && (
                    <IconButton
                      label="Mark spam"
                      onClick={() => act(r.id, "spam")}
                      disabled={busy === r.id}
                      tone="red"
                    >
                      <span className="text-[10px] font-bold uppercase">Spam</span>
                    </IconButton>
                  )}
                  <IconButton
                    label="Delete permanently"
                    onClick={() => destroy(r.id)}
                    disabled={busy === r.id}
                    tone="red"
                  >
                    {busy === r.id ? <Spinner /> : <Trash2 className="h-4 w-4" />}
                  </IconButton>
                </div>
              </div>

              {r.title && (
                <p className="mt-3 font-display text-base text-white">{r.title}</p>
              )}
              {/* Plain text — customer copy is never treated as markup. */}
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-300">
                {r.body}
              </p>
            </Card>
          ))}
        </ul>
      )}
    </section>
  );
}

function chip(active: boolean): string {
  return `min-h-[36px] rounded-full border px-3.5 text-[11px] uppercase tracking-widest transition-colors ${
    active
      ? "border-yellow-500 bg-yellow-500/15 text-yellow-300"
      : "border-white/15 text-gray-400 hover:border-yellow-600/50 hover:text-yellow-400"
  }`;
}

function IconButton({
  label,
  onClick,
  disabled,
  tone = "neutral",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "green" | "red";
  children: React.ReactNode;
}) {
  const hover =
    tone === "green"
      ? "hover:bg-green-500/10 hover:text-green-400"
      : tone === "red"
        ? "hover:bg-red-500/10 hover:text-red-400"
        : "hover:bg-white/5 hover:text-yellow-400";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-10 min-w-10 items-center justify-center rounded-lg px-2 text-gray-400 transition-colors disabled:opacity-40 ${hover}`}
    >
      {children}
    </button>
  );
}
