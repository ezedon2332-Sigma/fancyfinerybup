import { submitColorRequestAction } from "@/app/products/color-request-actions";

import { jsonBody } from "../../_lib/context";
import { fail, handler, ok } from "../../_lib/respond";

/**
 * POST /api/mobile/v1/color-requests — ask for a piece in another colour.
 *
 * Delegates to the website's action, which validates, throttles by client IP
 * and writes the row. That action holds customer PII, so reusing it rather than
 * reimplementing keeps the rate limit and the validation in one place instead
 * of leaving the mobile path as an unthrottled spam sink into the same table.
 *
 * Public by design: the website does not require an account to ask, and
 * requiring one here would make the app worse at the same job for no gain.
 */
export const POST = handler(async (req: Request) => {
  const body = await jsonBody(req);
  if (body === null) return fail("invalid_request", "Expected a JSON body.");

  const result = await submitColorRequestAction(body);
  if (!result.ok) {
    return fail("invalid_request", result.error ?? "Could not send that request.");
  }

  return ok({
    submitted: true,
    message: "Thank you — we'll be in touch about availability.",
  });
});
