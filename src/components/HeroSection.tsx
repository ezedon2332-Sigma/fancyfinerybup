import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-yellow-600/20 bg-gradient-to-br from-black via-neutral-950 to-[#241a08]">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-6 py-14 lg:grid-cols-2 lg:gap-4 lg:px-10 lg:py-24">
        {/* Copy */}
        <div className="order-2 text-center lg:order-1 lg:text-left animate-fade-up">
          <p className="text-xs uppercase tracking-[6px] text-yellow-500 sm:text-sm sm:tracking-[8px]">
            Luxury Fashion House
          </p>
          <h1 className="mt-5 text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            Timeless
            <br />
            Elegance
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg lg:mx-0">
            Experience fashion where luxury meets craftsmanship. Designed for
            those who appreciate excellence, confidence, and timeless style.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start">
            <Link
              href="/collections"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-yellow-500 px-8 py-4 font-semibold text-black shadow-lg shadow-yellow-500/20 transition-all hover:bg-yellow-400 hover:shadow-yellow-500/40 sm:w-auto"
            >
              Discover Collection
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/collections?category=women"
              className="inline-flex w-full items-center justify-center rounded-full border border-white/70 px-8 py-4 font-medium transition-colors hover:bg-white hover:text-black sm:w-auto"
            >
              Shop Now
            </Link>
          </div>
        </div>

        {/* Model */}
        <div className="relative order-1 flex justify-center lg:order-2 lg:justify-end">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.12),transparent_65%)]" />
          <Image
            src="/images/Hero-model.png"
            alt="Luxury fashion model"
            width={640}
            height={820}
            priority
            className="relative w-full max-w-xs object-cover drop-shadow-2xl sm:max-w-sm lg:max-w-md animate-fade-up"
          />
          <div className="absolute bottom-4 right-4 hidden items-center gap-2 lg:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          </div>
        </div>
      </div>
    </section>
  );
}
