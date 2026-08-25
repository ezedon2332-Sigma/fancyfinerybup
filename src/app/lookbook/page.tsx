import type { Metadata } from "next";

import {
  LookbookGallery,
  type LookItem,
} from "@/components/lookbook/LookbookGallery";
import { listLookbookEntries } from "@/infrastructure/db/lookbook-service";
import { resolveMediaUrl } from "@/lib/media-url";

export const metadata: Metadata = {
  title: "Lookbook",
  description:
    "The Fancy Finery lookbook — a cinematic campaign edit of the season's most coveted luxury pieces.",
};

export default async function LookbookPage() {
  // The membership rule lives in listLookbookEntries: admin-flagged, published,
  // and carrying a still image. The page just renders what comes back — and
  // because every entry is guaranteed a real image, the old "/image.jpeg"
  // placeholder fallback is gone. A panel can no longer show a stock photo of
  // nothing in particular.
  const entries = await listLookbookEntries(12);

  const items: LookItem[] = entries.map((e) => ({
    image: resolveMediaUrl(e.storagePath),
    title: e.name,
    subtitle: e.description,
    href: `/products/${e.slug}`,
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
