import { ImageOff } from "lucide-react";

/**
 * Stands in for a product that has no photograph or video yet.
 *
 * This replaces `/image.jpeg`, a family portrait from the brand shoot that was
 * hardcoded as the fallback in four places. A product awaiting its photography
 * therefore advertised itself with a picture of four people in grey tulle —
 * which reads as the wrong item rather than as a missing one, and is worse than
 * showing nothing because a shopper cannot tell it is a placeholder.
 *
 * Deliberately not an image file: nothing to download, nothing to mistake for
 * the garment, and it inherits the card's own dark treatment so a gap in the
 * catalogue looks intentional rather than broken.
 */
export function MediaPlaceholder({ label }: { label?: string }) {
  return (
    <div
      role="img"
      aria-label={label ? `${label} — photograph coming soon` : "Photograph coming soon"}
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-neutral-800 via-neutral-900 to-black"
    >
      <ImageOff aria-hidden className="h-6 w-6 text-yellow-600/50" />
      <span className="px-3 text-center text-[10px] uppercase tracking-[0.25em] text-yellow-600/60">
        Coming soon
      </span>
    </div>
  );
}
