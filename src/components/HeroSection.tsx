import Image from "next/image";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto flex max-w-7xl flex-col-reverse items-center gap-8 px-6 py-12 lg:flex-row lg:gap-4 lg:px-10 lg:py-20">
        <div className="flex-1 text-center lg:text-left animate-fade-up">
          <p className="text-xs uppercase tracking-[6px] text-yellow-500 sm:text-sm sm:tracking-[8px]">
            Luxury Fashion House
          </p>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
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
              className="w-full rounded-sm bg-yellow-500 px-8 py-4 text-center font-semibold text-black transition-colors hover:bg-yellow-600 sm:w-auto"
            >
              Discover Collection
            </Link>
            <Link
              href="/contact"
              className="w-full rounded-sm border border-white/70 px-8 py-4 text-center transition-colors hover:bg-white hover:text-black sm:w-auto"
            >
              Learn More
            </Link>
          </div>
        </div>

        <div className="flex flex-1 justify-center lg:justify-end">
          <Image
            src="/images/Hero-model.png"
            alt="Luxury fashion model"
            width={640}
            height={820}
            priority
            className="w-full max-w-sm object-cover lg:max-w-md"
          />
        </div>
      </div>
    </section>
  );
}
