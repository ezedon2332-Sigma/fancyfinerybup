import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Ambient gold dust. Fixed values rather than random so the server and client
 *  markup match exactly. [left%, top%, size px, drift px, duration s, delay s, peak opacity] */
const DUST: ReadonlyArray<[number, number, number, number, number, number, number]> = [
  [8, 82, 2, 26, 19, 0, 0.35],
  [16, 64, 1, -18, 24, 3.5, 0.28],
  [23, 91, 3, 14, 16, 1.2, 0.42],
  [31, 73, 1, 22, 21, 6, 0.24],
  [38, 96, 2, -12, 18, 2.4, 0.38],
  [44, 68, 1, 16, 26, 8.5, 0.22],
  [52, 88, 2, -24, 17, 4.8, 0.4],
  [58, 78, 1, 10, 23, 1.8, 0.26],
  [65, 94, 3, -16, 15, 7.2, 0.45],
  [71, 70, 1, 20, 25, 3, 0.23],
  [78, 86, 2, -10, 20, 5.6, 0.36],
  [85, 75, 1, 18, 22, 9, 0.25],
  [91, 92, 2, -20, 18, 2, 0.34],
  [12, 55, 1, 12, 27, 10.5, 0.2],
  [47, 52, 1, -14, 28, 12, 0.18],
  [82, 58, 1, 15, 26, 6.8, 0.21],
];

export function HeroSection() {
  return (
    // Sized to the viewport minus the fixed header, so the mark owns the
    // whole first screen without pushing the next section off-fold.
    <section className="hero-stage relative flex min-h-[calc(100svh-128px)] w-full items-center justify-center overflow-hidden lg:min-h-[calc(100svh-168px)]">
      {/* Matte black ground with a fine film grain and woven texture */}
      <div aria-hidden className="hero-grain pointer-events-none absolute inset-0" />

      {/* Spotlight from above, with a soft beam */}
      <div aria-hidden className="hero-spotlight pointer-events-none absolute inset-x-0 top-0 h-[78%]" />

      {/* Ambient gold pool washing the mark */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(88vw,620px)] w-[min(88vw,620px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(234,179,8,0.17),rgba(234,179,8,0.05)_46%,transparent_70%)] blur-3xl"
      />

      {/* Floating gold dust */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {DUST.map(([left, top, size, drift, duration, delay, opacity], i) => (
          <span
            key={i}
            className="hero-dust"
            style={
              {
                left: `${left}%`,
                top: `${top}%`,
                width: `${size}px`,
                height: `${size}px`,
                "--dust-x": `${drift}px`,
                "--dust-d": `${duration}s`,
                "--dust-delay": `${delay}s`,
                "--dust-o": opacity,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Edge vignette for cinematic depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(0,0,0,0.82)_100%)]"
      />

      {/* The mark */}
      <div className="relative flex w-full flex-col items-center px-6">
        <div className="hero-logo hero-logo-in">
          <Image
            src="/logo.png"
            alt="Fancy Finery — Elegance Redefined"
            width={1024}
            height={1024}
            quality={90}
            priority
            sizes="(min-width: 1024px) 540px, 82vw"
            className="hero-logo-img w-[min(82vw,clamp(240px,44vh,540px))]"
          />
        </div>

        <Link
          href="/collections"
          className="hero-cta group mt-10 inline-flex items-center gap-3 rounded-full px-10 py-4 text-xs font-semibold uppercase tracking-[0.28em] text-black sm:mt-14 sm:text-sm"
        >
          <span className="relative z-10">Shop Collection</span>
          <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}
