"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, X } from "lucide-react";

import { useWishlist } from "@/components/wishlist/WishlistProvider";
import { useCurrency } from "@/components/providers/CurrencyProvider";

export default function WishlistPage() {
  const { items, remove, clear } = useWishlist();
  const { format } = useCurrency();

  return (
    <div className="mx-auto max-w-7xl px-6 py-14 lg:px-10">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[6px] text-yellow-500">
          Saved for later
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl">Your Wishlist</h1>
      </div>

      {items.length === 0 ? (
        <div className="py-20 text-center">
          <Heart className="mx-auto h-10 w-10 text-gray-600" />
          <p className="mt-4 text-gray-400">Your wishlist is empty.</p>
          <Link
            href="/collections"
            className="mt-6 inline-block rounded-full bg-yellow-500 px-6 py-3 font-semibold text-black transition-colors hover:bg-yellow-400"
          >
            Browse collections
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
            <button
              type="button"
              onClick={clear}
              className="text-xs uppercase tracking-widest text-gray-400 transition-colors hover:text-red-400"
            >
              Clear all
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {items.map((i) => (
              <div key={i.productId} className="group relative">
                <button
                  type="button"
                  onClick={() => remove(i.productId)}
                  aria-label="Remove from wishlist"
                  className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white backdrop-blur transition-colors hover:bg-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
                <Link href={`/products/${i.slug}`} className="block">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-transparent transition-all duration-500 group-hover:-translate-y-1 group-hover:ring-yellow-500/40">
                    <Image
                      src={i.image}
                      alt={i.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-gray-100 transition-colors group-hover:text-yellow-400">
                      {i.name}
                    </h3>
                    <p className="whitespace-nowrap text-sm font-semibold text-yellow-400">
                      {format(i.price)}
                    </p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
