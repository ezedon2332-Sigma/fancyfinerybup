import type { Metadata } from "next";
import { LogOut, Package, ShieldCheck } from "lucide-react";
import Link from "next/link";

import {
  getCurrentProfile,
  requireUser,
} from "@/infrastructure/supabase/auth";
import { getOrderRepository } from "@/infrastructure/supabase/order-service";
import { formatMoney } from "@/domain/shared/money";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "My Account" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const profile = await getCurrentProfile();
  const orders = await (await getOrderRepository()).listByUser(user.id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-14 lg:px-10">
      <h1 className="text-3xl font-bold sm:text-4xl">My Account</h1>

      <div className="mt-8 rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-medium">
              {profile?.fullName ?? "Fancy Finery Member"}
            </p>
            <p className="text-sm text-gray-400">{user.email}</p>
          </div>
          {profile?.role === "admin" && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-full border border-yellow-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-yellow-400 hover:bg-yellow-500/10"
            >
              <ShieldCheck className="h-4 w-4" /> Admin
            </Link>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gray-300">
          <Package className="h-4 w-4" /> Order history
        </div>
        {orders.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">
            You have no orders yet.{" "}
            <Link href="/collections" className="text-yellow-400 hover:text-yellow-300">
              Start shopping
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 divide-y divide-white/5">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/account/orders/${o.id}`}
                className="flex items-center justify-between py-3 transition-colors hover:text-yellow-400"
              >
                <div>
                  <p className="text-sm font-medium">#{o.id.slice(0, 8)}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(o.createdAt).toLocaleDateString()} · {o.status}
                  </p>
                </div>
                <span className="text-sm font-semibold">
                  {formatMoney(o.total, o.currency)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <form action={signOut} className="mt-8">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-sm border border-white/20 px-6 py-3 text-sm transition-colors hover:border-red-500 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </form>
    </div>
  );
}
