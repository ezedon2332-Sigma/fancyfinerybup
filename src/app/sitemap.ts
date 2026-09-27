import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";
import { getCatalogDeps } from "@/infrastructure/db/catalog-service";
import { listCategories, listProducts } from "@/application/use-cases/catalog";

/**
 * Rendered per request, not at build.
 *
 * Next prerenders a sitemap by default, and the build runs inside `docker
 * build` where DATABASE_URL does not exist — so `getCatalogDeps()` threw, the
 * catch below swallowed it, and the published sitemap was permanently the four
 * static routes. No product or collection was ever submitted for indexing, and
 * nothing said so.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/collections`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/lookbook`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/shipping`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  let dynamic: MetadataRoute.Sitemap = [];
  try {
    const deps = await getCatalogDeps();
    const [products, categories] = await Promise.all([
      listProducts(deps),
      listCategories(deps),
    ]);
    dynamic = [
      ...categories.map((c) => ({
        url: `${SITE_URL}/collections?category=${c.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
      ...products.map((p) => ({
        url: `${SITE_URL}/products/${p.slug}`,
        lastModified: new Date(p.updatedAt ?? p.createdAt ?? now),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch (e) {
    // Degrade to the static routes rather than failing the sitemap, but say so:
    // silence here is what let an empty sitemap ship unnoticed.
    console.error("[sitemap] catalogue unavailable — static routes only", e);
  }

  return [...staticRoutes, ...dynamic];
}
