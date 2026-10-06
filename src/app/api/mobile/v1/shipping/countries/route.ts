import { COUNTRIES, flagEmoji } from "@/domain/shipping/countries";

import { handler, ok } from "../../../_lib/respond";

/**
 * GET /api/mobile/v1/shipping/countries
 *
 * The destination list for the address form. Served from the server rather than
 * bundled into the app so that adding a country is a deploy, not a release —
 * the same reason the website reads it from the domain module instead of a
 * hardcoded <select>.
 */
export const GET = handler(async () => {
  return ok({
    items: COUNTRIES.map((country) => ({
      code: country.code,
      name: country.name,
      zone: country.zone,
      flag: flagEmoji(country.code),
    })),
  });
});
