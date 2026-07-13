import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";

import { ProductDetail } from "@/components/catalog/ProductDetail";
import { getProductBySlug } from "@/application/use-cases/catalog";
import { getCatalogDeps } from "@/infrastructure/supabase/catalog-service";

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
  const product = await getProductBySlug(deps, slug);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <Link
        href="/collections"
        className="mb-8 inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-yellow-400"
      >
        <ChevronLeft className="h-4 w-4" /> Back to collections
      </Link>
      <ProductDetail product={product} />
    </div>
  );
}
