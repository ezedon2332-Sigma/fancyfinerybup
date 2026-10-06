import { NextResponse } from "next/server";

/**
 * One response shape for every mobile endpoint.
 *
 * The storefront's Server Actions each return their own ad-hoc result object —
 * `{ ok, orderId, error }` here, `{ ok: true, ...quote }` there. That is fine
 * when the caller is TypeScript in the same repository and the compiler checks
 * both ends. The mobile client is Kotlin: it cannot see those types, and every
 * distinct envelope is another `@Serializable` wrapper and another branch in the
 * client's error handling.
 *
 * So the wire format is fixed here instead:
 *
 *     { "data": <payload> }                      — success
 *     { "error": { "code": "...", "message": "..." } }  — failure
 *
 * Kotlin decodes that as one generic `ApiEnvelope<T>` and one error path, for
 * every endpoint. The HTTP status still carries the same information for
 * anything that reads status codes alone.
 */

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; field?: string };
}

/**
 * Error codes the client branches on.
 *
 * A code is a contract: the Kotlin side matches on these strings, so renaming
 * one is a breaking API change. Messages are free text and safe to reword —
 * they are shown to the customer, never matched against.
 */
export type ApiErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "invalid_request"
  | "out_of_stock"
  | "payment_unavailable"
  | "conflict"
  | "rate_limited"
  | "server_error";

const STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 422,
  out_of_stock: 409,
  payment_unavailable: 409,
  conflict: 409,
  rate_limited: 429,
  server_error: 500,
};

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

/**
 * Thrown by `requireUser` and turned into a 401 envelope by `handler`.
 *
 * It lives here rather than next to `requireUser` so that throwing it and
 * rendering it are the same module's business, and a route cannot import one
 * without the other being wired up.
 */
export class UnauthenticatedError extends Error {
  constructor(message = "Please sign in.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export function fail(
  code: ApiErrorCode,
  message: string,
  field?: string,
): NextResponse {
  const body: ApiErrorBody = { error: { code, message, ...(field ? { field } : {}) } };
  return NextResponse.json(body, { status: STATUS[code] });
}

/**
 * Last-resort handler for an unexpected throw.
 *
 * In production the message is swallowed: an exception from the pg driver or
 * the S3 client can name internal hosts, column names or credentials, and a
 * customer cannot act on any of it. In development it is passed through,
 * because the alternative is debugging an API through a generic string.
 */
export function failUnexpected(e: unknown): NextResponse {
  const detail = e instanceof Error ? e.message : String(e);
  if (process.env.NODE_ENV !== "production") {
    console.error("[mobile-api]", e);
    return fail("server_error", detail);
  }
  console.error("[mobile-api]", detail);
  return fail("server_error", "Something went wrong. Please try again.");
}

/**
 * Wrap a handler so an unexpected throw becomes a well-formed error envelope
 * rather than Next's HTML error page, which a Kotlin JSON decoder cannot read.
 */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<NextResponse>,
): (...args: A) => Promise<NextResponse> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      // An unauthenticated call is an expected outcome, not a fault: the app
      // reaches here every time a stored token has expired. It must answer 401
      // so the client knows to refresh or sign in, never 500.
      if (e instanceof UnauthenticatedError) {
        return fail("unauthenticated", e.message);
      }
      return failUnexpected(e);
    }
  };
}
