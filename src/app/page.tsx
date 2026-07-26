import { existsSync } from "node:fs";
import path from "node:path";

import { HeroSection } from "@/components/HeroSection";
import { PromoCards, type PromoItem } from "@/components/home/PromoCards";
import { ProductRow } from "@/components/home/ProductRow";
import { listCategories, listProducts } from "@/application/use-cases/catalog";
import { getCatalogDeps } from "@/infrastructure/supabase/catalog-service";
import { resolveImageUrl } from "@/infrastructure/supabase/image-url";

/** Prefer a dedicated hero/promo image (public/<slug>.<ext>) if the admin has
 *  dropped one in; otherwise fall back to the category's product image. */
function promoImage(slug: string, fallback: string | null): string | null {
  for (const ext of ["jpg", "jpeg", "png", "webp", "avif"]) {
    const rel = `${slug}.${ext}`;
    if (existsSync(path.join(process.cwd(), "public", rel))) return `/${rel}`;
  }
  return fallback;
}

const PROMO_META: Record<string, { name: string; tagline: string }> = {
  men: { name: "Men", tagline: "Sophisticated styles for the modern man." },
  women: { name: "Women", tagline: "Elegant designs for every occasion." },
  children: { name: "Children", tagline: "Premium fashion for the little ones." },
};
// Reference layout leads with Women, then Men, then Children.
const PROMO_ORDER = ["women", "men", "children"];

export default async function Home() {
  const deps = await getCatalogDeps();
  const [products, categories] = await Promise.all([
    listProducts(deps),
    listCategories(deps),
  ]);

  // Category image lookup — first product with an actual IMAGE (skip
  // video-only products; a video URL can't render as a static promo image).
  const imgByCat: Record<string, string | null> = {};
  for (const cat of categories) {
    const sample = products.find(
      (p) => p.categoryId === cat.id && p.primaryImage?.mediaType === "image",
    );
    imgByCat[cat.slug] = sample?.primaryImage
      ? resolveImageUrl(sample.primaryImage.storagePath)
      : null;
  }

  const promoItems: PromoItem[] = PROMO_ORDER.filter((slug) =>
    categories.some((c) => c.slug === slug),
  ).map((slug) => ({
    slug,
    name: PROMO_META[slug].name,
    tagline: PROMO_META[slug].tagline,
    imageUrl: promoImage(slug, imgByCat[slug] ?? null),
  }));

  // Derived product rows from the catalogue.
  const byNewest = [...products].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
  const featured = products.filter((p) => p.featured);
  const newArrivals = byNewest.slice(0, 8);
  const featuredRow = (featured.length > 0 ? featured : byNewest).slice(0, 8);
  const bestSellers = [...products].sort((a, b) => b.price - a.price).slice(0, 8);
  const trending = (
    byNewest.length > 4
      ? [...byNewest.slice(4), ...byNewest.slice(0, 4)]
      : byNewest
  ).slice(0, 8);

  return (
    <div>
      <HeroSection />
      <PromoCards items={promoItems} />
      <ProductRow eyebrow="Just In" title="New Arrivals" viewAllHref="/collections" products={newArrivals} />
      <ProductRow eyebrow="Handpicked" title="Featured Collection" viewAllHref="/collections" products={featuredRow} />
      <ProductRow eyebrow="Most Loved" title="Best Sellers" viewAllHref="/collections" products={bestSellers} />
      <ProductRow eyebrow="What's Hot" title="Trending Now" viewAllHref="/collections" products={trending} />
    </div>
  );
}
