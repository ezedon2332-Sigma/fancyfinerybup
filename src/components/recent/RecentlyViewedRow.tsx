"use client";

import Image from "next/image";
import Link from "next/link";

import { useRecentlyViewed } from "./RecentlyViewedProvider";
import { useCurrency } from "@/components/providers/CurrencyProvider";

/** Horizontal row of the shopper's recently-viewed products. */
export function RecentlyViewedRow({ currentId }: { currentId?: string }) {
  const { items } = useRecentlyViewed();
  const { format } = useCurrency();
  const list = items.filter((i) => i.productId !== currentId).slice(0, 6);
  if (list.length === 0) return null;

  return (
    <section className="mt-16">
      <p className="text-xs uppercase tracking-[6px] text-yellow-500">Your history</p>
      <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Recently viewed</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {list.map((i) => (
          <Link key={i.productId} href={`/products/${i.slug}`} className="group block">
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-transparent transition-all duration-500 group-hover:ring-yellow-500/40">
              <Image
                src={i.image}
                alt={i.name}
                fill
                sizes="(max-width: 640px) 50vw, 20vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
            <p className="mt-2 truncate text-xs text-gray-200 transition-colors group-hover:text-yellow-400">
              {i.name}
            </p>
            <p className="text-xs font-semibold text-yellow-400">
              {format(i.price)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
