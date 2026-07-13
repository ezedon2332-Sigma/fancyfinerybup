import Link from "next/link";

import { HeroSection } from "@/components/HeroSection";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import {
  CategorySection,
  type CategoryTile,
} from "@/components/catalog/CategorySection";
import {
  listCategories,
  listProducts,
} from "@/application/use-cases/catalog";
import { getCatalogDeps } from "@/infrastructure/supabase/catalog-service";
import { resolveImageUrl } from "@/infrastructure/supabase/image-url";

export default async function Home() {
  const deps = await getCatalogDeps();
  const [products, categories] = await Promise.all([
    listProducts(deps),
    listCategories(deps),
  ]);

  const featured = products.filter((p) => p.featured).slice(0, 8);
  const showcase = (featured.length > 0 ? featured : products).slice(0, 8);

  const tiles: CategoryTile[] = categories.map((cat) => {
    const sample = products.find((p) => p.categoryId === cat.id);
    return {
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      imageUrl: sample?.primaryImage
        ? resolveImageUrl(sample.primaryImage.storagePath)
        : "/image.jpeg",
    };
  });

  return (
    <div>
      <HeroSection />

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[6px] text-yellow-500">
              Handpicked
            </p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
              Featured Pieces
            </h2>
          </div>
          <Link
            href="/collections"
            className="hidden text-sm font-semibold text-yellow-400 hover:text-yellow-300 sm:block"
          >
            View all →
          </Link>
        </div>
        <ProductGrid products={showcase} />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-10">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[6px] text-yellow-500">
            Explore
          </p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
            Shop by Category
          </h2>
        </div>
        <CategorySection items={tiles} />
      </section>
    </div>
  );
}
