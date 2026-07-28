"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, MessageSquare, PenLine, Star } from "lucide-react";

import { submitReviewAction } from "@/app/products/review-actions";
import {
  FIT_FEEDBACK,
  fitFeedbackLabel,
  summarise,
  type Review,
} from "@/domain/reviews";
import { Card, EmptyState, ErrorNote, FIELD, Field, Notice, Spinner } from "@/components/ui";
import { Stars } from "./Stars";

/**
 * Reviews on the product page: summary, star breakdown, fit consensus, the
 * list, and the write form.
 *
 * Submitted reviews do not appear immediately — they queue for approval — so
 * the confirmation says exactly that rather than implying the review is live.
 */
export function ReviewsSection({
  productId,
  productSlug,
  reviews,
  defaultName,
}: {
  productId: string;
  productSlug: string;
  reviews: Review[];
  /** Pre-filled for signed-in customers. */
  defaultName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [fit, setFit] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof submitReviewAction>> | null>(null);
  const [pending, start] = useTransition();

  const summary = summarise(reviews);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await submitReviewAction({
        productId,
        productSlug,
        rating,
        title: String(fd.get("title") ?? "") || null,
        body: String(fd.get("body") ?? ""),
        authorName: String(fd.get("authorName") ?? ""),
        fitFeedback: fit,
        website: String(fd.get("website") ?? ""),
      });
      setResult(res);
      if (res.ok) {
        setOpen(false);
        setRating(0);
        setFit(null);
      }
    });
  }

  const err = (k: string) => result?.fieldErrors?.[k];

  return (
    <section className="mt-16" aria-labelledby="reviews-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-yellow-500">
            Reviews
          </p>
          <h2 id="reviews-heading" className="mt-2 font-display text-2xl text-white">
            What our clients say
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-yellow-600/50 px-4 text-[11px] uppercase tracking-[0.16em] text-yellow-400 transition-colors hover:bg-yellow-500/10"
        >
          <PenLine className="h-3.5 w-3.5" />
          {open ? "Close" : "Write a review"}
        </button>
      </div>

      {result?.ok && result.message && (
        <div className="mt-5">
          <Notice>{result.message}</Notice>
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            onSubmit={onSubmit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <Card className="mt-6 p-5 sm:p-6">
              {/* Honeypot */}
              <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="rv-website">Leave empty</label>
                <input id="rv-website" name="website" tabIndex={-1} autoComplete="off" />
              </div>

              <fieldset>
                <legend className="text-[10px] uppercase tracking-[0.18em] text-gray-400">
                  Your rating
                </legend>
                <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const lit = (hover || rating) >= n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        onMouseEnter={() => setHover(n)}
                        aria-label={`${n} star${n === 1 ? "" : "s"}`}
                        aria-pressed={rating === n}
                        className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/5"
                      >
                        <Star
                          className={`h-5 w-5 transition-colors ${
                            lit ? "fill-yellow-400 text-yellow-400" : "text-white/25"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                {err("rating") && (
                  <p className="mt-1 text-[11px] text-red-400">{err("rating")}</p>
                )}
              </fieldset>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Your name" htmlFor="rv-name" error={err("authorName")}>
                  <input
                    id="rv-name"
                    name="authorName"
                    required
                    defaultValue={defaultName ?? ""}
                    className={FIELD}
                    placeholder="Adaeze O."
                  />
                </Field>
                <Field label="Headline" htmlFor="rv-title" optional error={err("title")}>
                  <input
                    id="rv-title"
                    name="title"
                    className={FIELD}
                    placeholder="Exquisite drape"
                  />
                </Field>
              </div>

              <div className="mt-4">
                <Field
                  label="Your review"
                  htmlFor="rv-body"
                  error={err("body")}
                  hint="A sentence or two on fabric, fit and finish is most useful to others."
                >
                  <textarea
                    id="rv-body"
                    name="body"
                    required
                    rows={4}
                    className={`${FIELD} min-h-[110px] py-3 leading-relaxed`}
                  />
                </Field>
              </div>

              <fieldset className="mt-5">
                <legend className="text-[10px] uppercase tracking-[0.18em] text-gray-400">
                  How did it fit? <span className="text-gray-600">(optional)</span>
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {FIT_FEEDBACK.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFit(fit === f.id ? null : f.id)}
                      aria-pressed={fit === f.id}
                      className={`min-h-[40px] rounded-full border px-4 text-xs transition-colors ${
                        fit === f.id
                          ? "border-yellow-500 bg-yellow-500/15 text-yellow-200"
                          : "border-white/15 text-gray-300 hover:border-yellow-600/50"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {result?.error && (
                <div className="mt-5">
                  <ErrorNote>{result.error}</ErrorNote>
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className="btn-gold mt-6 w-full disabled:opacity-60 sm:w-auto"
              >
                <span className="relative z-10 inline-flex items-center gap-2">
                  {pending ? <Spinner /> : null}
                  {pending ? "Sending…" : "Submit review"}
                </span>
              </button>
              <p className="mt-2.5 text-[11px] text-gray-600">
                Reviews are read before publishing, so yours will not appear
                straight away.
              </p>
            </Card>
          </motion.form>
        )}
      </AnimatePresence>

      {summary.count === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<MessageSquare className="h-5 w-5" />}
            title="No reviews yet"
            body="Be the first to share how this piece wears."
          />
        </div>
      ) : (
        <>
          {/* Summary */}
          <Card className="mt-8 grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
            <div className="text-center sm:pr-6 sm:text-left">
              <p className="font-display text-4xl text-white">
                {summary.average.toFixed(1)}
              </p>
              <div className="mt-2 flex justify-center sm:justify-start">
                <Stars rating={summary.average} size="md" />
              </div>
              <p className="mt-2 text-[11px] text-gray-500">
                {summary.count} review{summary.count === 1 ? "" : "s"}
              </p>
            </div>

            <div className="space-y-1.5 sm:border-l sm:border-white/10 sm:pl-6">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const n = summary.distribution[star];
                const pct = summary.count ? (n / summary.count) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2.5">
                    <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-gray-500">
                      {star}
                    </span>
                    <Star className="h-3 w-3 shrink-0 fill-yellow-600/60 text-yellow-600/60" />
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-[11px] tabular-nums text-gray-500">
                      {n}
                    </span>
                  </div>
                );
              })}

              {summary.fit && (
                <div className="mt-4 border-t border-white/10 pt-3.5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">
                    Fit
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
                    <span>
                      Runs small{" "}
                      <strong className="text-gray-200">{summary.fit.small}%</strong>
                    </span>
                    <span>
                      True to size{" "}
                      <strong className="text-yellow-300">{summary.fit.true}%</strong>
                    </span>
                    <span>
                      Runs large{" "}
                      <strong className="text-gray-200">{summary.fit.large}%</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* List */}
          <ul className="mt-6 space-y-4">
            {reviews
              .filter((r) => r.status === "approved")
              .map((r) => (
                <Card key={r.id} as="li" className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Stars rating={r.rating} />
                      {r.verified && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-green-400">
                          <BadgeCheck className="h-3.5 w-3.5" /> Verified purchase
                        </span>
                      )}
                    </div>
                    <time
                      dateTime={r.createdAt}
                      className="text-[11px] text-gray-600"
                    >
                      {new Date(r.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                  </div>

                  {r.title && (
                    <p className="mt-3 font-display text-base text-white">
                      {r.title}
                    </p>
                  )}
                  {/* Plain text, never HTML — customer copy is not markup. */}
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-300">
                    {r.body}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                    <span>{r.authorName}</span>
                    {r.fitFeedback && (
                      <span className="text-gray-600">
                        · {fitFeedbackLabel(r.fitFeedback)}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
          </ul>
        </>
      )}
    </section>
  );
}
