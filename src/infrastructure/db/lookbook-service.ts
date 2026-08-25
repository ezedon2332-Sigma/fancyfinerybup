import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type { LookbookEntry } from "@/domain/entities/lookbook";
import { db } from "./client";
import { products } from "./schema";

/**
 * The Lookbook edit.
 *
 * **The rule, in one place:** a product appears in the lookbook when an admin
 * ticks "Show in Lookbook" AND the product is published AND it has at least one
 * still image.
 *
 * All three conditions are load-bearing:
 *
 *  - **The flag** is the editorial decision. Without it the page showed the
 *    first eight products that happened to have a photo, so its contents
 *    changed silently whenever the catalogue did.
 *  - **Published** stops a draft or archived piece leaking onto a public page
 *    through a surface that is not the product grid.
 *  - **A still image** is a hard requirement of the format: the panels are
 *    full-bleed <Image> elements, and a video-only product would render a
 *    broken frame. Enforced here rather than at the call site so no future
 *    caller can forget it.
 */
export async function listLookbookEntries(limit = 12): Promise<LookbookEntry[]> {
  try {
    const rows = await db.query.products.findMany({
      where: and(eq(products.lookbook, true), eq(products.status, "published")),
      with: { productImages: true },
      orderBy: [desc(products.createdAt)],
      // Over-fetch a little: the still-image requirement is applied below, and
      // a video-only product would otherwise shorten the page silently.
      limit: limit * 2,
    });

    return rows
      .map((p) => {
        const still = [...p.productImages]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .find((m) => m.mediaType === "image");
        if (!still) return null;
        return {
          slug: p.slug,
          name: p.name,
          description: p.description,
          storagePath: still.storagePath,
        };
      })
      .filter((e): e is LookbookEntry => e !== null)
      .slice(0, limit);
  } catch {
    // The lookbook is editorial; an outage should empty it, not 500 the route.
    return [];
  }
}
