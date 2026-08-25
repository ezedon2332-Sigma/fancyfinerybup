/**
 * Loading state for the collections grid.
 *
 * Next renders this automatically while the page's server components resolve —
 * no state, no spinner logic in the page itself.
 *
 * Skeletons rather than a spinner, and deliberately: they occupy the same
 * layout the real grid will, so nothing jumps when the products arrive. A
 * centred spinner would leave the page empty and then shove the content in.
 * The shimmer is a single CSS animation over a gradient, so it costs one
 * composited layer rather than a repaint per card.
 */
function CardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* 3:4, matching ProductCard's aspect ratio. */}
      <div className="aspect-[3/4] w-full rounded-xl bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-white/[0.06]" />
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="h-3.5 w-2/3 rounded bg-white/[0.06]" />
        <div className="h-3.5 w-14 shrink-0 rounded bg-white/[0.06]" />
      </div>
      <div className="mt-2 h-3 w-1/3 rounded bg-white/[0.04]" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-10">
      {/* Header placeholder, same rhythm as the real one. */}
      <div className="animate-pulse">
        <div className="h-3 w-24 rounded bg-yellow-500/20" />
        <div className="mt-3 h-9 w-56 rounded bg-white/[0.07]" />
        <div className="mt-3 h-3.5 w-80 max-w-full rounded bg-white/[0.04]" />
      </div>

      {/* Filter chips. */}
      <div className="mt-8 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-24 animate-pulse rounded-full bg-white/[0.05]"
            // Staggered so the row reads as a sequence rather than one block
            // flashing in unison.
            style={{ animationDelay: `${i * 70}ms` }}
          />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ animationDelay: `${i * 60}ms` }}>
            <CardSkeleton />
          </div>
        ))}
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        Loading collections…
      </span>
    </div>
  );
}
