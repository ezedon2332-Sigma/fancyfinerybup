import { existsSync } from "node:fs";
import path from "node:path";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BrandEmblem } from "./BrandEmblem";

/** Use a cinematic background video if the admin has dropped one in
 *  (public/hero.mp4 or .webm); otherwise fall back to the campaign still. */
function heroVideo(): string | null {
  for (const ext of ["mp4", "webm"]) {
    if (existsSync(path.join(process.cwd(), "public", `hero.${ext}`))) {
      return `/hero.${ext}`;
    }
  }
  return null;
}

export function HeroSection() {
  const video = heroVideo();

  return (
    <section className="relative min-h-[86vh] w-full overflow-hidden">
      {/* Cinematic backdrop */}
      <div className="absolute inset-0">
        {video ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/images/Hero-model.png"
            className="h-full w-full object-cover"
          >
            <source src={video} />
          </video>
        ) : (
          <Image
            src="/images/Hero-model.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="animate-ken-burns object-cover object-top"
          />
        )}
        {/* Legibility gradients + gold vignette, balanced for centred copy */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/45 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_15%,rgba(0,0,0,0.72)_78%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(234,179,8,0.13),transparent_62%)]" />
      </div>

      {/* Hero brand presentation — emblem, oversized wordmark, tagline, CTAs */}
      <div className="relative mx-auto flex min-h-[86vh] max-w-5xl flex-col items-center justify-center px-6 py-20 text-center sm:py-24">
        {/* Pool of gold light behind the lockup for cinematic depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[42%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(234,179,8,0.20),transparent_68%)] blur-2xl sm:h-[640px] sm:w-[640px]"
        />

        {/* Wrappers own the entrance animation so the emblem float and the
            wordmark sheen keep their own animation slots. */}
        <div className="relative animate-fade-up">
          <BrandEmblem className="hero-emblem h-24 w-auto sm:h-32 lg:h-40" />
        </div>

        <div
          className="relative mt-6 animate-fade-up sm:mt-8"
          style={{ animationDelay: "0.15s" }}
        >
          <h1 className="hero-wordmark whitespace-nowrap text-[2.25rem] leading-none tracking-[0.06em] sm:text-6xl sm:tracking-[0.08em] lg:text-7xl xl:text-[6rem]">
            FANCY FINERY
          </h1>
        </div>

        <p
          className="relative mt-6 flex items-center justify-center gap-4 text-[10px] uppercase tracking-[0.4em] text-yellow-100/85 animate-fade-up sm:mt-7 sm:gap-6 sm:text-xs sm:tracking-[0.5em]"
          style={{ animationDelay: "0.3s" }}
        >
          <span
            aria-hidden
            className="h-px w-8 bg-gradient-to-r from-transparent to-yellow-500/70 sm:w-20"
          />
          Timeless Elegance
          <span
            aria-hidden
            className="h-px w-8 bg-gradient-to-l from-transparent to-yellow-500/70 sm:w-20"
          />
        </p>

        <p
          className="relative mt-8 max-w-xl text-base leading-relaxed text-gray-300 animate-fade-up sm:text-lg"
          style={{ animationDelay: "0.42s" }}
        >
          Experience fashion where luxury meets craftsmanship. Designed for
          those who appreciate excellence, confidence, and timeless style.
        </p>

        <div
          className="relative mt-10 flex w-full flex-col items-center justify-center gap-4 animate-fade-up sm:w-auto sm:flex-row"
          style={{ animationDelay: "0.54s" }}
        >
          <Link
            href="/collections"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-yellow-500 px-8 py-4 font-semibold text-black shadow-lg shadow-yellow-500/20 transition-all hover:-translate-y-0.5 hover:bg-yellow-400 hover:shadow-yellow-500/40 sm:w-auto"
          >
            Discover Collection
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/lookbook"
            className="inline-flex w-full items-center justify-center rounded-full border border-white/70 px-8 py-4 font-medium backdrop-blur-sm transition-colors hover:bg-white hover:text-black sm:w-auto"
          >
            Explore Lookbook
          </Link>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-gray-400 sm:flex">
        <span className="text-[10px] uppercase tracking-[4px]">Scroll</span>
        <span className="h-10 w-px bg-gradient-to-b from-yellow-500 to-transparent" />
      </div>
    </section>
  );
}
