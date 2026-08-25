import Link from "next/link";
import { rethrowFrameworkErrors } from "@/lib/rethrow-framework-errors";
import type { Metadata } from "next";

import { ProductSearch } from "@/components/catalog/ProductSearch";
import { listCategories, listProducts } from "@/application/use-cases/catalog";
import { getCatalogDeps } from "@/infrastructure/db/catalog-service";

export const metadata: Metadata = {
  title: "Collections",
  description: "Browse the Fancy Finery collection of luxury ready-to-wear.",
};

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  // Degrade to an empty grid on a catalogue outage rather than failing the
  // route — the filters and shell stay usable.
  let products: Awaited<ReturnType<typeof listProducts>> = [];
  let categories: Awaited<ReturnType<typeof listCategories>> = [];
  try {
    const deps = await getCatalogDeps();
    [products, categories] = await Promise.all([
      listProducts(deps, category ? { categorySlug: category } : undefined),
      listCategories(deps),
    ]);
  } catch (e) {
    rethrowFrameworkErrors(e);
    console.error("[collections] catalogue unavailable", e);
  }

  const active = category ?? "all";

  return (
    <div className="mx-auto max-w-7xl px-6 py-14 lg:px-10">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[6px] text-yellow-500">
          The Edit
        </p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Our Collections</h1>
      </div>

      {/* Category filter */}
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <FilterPill href="/collections" label="All" active={active === "all"} />
        {categories.map((cat) => (
          <FilterPill
            key={cat.slug}
            href={`/collections?category=${cat.slug}`}
            label={cat.name}
            active={active === cat.slug}
          />
        ))}
      </div>

      <div className="mt-12">
        <ProductSearch products={products} />
      </div>
    </div>
  );
}

function FilterPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-5 py-2 text-xs font-medium uppercase tracking-widest transition-colors ${
        active
          ? "border-yellow-500 bg-yellow-500 text-black"
          : "border-white/20 text-gray-300 hover:border-yellow-500 hover:text-yellow-400"
      }`}
    >
      {label}
    </Link>
  );
}
