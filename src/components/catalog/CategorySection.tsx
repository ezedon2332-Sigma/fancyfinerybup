"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

export interface CategoryTile {
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string;
}

export function CategorySection({ items }: { items: CategoryTile[] }) {
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((cat, i) => (
        <motion.div
          key={cat.slug}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
        >
          <Link
            href={`/collections?category=${cat.slug}`}
            className="group relative block h-72 overflow-hidden rounded-3xl bg-neutral-900 sm:h-80"
          >
            <Image
              src={cat.imageUrl}
              alt={cat.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent p-6">
              <h3 className="text-2xl font-bold text-white">{cat.name}</h3>
              {cat.description && (
                <p className="mt-1 line-clamp-2 text-sm text-gray-300">
                  {cat.description}
                </p>
              )}
              <span className="mt-4 text-sm font-semibold text-yellow-400 transition-colors group-hover:text-yellow-300">
                Shop {cat.name} →
              </span>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
