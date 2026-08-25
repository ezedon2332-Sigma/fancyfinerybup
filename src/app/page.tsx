import { existsSync } from "node:fs";
import { rethrowFrameworkErrors } from "@/lib/rethrow-framework-errors";
import path from "node:path";

import { HeroSection } from "@/components/HeroSection";
import { PromoCards, type PromoItem } from "@/components/home/PromoCards";
import { ProductRow } from "@/components/home/ProductRow";
import { PriveCircleSection } from "@/components/newsletter/PriveCircleSection";
import { BrandStory } from "@/components/home/BrandStory";
import { ReviewsShowcase } from "@/components/home/ReviewsShowcase";
import { listRecentApprovedReviews } from "@/infrastructure/db/review-service";
import { listCategories, listProducts } from "@/application/use-cases/catalog";
import {
  listBestSellerProductIds,
  listTrendingProductIds,
} from "@/infrastructure/db/sales-service";
import { listMostFavoritedProductIds } from "@/infrastructure/db/favorites-service";
import { getCatalogDeps } from "@/infrastructure/db/catalog-service";
import { resolveMediaUrl } from "@/lib/media-url";

/** Prefer a dedicated hero/promo image (public/<slug>.<ext>) if the admin has
 *  dropped one in; otherwise fall back to the category's product image. */
function promoImage(slug: string, fallback: string | null): string | null {
  for (const ext of ["jpg", "jpeg", "png", "webp", "avif"]) {
    const rel = `${slug}.${ext}`;
    if (existsSync(path.join(process.cwd(), "public", rel))) return `/${rel}`;
  }
  return fallback;
}

/**
 * How many collections the promo strip shows. The layout is built for a small
 * number of large cards; beyond this the row stops being a feature and starts
 * being a list, which is what /collections is for.
 */
const PROMO_LIMIT = 3;

export default async function Home() {
  // A catalogue outage degrades the page rather than failing the route: the
  // hero, the newsletter and the whole shell still render. Previously any
  // Supabase blip took the homepage to the error boundary.
  let products: Awaited<ReturnType<typeof listProducts>> = [];
  let categories: Awaited<ReturnType<typeof listCategories>> = [];
  try {
    const deps = await getCatalogDeps();
    [products, categories] = await Promise.all([
      listProducts(deps),
      listCategories(deps),
    ]);
  } catch (e) {
    rethrowFrameworkErrors(e);
    console.error("[home] catalogue unavailable", e);
  }

  // Both swallow their own failures, so no extra guard is needed here.
  const [showcase, topSellers, recentSellers, mostFavorited] = await Promise.all([
    listRecentApprovedReviews(6),
    listBestSellerProductIds(8),
    listTrendingProductIds(8, 30),
    listMostFavoritedProductIds(8),
  ]);
  const ratingTotals = products.reduce(
    (acc, p) => ({ sum: acc.sum + p.ratingSum, count: acc.count + p.ratingCount }),
    { sum: 0, count: 0 },
  );

  // Category image lookup — first product with an actual IMAGE (skip
  // video-only products; a video URL can't render as a static promo image).
  const imgByCat: Record<string, string | null> = {};
  for (const cat of categories) {
    const sample = products.find(
      (p) => p.categoryId === cat.id && p.primaryImage?.mediaType === "image",
    );
    imgByCat[cat.slug] = sample?.primaryImage
      ? resolveMediaUrl(sample.primaryImage.storagePath)
      : null;
  }

  // Built from the categories an admin actually created, in their configured
  // sort order. This used to be a hardcoded ["women", "men", "children"] with
  // hardcoded names and taglines, filtered against the real categories — so a
  // store selling none of those three showed nothing, and a store selling
  // something else could never feature it. Name and tagline are the admin's
  // own words now; only the count is a layout decision.
  const promoItems: PromoItem[] = categories
    .filter((c) => products.some((p) => p.categoryId === c.id))
    .slice(0, PROMO_LIMIT)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      tagline: c.description ?? "",
      imageUrl: promoImage(c.slug, imgByCat[c.slug] ?? null),
    }));

  // Derived product rows from the catalogue.
  const byNewest = [...products].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
  const featured = products.filter((p) => p.featured);
  const newArrivals = byNewest.slice(0, 8);
  const featuredRow = (featured.length > 0 ? featured : byNewest).slice(0, 8);
  // "Most Loved" is now literally that: ordered by how many customers hearted
  // it. Favourites are a signal a young store has long before it has sales, so
  // this row fills in before Best Sellers can. Falls through to units sold, then
  // to newest, so it is never empty and never presents arbitrary order as a
  // ranking.
  const mostLoved =
    mostFavorited.length > 0
      ? mostFavorited
          .map((id) => products.find((p) => p.id === id))
          .filter((p): p is (typeof products)[number] => Boolean(p))
      : [];

  // Best Sellers is real: units actually sold, from order_items. It used to be
  // `sort((a, b) => b.price - a.price)` — the most EXPENSIVE products, labelled
  // as the most popular, which is a claim the data never supported. Products
  // with no sales yet fall back to newest so the row is never empty on a young
  // store.
  const bestSellers = (
    mostLoved.length > 0
      ? mostLoved
      : topSellers.length > 0
      ? topSellers
          .map((id) => products.find((p) => p.id === id))
          .filter((p): p is (typeof products)[number] => Boolean(p))
      : byNewest
  ).slice(0, 8);

  // Trending is recent sales — the same source, over the last 30 days only.
  // Previously this rotated the newest list by four positions, which produced
  // a stable arbitrary order that no customer behaviour influenced.
  const trending = (
    recentSellers.length > 0
      ? recentSellers
          .map((id) => products.find((p) => p.id === id))
          .filter((p): p is (typeof products)[number] => Boolean(p))
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
      <BrandStory />
      <ReviewsShowcase
        reviews={showcase}
        totalSum={ratingTotals.sum}
        totalCount={ratingTotals.count}
      />
      <PriveCircleSection />
    </div>
  );
}
