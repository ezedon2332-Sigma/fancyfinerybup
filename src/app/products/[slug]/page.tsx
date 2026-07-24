import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";

import { ProductDetail } from "@/components/catalog/ProductDetail";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { RequestColorSection } from "@/components/catalog/RequestColorSection";
import { TrackView } from "@/components/recent/TrackView";
import { RecentlyViewedRow } from "@/components/recent/RecentlyViewedRow";
import { getProductBySlug, listProducts } from "@/application/use-cases/catalog";
import { getCatalogDeps } from "@/infrastructure/supabase/catalog-service";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
import { getCurrentUser } from "@/infrastructure/supabase/auth";
import { resolveImageUrl } from "@/infrastructure/supabase/image-url";
import { SITE_URL, SITE_NAME } from "@/lib/site";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const deps = await getCatalogDeps();
  const product = await getProductBySlug(deps, slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: product.description ?? undefined,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const deps = await getCatalogDeps();
  const [product, user, allProducts] = await Promise.all([
    getProductBySlug(deps, slug),
    getCurrentUser(),
    listProducts(deps),
  ]);
  if (!product) notFound();

  // Recommendations — same category first, then fill with others.
  const sameCategory = allProducts.filter(
    (p) => p.id !== product.id && p.categoryId === product.categoryId,
  );
  const others = allProducts.filter(
    (p) => p.id !== product.id && p.categoryId !== product.categoryId,
  );
  const related = [...sameCategory, ...others].slice(0, 4);

  const thumb =
    product.images.find((m) => m.mediaType === "image") ?? product.images[0];

  const sizes = [
    ...new Set(
      product.variants.map((v) => v.size).filter((s): s is string => Boolean(s)),
    ),
  ];
  const sku = product.variants.find((v) => v.sku)?.sku ?? null;

  // Load the master colour list for the request dialog (falls back to the
  // built-in popular colours if the table isn't available).
  let colorOptions: { name: string; code: string | null }[] = [];
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("colors")
      .select("color_name, color_code")
      .eq("active", true)
      .order("color_name", { ascending: true });
    colorOptions = (data ?? []).map((c) => ({
      name: c.color_name,
      code: c.color_code,
    }));
  } catch {
    /* colours table not migrated yet — dialog uses its built-in list */
  }

  const abs = (u: string) => (u.startsWith("http") ? u : `${SITE_URL}${u}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: product.images
      .filter((m) => m.mediaType === "image")
      .slice(0, 5)
      .map((m) => abs(resolveImageUrl(m.storagePath))),
    ...(sku ? { sku } : {}),
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/products/${product.slug}`,
      priceCurrency: product.currency,
      price: (product.price / 100).toFixed(2),
      availability: product.variants.some((v) => v.stockQty > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TrackView
        item={{
          productId: product.id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          image: thumb ? resolveImageUrl(thumb.storagePath) : "/image.jpeg",
        }}
      />

      <Link
        href="/collections"
        className="mb-8 inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-yellow-400"
      >
        <ChevronLeft className="h-4 w-4" /> Back to collections
      </Link>

      <ProductDetail product={product} isAuthenticated={Boolean(user)} />

      <div className="mt-8 lg:max-w-md lg:ml-auto">
        <RequestColorSection
          productId={product.id}
          productName={product.name}
          productSku={sku}
          sizes={sizes}
          colors={colorOptions}
        />
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <p className="text-xs uppercase tracking-[6px] text-yellow-500">
            Curated for you
          </p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">You may also like</h2>
          <div className="mt-6">
            <ProductGrid products={related} />
          </div>
        </section>
      )}

      <RecentlyViewedRow currentId={product.id} />
    </div>
  );
}
