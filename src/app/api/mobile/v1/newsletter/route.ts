import { joinPriveCircle } from "@/app/newsletter/actions";

import { jsonBody } from "../../_lib/context";
import { fail, handler, ok } from "../../_lib/respond";

/**
 * POST /api/mobile/v1/newsletter — join the Privé Circle.
 *
 * Delegates to the website's action, which validates, throttles by client IP
 * and writes the subscriber. Reusing it keeps the rate limit and the honeypot
 * in one place rather than leaving the mobile path as an unthrottled way into
 * the same table.
 *
 * `kind` is passed through so the app can say something true: joining for the
 * first time, rejoining after unsubscribing, and already being a member are
 * three different outcomes, and a generic "thanks" is wrong for two of them.
 */
export const POST = handler(async (req: Request) => {
  const body = await jsonBody(req);
  if (body === null) return fail("invalid_request", "Expected a JSON body.");

  const result = await joinPriveCircle(body);
  if (!result.ok) {
    return fail(
      "invalid_request",
      result.error ?? "Could not add you to the list.",
      result.fieldErrors ? Object.keys(result.fieldErrors)[0] : undefined,
    );
  }

  const kind = result.kind ?? "created";
  return ok({ kind, message: messageFor(kind) });
});

function messageFor(kind: string): string {
  switch (kind) {
    case "already":
      return "You're already part of the Privé Circle.";
    case "resubscribed":
      return "Welcome back to the Privé Circle.";
    default:
      return "Welcome to the Privé Circle.";
  }
}
