import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";

import { requireAdmin } from "@/infrastructure/auth/session";
import { listFavoritesForAdmin } from "@/infrastructure/db/favorites-service";

export const metadata: Metadata = { title: "Admin · Favourites" };

// Demand data an admin is checking should never be a cached snapshot.
export const dynamic = "force-dynamic";

export default async function AdminFavoritesPage() {
  await requireAdmin();
  const rows = await listFavoritesForAdmin(100);
  const total = rows.reduce((n, r) => n + r.favorites, 0);

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[4px] text-yellow-500">Demand</p>
        <h1 className="mt-1 text-2xl font-bold">Favourites</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-400">
          Pieces customers tapped the heart on. They haven&apos;t bought these
          yet — so it&apos;s an early read on what people want.
        </p>
        <ul className="mt-3 max-w-2xl space-y-1 text-sm text-gray-500">
          <li>
            <span className="text-gray-300">Restocking:</span> a sold-out piece
            high on this list will sell again.
          </li>
          <li>
            <span className="text-gray-300">Promotions:</span> lots of saves and
            few sales usually means the price is the sticking point.
          </li>
          <li>
            <span className="text-gray-300">Homepage:</span> the &ldquo;Most
            Loved&rdquo; row shows the top of this list automatically.
          </li>
        </ul>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
          <p className="text-3xl font-bold text-yellow-400">{total}</p>
          <p className="mt-1 text-xs uppercase tracking-widest text-gray-400">
            Times saved
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
          <p className="text-3xl font-bold text-yellow-400">{rows.length}</p>
          <p className="mt-1 text-xs uppercase tracking-widest text-gray-400">
            Pieces saved
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-neutral-950/60 px-5 py-8 text-sm text-gray-500">
          Nothing saved yet. A piece shows up here the moment a signed-in
          customer taps its heart.
        </p>
      ) : (
        <ul className="divide-y divide-white/8 rounded-2xl border border-white/10 bg-neutral-950/60">
          {rows.map((r, i) => (
            <li
              key={r.productId}
              className="flex items-center justify-between gap-4 px-5 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-6 shrink-0 text-sm text-gray-600">
                  {i + 1}
                </span>
                <Link
                  href={`/admin/products/${r.productId}`}
                  className="truncate text-sm text-gray-100 hover:text-yellow-400"
                >
                  {r.name}
                </Link>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-yellow-400">
                <Heart className="h-3.5 w-3.5 fill-current" />
                {r.favorites}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
