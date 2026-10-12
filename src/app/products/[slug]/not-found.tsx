import Link from "next/link";

/**
 * Shown when a product slug does not resolve.
 *
 * This page is served with HTTP 200, not 404, and that is not a bug we can fix
 * here: the root layout reads cookies(), so every response streams, and the
 * status is committed before `notFound()` is reached further down the tree. An
 * unmatched ROUTE still 404s correctly — Next decides that before rendering —
 * but a matched route that turns out to have no product cannot.
 *
 * Left alone that is a soft 404: a crawler sees 200 and keeps the URL indexed,
 * so every sold-out piece lingers in search results forever. `noindex` is the
 * fix that works regardless of status, and it is what Google asks for when a
 * 404 cannot be returned.
 */
export default function ProductNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <meta name="robots" content="noindex, follow" />
      <h1 className="text-3xl font-bold">Product not available</h1>
      <p className="mt-3 max-w-md text-gray-400">
        This piece may be sold out or no longer part of the collection.
      </p>
      <Link
        href="/collections"
        className="mt-8 rounded-sm bg-yellow-500 px-8 py-3 font-semibold text-black transition-colors hover:bg-yellow-600"
      >
        Browse collections
      </Link>
    </div>
  );
}
