"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import type { ProductSummary } from "@/domain/entities/product";
import { resolveImageUrl } from "@/infrastructure/supabase/image-url";
import { useCurrency } from "@/components/providers/CurrencyProvider";

export function ProductCard({ product }: { product: ProductSummary }) {
  const { format } = useCurrency();
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
          {isVideo ? (
            <video
              src={src}
              muted
              loop
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
      </Link>
    </motion.div>
  );
}
