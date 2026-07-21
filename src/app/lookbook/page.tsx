import type { Metadata } from "next";

import {
  LookbookGallery,
  type LookItem,
} from "@/components/lookbook/LookbookGallery";
import { listProducts } from "@/application/use-cases/catalog";
import { getCatalogDeps } from "@/infrastructure/supabase/catalog-service";
import { resolveImageUrl } from "@/infrastructure/supabase/image-url";

export const metadata: Metadata = {
  title: "Lookbook",
  description:
    "The Fancy Finery lookbook — a cinematic campaign edit of the season's most coveted luxury pieces.",
};

export default async function LookbookPage() {
  const deps = await getCatalogDeps();
  const products = await listProducts(deps);
  const withImages = products.filter((p) => p.primaryImage);
  const items: LookItem[] = (withImages.length > 0 ? withImages : products)
    .slice(0, 8)
    .map((p) => ({
      image: p.primaryImage
        ? resolveImageUrl(p.primaryImage.storagePath)
        : "/image.jpeg",
      title: p.name,
      subtitle: p.description,
      href: `/products/${p.slug}`,
    }));

  return (
    <div>
      {/* Editorial intro */}
      <section className="relative flex min-h-[52vh] items-center justify-center overflow-hidden border-b border-yellow-600/20 bg-gradient-to-b from-neutral-950 to-black px-6 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.10),transparent_65%)]" />
        <div className="relative animate-fade-up">
          <p className="text-xs uppercase tracking-[8px] text-yellow-500">
            Campaign
          </p>
          <h1 className="mt-4 text-5xl leading-none sm:text-7xl lg:text-8xl">
            The Lookbook
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-gray-300 sm:text-lg">
            A cinematic edit of the season&apos;s most coveted pieces — styled
            to inspire. Hover to explore, click to shop the look.
          </p>
        </div>
      </section>

      {items.length > 0 ? (
        <LookbookGallery items={items} />
      ) : (
        <p className="py-24 text-center text-gray-400">
          The new campaign is coming soon.
        </p>
      )}
    </div>
  );
}
