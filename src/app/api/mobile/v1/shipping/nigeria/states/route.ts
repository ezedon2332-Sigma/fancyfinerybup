import { listStates } from "@/infrastructure/db/nigeria-shipping-service";

import { handler, ok } from "../../../../_lib/respond";

/**
 * GET /api/mobile/v1/shipping/nigeria/states
 *
 * Only enabled states — the service filters that, not this route, so a new
 * surface cannot publish a withdrawn one by forgetting the predicate.
 */
export const GET = handler(async () => {
  const states = await listStates();
  return ok({
    items: states.map((s) => ({ id: s.id, name: s.name, code: s.code })),
  });
});
