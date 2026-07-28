import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Award, Globe2, Leaf, Scissors, Sparkles, Truck } from "lucide-react";

import { PAGE, Card } from "@/components/ui";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "Fancy Finery is a luxury fashion house making a small number of pieces each season, cut by hand and delivered worldwide.",
  alternates: { canonical: "/about" },
};

const VALUES = [
  {
    icon: Scissors,
    title: "Cut by hand",
    body: "Each piece is made in a small atelier rather than on a production line. A garment leaves only when the finishing is right.",
  },
  {
    icon: Award,
    title: "Fabric before ornament",
    body: "Silk, wool and cotton chosen for how they fall and how they age. We would rather spend on cloth than on trim.",
  },
  {
    icon: Leaf,
    title: "Small runs",
    body: "A limited number of each piece. Less waste, and nothing arriving everywhere at once.",
  },
  {
    icon: Globe2,
    title: "Delivered worldwide",
    body: "Tracked shipping to more than two hundred countries, priced by weight and published openly.",
  },
] as const;

export default function AboutPage() {
  return (
    <div>
      {/* Opening statement */}
      <section className="relative overflow-hidden border-b border-white/8 py-20 lg:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[460px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.10),transparent_70%)] blur-3xl"
        />
        <div className={`${PAGE} relative`}>
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-yellow-600/40 px-4 py-1.5 text-[10px] uppercase tracking-[0.3em] text-yellow-500">
              <Sparkles className="h-3 w-3" /> Our Story
            </p>
            <h1 className="brand-wordmark mt-7 text-3xl leading-tight tracking-[0.04em] sm:text-4xl lg:text-5xl">
              Quietly made, carefully worn
            </h1>
            <p className="mt-7 text-sm leading-loose text-gray-300 sm:text-base">
              {SITE_NAME} began with a simple objection: that luxury had come to
              mean a logo rather than a garment.
            </p>
          </div>
        </div>
      </section>

      {/* The house */}
      <section className={`${PAGE} py-16 lg:py-24`}>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10">
            <Image
              src="/images/Hero-model.png"
              alt="A Fancy Finery piece photographed in the atelier"
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover object-top"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"
            />
          </div>

          <div>
            <h2 className="font-display text-2xl text-white sm:text-3xl">
              A small house, on purpose
            </h2>
            <div className="mt-6 space-y-4 text-sm leading-loose text-gray-300">
              <p>
                We make a small number of pieces each season. That is a
                deliberate limit rather than a constraint we are working around:
                it is what lets a cutter spend an afternoon on a single shoulder,
                and what lets us turn down a fabric that photographs beautifully
                but wears badly.
              </p>
              <p>
                Our pieces are drafted for real proportions and finished so they
                still look considered on the fifth wearing rather than only the
                first. Seams are bound, hems are weighted, linings are chosen to
                sit rather than cling.
              </p>
              <p>
                Nothing is rushed. If a piece is not right, it does not leave the
                atelier — which occasionally means a style arrives a season late,
                and we would rather that than the alternative.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-y border-white/8 bg-[#080808] py-16 lg:py-20">
        <div className={PAGE}>
          <h2 className="text-center font-display text-2xl text-white sm:text-3xl">
            What we hold to
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <Card key={title} as="li" className="p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-yellow-600/30 bg-gradient-to-br from-yellow-500/12 to-transparent">
                  <Icon className="h-4 w-4 text-yellow-500" strokeWidth={1.5} />
                </span>
                <p className="mt-4 font-display text-lg text-white">{title}</p>
                <p className="mt-2 text-xs leading-relaxed text-gray-400">{body}</p>
              </Card>
            ))}
          </ul>
        </div>
      </section>

      {/* Practical, because an about page that answers nothing is decoration */}
      <section className={`${PAGE} py-16 lg:py-20`}>
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-2xl text-white">Practical matters</h2>
          <dl className="mt-8 space-y-6">
            <div className="border-l-2 border-yellow-600/40 pl-5">
              <dt className="font-display text-base text-white">
                Where do you ship?
              </dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-gray-400">
                Worldwide, by UPS. Rates are priced by destination and parcel
                weight and published in full on our{" "}
                <Link href="/shipping" className="text-yellow-400 underline underline-offset-4">
                  shipping rates
                </Link>{" "}
                page — your exact cost is confirmed at checkout with nothing
                added afterwards.
              </dd>
            </div>
            <div className="border-l-2 border-yellow-600/40 pl-5">
              <dt className="font-display text-base text-white">
                How should I choose a size?
              </dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-gray-400">
                Every product page has a size guide and a fit finder that
                suggests a size from your height and weight. Where customers have
                reviewed a piece, you will also see whether it runs small or
                large.
              </dd>
            </div>
            <div className="border-l-2 border-yellow-600/40 pl-5">
              <dt className="font-display text-base text-white">
                What if it is not right?
              </dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-gray-400">
                Thirty days to return an unworn piece.{" "}
                <Link href="/contact" className="text-yellow-400 underline underline-offset-4">
                  Write to us
                </Link>{" "}
                and we will arrange it.
              </dd>
            </div>
          </dl>

          <div className="mt-12 flex flex-col gap-3 sm:flex-row">
            <Link href="/collections" className="btn-gold">
              <span className="relative z-10">Explore the collection</span>
            </Link>
            <Link href="/lookbook" className="btn-gold-ghost">
              <Truck className="mr-2 h-4 w-4" /> View the lookbook
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
