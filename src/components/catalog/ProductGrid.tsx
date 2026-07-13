"use client";

import { motion } from "framer-motion";

import type { ProductSummary } from "@/domain/entities/product";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ products }: { products: ProductSummary[] }) {
  if (products.length === 0) {
    return (
      <p className="py-20 text-center text-gray-400">
        No products found. Check back soon.
      </p>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4"
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </motion.div>
  );
}
