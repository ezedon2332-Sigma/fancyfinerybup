import { existsSync } from "node:fs";
import path from "node:path";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
        {/* Legibility gradients + gold vignette */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_40%,rgba(234,179,8,0.14),transparent_60%)]" />
      </div>

      {/* Copy */}
      <div className="relative mx-auto flex min-h-[86vh] max-w-7xl flex-col justify-center px-6 py-24 lg:px-10">
        <div className="max-w-2xl animate-fade-up">
          <p className="text-xs uppercase tracking-[8px] text-yellow-500 sm:text-sm sm:tracking-[10px]">
            Luxury Fashion House
          </p>
          <h1 className="mt-6 text-6xl font-semibold leading-[0.92] tracking-tight sm:text-7xl lg:text-8xl">
            Timeless
            <br />
            Elegance
          </h1>
          <p className="mt-7 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg">
            Experience fashion where luxury meets craftsmanship. Designed for
            those who appreciate excellence, confidence, and timeless style.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/collections"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-yellow-500 px-8 py-4 font-semibold text-black shadow-lg shadow-yellow-500/20 transition-all hover:-translate-y-0.5 hover:bg-yellow-400 hover:shadow-yellow-500/40"
            >
              Discover Collection
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/lookbook"
              className="inline-flex items-center justify-center rounded-full border border-white/70 px-8 py-4 font-medium backdrop-blur-sm transition-colors hover:bg-white hover:text-black"
            >
              Explore Lookbook
            </Link>
          </div>
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
