import Link from "next/link";

import { ProductGrid } from "@/components/catalog/ProductGrid";
import type { ProductSummary } from "@/domain/entities/product";

export function ProductRow({
  eyebrow,
  title,
  viewAllHref,
  products,
}: {
  eyebrow: string;
  title: string;
  viewAllHref: string;
  products: ProductSummary[];
}) {
  if (products.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[6px] text-yellow-500">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h2>
        </div>
        <Link
          href={viewAllHref}
          className="hidden min-h-[44px] items-center text-sm font-semibold text-yellow-400 transition-colors hover:text-yellow-300 sm:inline-flex"
        >
          View all →
        </Link>
      </div>
      <ProductGrid products={products} />
    </section>
  );
}
