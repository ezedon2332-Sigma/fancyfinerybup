import Link from "next/link";
import { Award, Globe2, Scissors, Sparkles } from "lucide-react";

import { PAGE } from "@/components/ui";

/**
 * Brand story.
 *
 * Deliberately typographic rather than photographic: the homepage already
 * carries a great deal of imagery, and another full-bleed photograph here
 * competes with the product rows rather than giving the eye somewhere to rest.
 * Luxury houses use a quiet editorial block at exactly this point for the same
 * reason.
 */
const PILLARS = [
  {
    icon: Scissors,
    title: "Made by hand",
    body: "Every piece is cut and finished by a small atelier, not a production line.",
  },
  {
    icon: Award,
    title: "Fabric first",
    body: "Silk, wool and cotton chosen for how they fall and how they age.",
  },
  {
    icon: Globe2,
    title: "Delivered worldwide",
    body: "Tracked shipping to over two hundred countries, priced honestly by weight.",
  },
] as const;

export function BrandStory() {
  return (
    <section
      className="relative overflow-hidden border-y border-white/8 bg-[#080808] py-20 lg:py-28"
      aria-labelledby="story-heading"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.08),transparent_70%)] blur-3xl"
      />

      <div className={`${PAGE} relative`}>
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-yellow-600/40 px-4 py-1.5 text-[10px] uppercase tracking-[0.3em] text-yellow-500">
            <Sparkles className="h-3 w-3" /> The House
          </p>

          <h2
            id="story-heading"
            className="brand-wordmark mt-7 text-3xl leading-tight tracking-[0.04em] sm:text-4xl"
          >
            Quietly made, carefully worn
          </h2>

          <p className="mt-6 text-sm leading-loose text-gray-300 sm:text-base">
            Fancy Finery began with a simple objection: that luxury had come to
            mean a logo rather than a garment. We make a small number of pieces
            each season, in fabrics chosen for how they move, cut so they still
            look considered on the fifth wearing rather than only the first.
          </p>
          <p className="mt-4 text-sm leading-loose text-gray-400">
            Nothing is rushed and nothing is mass-produced. If a piece is not
            right, it does not leave the atelier.
          </p>
        </div>

        <ul className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-yellow-600/30 bg-gradient-to-br from-yellow-500/12 to-transparent">
                <Icon className="h-5 w-5 text-yellow-500" strokeWidth={1.5} />
              </span>
              <p className="mt-4 font-display text-lg text-white">{title}</p>
              <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-gray-400">
                {body}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/about" className="btn-gold-ghost">
            Our story
          </Link>
          <Link href="/lookbook" className="btn-gold">
            <span className="relative z-10">View the lookbook</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
