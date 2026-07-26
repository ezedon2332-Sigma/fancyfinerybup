import Image from "next/image";
import Link from "next/link";

export interface PromoItem {
  name: string;
  slug: string;
  tagline: string;
  imageUrl: string | null;
}

export function PromoCards({ items }: { items: PromoItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
      <div className="animate-fade-up flex items-end justify-between gap-6">
        <h2 className="font-display text-xl uppercase tracking-[0.28em] text-yellow-500 sm:text-2xl sm:tracking-[0.34em]">
          Shop by Category
        </h2>
        <span
          aria-hidden
          className="mb-2 hidden h-px flex-1 bg-gradient-to-r from-yellow-600/50 to-transparent sm:block"
        />
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3 lg:gap-8">
        {items.map((p, i) => (
          <Link
            key={p.slug}
            href={`/collections?category=${p.slug}`}
            style={{ animationDelay: `${0.1 + i * 0.1}s` }}
            className="group animate-fade-up relative block aspect-[16/11] overflow-hidden rounded-lg border border-yellow-600/30 transition-colors duration-500 hover:border-yellow-500/70 md:aspect-[4/5]"
          >
            {p.imageUrl ? (
              <Image
                src={p.imageUrl}
                alt={p.name}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover brightness-[0.72] transition-all duration-[1200ms] ease-out group-hover:scale-110 group-hover:brightness-90"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-900 to-black" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />

            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center p-7 text-center lg:p-9">
              <h3 className="font-display text-3xl uppercase tracking-[0.18em] text-white lg:text-4xl">
                {p.name}
              </h3>
              <p className="mt-3 max-w-[18rem] text-sm leading-relaxed text-gray-300">
                {p.tagline}
              </p>
              <span className="mt-6 inline-flex items-center justify-center border border-yellow-600/60 px-7 py-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-yellow-100 transition-colors duration-500 group-hover:border-yellow-500 group-hover:bg-yellow-500 group-hover:text-black">
                Shop {p.name}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
