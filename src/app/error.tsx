"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Route-level error boundary.
 *
 * Without this, any unhandled error in a page or its data loading takes the
 * whole route down to a blank screen — the header, the bag and the customer's
 * way out all vanish with it. Here the shell survives, the error is contained
 * to the page area, and `reset()` retries the segment without a full reload.
 *
 * Message text is deliberately not shown: it can carry connection strings,
 * table names or query fragments. The digest is safe to show and is what
 * correlates a customer report with the server log.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Reaches the platform log, where it can be traced by digest.
    console.error("[route error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-500">
        Something went wrong
      </p>
      <h1 className="brand-wordmark mt-6 text-2xl tracking-[0.04em] sm:text-3xl">
        A moment, please
      </h1>
      <p className="mt-5 text-sm leading-relaxed text-gray-300">
        This page could not be loaded. Your bag and account are unaffected.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={reset} className="btn-gold">
          <span className="relative z-10 inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Try again
          </span>
        </button>
        <Link href="/" className="btn-gold-ghost">
          Return home
        </Link>
      </div>

      {error.digest && (
        <p className="mt-8 text-[10px] uppercase tracking-[0.2em] text-gray-600">
          Reference {error.digest}
        </p>
      )}
    </div>
  );
}
