import Link from "next/link";

export default function ProductNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
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
