import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface PromoItem {
  name: string;
  slug: string;
  tagline: string;
  imageUrl: string | null;
}

export function PromoCards({ items }: { items: PromoItem[] }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-6 lg:px-10">
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((p) => (
          <Link
            key={p.slug}
            href={`/collections?category=${p.slug}`}
            className="group relative aspect-[16/11] overflow-hidden rounded-2xl border border-white/10 md:aspect-[4/5]"
          >
            {p.imageUrl ? (
              <Image
                src={p.imageUrl}
                alt={p.name}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-900 to-black" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <h3 className="text-2xl font-bold text-white">{p.name}</h3>
              <p className="mt-1 max-w-[16rem] text-sm text-gray-300">{p.tagline}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-yellow-400">
                Shop Now
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
