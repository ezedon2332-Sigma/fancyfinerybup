import Image from "next/image";
import Link from "next/link";

/** Homepage hero: the brand mark alone on a matte black stage.
 *  The logo is rendered from the original asset at its native aspect ratio —
 *  never redrawn, recoloured or stretched. */
export function HeroSection() {
  return (
    <section className="hero-stage relative flex min-h-[calc(100svh-128px)] w-full items-center justify-center overflow-hidden lg:min-h-[calc(100svh-168px)]">
      {/* Soft gold ambience — sits behind the mark, never over it */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(90vw,680px)] w-[min(90vw,680px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(234,179,8,0.10),transparent_66%)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.9)_100%)]"
      />

      <div className="relative flex w-full flex-col items-center px-6 py-16 text-center">
        <Image
          src="/logo.png"
          alt="Fancy Finery — Elegance Redefined"
          width={1024}
          height={1024}
          quality={95}
          priority
          sizes="(min-width: 1024px) 480px, 78vw"
          className="hero-mark animate-fade-up w-[min(78vw,clamp(240px,46vh,480px))]"
        />

        <div
          className="animate-fade-up mt-12 flex w-full flex-col items-center justify-center gap-4 sm:mt-16 sm:w-auto sm:flex-row sm:gap-6"
          style={{ animationDelay: "0.25s" }}
        >
          <Link
            href="/collections"
            className="btn-gold w-full sm:w-auto"
          >
            <span className="relative z-10">Shop Now</span>
          </Link>
          <Link
            href="/lookbook"
            className="btn-gold-ghost w-full sm:w-auto"
          >
            Explore Collections
          </Link>
        </div>
      </div>
    </section>
  );
}
