import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";
import { getCatalogDeps } from "@/infrastructure/db/catalog-service";
import { listCategories, listProducts } from "@/application/use-cases/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/collections`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
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
  } catch {
    /* catalogue unavailable — return static routes only */
  }

  return [...staticRoutes, ...dynamic];
}
