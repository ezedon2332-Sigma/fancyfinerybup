/**
 * Re-throw errors that Next.js uses as control flow.
 *
 * Next signals several things by throwing: `redirect()`, `notFound()`, and
 * `DynamicServerError` — the last meaning "this route read cookies or headers,
 * so it cannot be statically rendered". Those are not failures, they are
 * instructions to the framework.
 *
 * A broad `try/catch` around data loading swallows them, and the symptom is
 * quiet and confusing: a page that should have become dynamic instead renders
 * once at build time with whatever the fallback was — an empty catalogue, say —
 * and serves that stale shell to everyone. A `redirect()` inside the try simply
 * stops working.
 *
 * So every defensive catch calls this first and only then treats the error as a
 * genuine outage.
 *
 *   try {
 *     data = await load();
 *   } catch (e) {
 *     rethrowFrameworkErrors(e);
 *     console.error("[page] data unavailable", e);
 *   }
 */
const FRAMEWORK_DIGESTS = new Set([
  "DYNAMIC_SERVER_USAGE",
  "NEXT_NOT_FOUND",
  "NEXT_HTTP_ERROR_FALLBACK",
]);

export function rethrowFrameworkErrors(error: unknown): void {
  if (typeof error !== "object" || error === null) return;

  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest === "string") {
    // redirect() carries the target in its digest, hence the prefix test.
    if (FRAMEWORK_DIGESTS.has(digest) || digest.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
  }

  // Belt and braces: the class name, for versions or paths where the digest is
  // not attached.
  const name = (error as { name?: unknown }).name;
  if (name === "DynamicServerError" || name === "DynamicUsageError") {
    throw error;
  }
}
