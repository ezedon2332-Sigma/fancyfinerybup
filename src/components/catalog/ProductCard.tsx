"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";

import type { ProductSummary } from "@/domain/entities/product";
import { resolveImageUrl } from "@/infrastructure/supabase/image-url";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { averageFromTotals } from "@/domain/reviews";
import { Stars } from "./Stars";
import { useWishlist } from "@/components/wishlist/WishlistProvider";

export function ProductCard({ product }: { product: ProductSummary }) {
  const { format } = useCurrency();
  const { has, toggle } = useWishlist();
  const wished = has(product.id);
  const isVideo = product.primaryImage?.mediaType === "video";
  const src = product.primaryImage
    ? resolveImageUrl(product.primaryImage.storagePath)
    : "/image.jpeg";

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Link href={`/products/${product.slug}`} className="group block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-transparent transition-all duration-500 group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:shadow-black/60 group-hover:ring-yellow-500/40">
          <button
            type="button"
            aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle({
                productId: product.id,
                slug: product.slug,
                name: product.name,
                price: product.price,
                image: src,
              });
            }}
            /* 44x44 hit area with the visible pill left at its original size:
               the chrome lives on the inner span, so the card looks identical
               while the target is finger-sized. */
            className="group/wish absolute right-1 top-1 z-10 flex h-11 w-11 items-center justify-center lg:right-1.5 lg:top-1.5"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur transition-colors group-hover/wish:bg-black/70">
              <Heart
                className={`h-4 w-4 transition-colors ${wished ? "fill-yellow-500 text-yellow-500" : "text-white"}`}
              />
            </span>
          </button>
          {isVideo ? (
            <video
              src={src}
              muted
              loop
              autoPlay
              playsInline
              preload="metadata"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <Image
              src={src}
              alt={product.primaryImage?.alt ?? product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <span className="text-xs uppercase tracking-widest text-yellow-400">
              View product →
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-gray-100 transition-colors group-hover:text-yellow-400">
            {product.name}
          </h3>
          <p className="whitespace-nowrap text-sm font-semibold text-yellow-400">
            {format(product.price)}
          </p>
        </div>

        {/* Rating from the product's own denormalised aggregates, so a grid of
            twenty cards costs no extra queries. Hidden entirely with no
            reviews: an empty row of grey stars reads as a bad rating. */}
        {product.ratingCount > 0 && (
          <div className="mt-1.5">
            <Stars
              rating={averageFromTotals(product.ratingSum, product.ratingCount)}
              count={product.ratingCount}
            />
          </div>
        )}
      </Link>
    </motion.div>
  );
}
