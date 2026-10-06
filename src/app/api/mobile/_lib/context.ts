import { headers } from "next/headers";

import { auth } from "@/infrastructure/auth/auth";
import {
  isDisplayCurrency,
  type DisplayCurrency,
} from "@/domain/shared/display-price";
import { DEFAULT_ORDER_CURRENCY } from "@/domain/shipping/currency";
import { UnauthenticatedError } from "./respond";

/**
 * Per-request context for the mobile API: who is calling, and in what currency.
 *
 * Both answers come from a different place than they do on the web, and that is
 * the whole reason this file exists.
 */

export interface MobileUser {
  id: string;
  email: string | null;
  name: string | null;
}

/**
 * The caller, or null.
 *
 * `auth.api.getSession` is handed the raw request headers, so the `bearer`
 * plugin resolves `Authorization: Bearer <token>` exactly as the cookie path
 * resolves `fancy.session_token`. Nothing here parses the token itself — doing
 * so would be a second implementation of session validation that could drift
 * from the real one.
 */
export async function currentUser(): Promise<MobileUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
  };
}

/**
 * The caller, or a thrown `UnauthenticatedError` that `handler` renders as 401.
 *
 * Throwing rather than returning null is what keeps the check impossible to
 * forget: a route that needs a user writes `const user = await requireUser()`
 * and cannot proceed without one.
 */
export async function requireUser(): Promise<MobileUser> {
  const user = await currentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

/**
 * Header the client states its chosen currency in.
 *
 * The web reads this from the `ff_currency` cookie, deliberately server-side, so
 * the figure a shopper is charged comes from the same place the prices they
 * browsed were rendered from. A native client has no such cookie, so the
 * currency travels as an explicit header on every request instead.
 *
 * It is a header rather than a body field because GET endpoints need it too —
 * the catalogue has to price itself in the shopper's currency — and because it
 * then cannot be forgotten on one endpoint and not another.
 *
 * This is NOT a trust hole. The currency only ever selects which of four fixed
 * price rules to apply to a price read from the database; it can never set an
 * amount. An unrecognised value falls back to naira rather than erroring, so an
 * older client that has not heard of a newly added currency still transacts.
 */
export const CURRENCY_HEADER = "x-ff-currency";

export async function requestCurrency(): Promise<DisplayCurrency> {
  const value = (await headers()).get(CURRENCY_HEADER);
  return isDisplayCurrency(value) ? value : DEFAULT_ORDER_CURRENCY;
}

/**
 * Parse `limit`/`offset` from a query string.
 *
 * Clamped rather than rejected: a client asking for 10,000 products is a bug or
 * a scraper, and answering with the first 100 keeps the app working in the first
 * case without serving the whole catalogue in the second.
 */
export function pagination(
  url: URL,
  { defaultLimit = 24, maxLimit = 100 } = {},
): { limit: number; offset: number } {
  const rawLimit = Number(url.searchParams.get("limit"));
  const rawOffset = Number(url.searchParams.get("offset"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), maxLimit)
      : defaultLimit;
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;
  return { limit, offset };
}

/** Read and JSON-parse a request body, returning null when it is not JSON. */
export async function jsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
