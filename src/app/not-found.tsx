import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-xs uppercase tracking-[6px] text-yellow-500">404</p>
      <h1 className="mt-4 text-4xl font-bold">Page not found</h1>
      <p className="mt-3 max-w-md text-gray-400">
        The page you’re looking for doesn’t exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-sm bg-yellow-500 px-8 py-3 font-semibold text-black transition-colors hover:bg-yellow-600"
      >
        Back home
      </Link>
    </div>
  );
}
