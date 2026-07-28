import { Star } from "lucide-react";

import { starParts } from "@/domain/reviews";

/**
 * Star rating, read-only.
 *
 * The half star is a full glyph clipped to 50% width rather than a separate
 * icon, so it lines up exactly with its neighbours at any size.
 *
 * Server-safe, so product cards can render it without becoming client
 * components.
 */
export function Stars({
  rating,
  size = "sm",
  showValue = false,
  count,
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  /** Review count, rendered after the stars when given. */
  count?: number;
}) {
  const { full, half, empty } = starParts(rating);
  const px = size === "lg" ? "h-5 w-5" : size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <span
      className="inline-flex items-center gap-1"
      role="img"
      aria-label={
        count !== undefined
          ? `${rating} out of 5, ${count} review${count === 1 ? "" : "s"}`
          : `${rating} out of 5`
      }
    >
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: full }, (_, i) => (
          <Star key={`f${i}`} className={`${px} fill-yellow-400 text-yellow-400`} />
        ))}
        {half && (
          <span className={`relative inline-block ${px}`}>
            <Star className={`absolute inset-0 ${px} text-yellow-400/30`} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
              <Star className={`${px} fill-yellow-400 text-yellow-400`} />
            </span>
          </span>
        )}
        {Array.from({ length: empty }, (_, i) => (
          <Star key={`e${i}`} className={`${px} text-white/20`} />
        ))}
      </span>

      {showValue && rating > 0 && (
        <span className="ml-1 text-xs font-medium tabular-nums text-gray-200">
          {rating.toFixed(1)}
        </span>
      )}
      {count !== undefined && (
        <span className="ml-1 text-[11px] text-gray-500">
          ({count})
        </span>
      )}
    </span>
  );
}
