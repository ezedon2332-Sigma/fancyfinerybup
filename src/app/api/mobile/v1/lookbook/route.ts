import { listLookbookEntries } from "@/infrastructure/db/lookbook-service";

import { pagination } from "../../_lib/context";
import { mediaUrl } from "../../_lib/dto";
import { handler, ok } from "../../_lib/respond";

/**
 * GET /api/mobile/v1/lookbook — the editorial edit.
 *
 * A panel is a picture, a name, a line of copy and somewhere to go — not a
 * product. The service enforces all three conditions that decide membership
 * (ticked by an admin, published, and has a still image), so nothing here can
 * publish a draft or a video-only piece by forgetting a filter.
 */
export const GET = handler(async (req: Request) => {
  const { limit } = pagination(new URL(req.url), { defaultLimit: 12, maxLimit: 40 });
  const entries = await listLookbookEntries(limit);

  return ok({
    items: entries.map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      description: entry.description,
      imageUrl: mediaUrl(entry.storagePath),
    })),
  });
});
