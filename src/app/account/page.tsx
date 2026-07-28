import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  Heart,
  LogOut,
  MapPin,
  Package,
  ShieldCheck,
  Truck,
} from "lucide-react";

import {
  getCurrentProfile,
  requireUser,
} from "@/infrastructure/supabase/auth";
import { getOrderRepository } from "@/infrastructure/supabase/order-service";
import { formatMoney } from "@/domain/shared/money";
import { isShipped, orderStatusBadge, orderStatusLabel } from "@/lib/order-status";
import { ProfileForm } from "@/components/account/ProfileForm";
import { rethrowFrameworkErrors } from "@/lib/rethrow-framework-errors";
import {
  Badge,
  Card,
  EmptyState,
  PAGE,
  PageHeader,
  Stat,
} from "@/components/ui";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "My Account" };

/**
 * Customer dashboard.
 *
 * Restructured from a single stacked column into a hub: what the customer
 * usually came for — order status — is at the top, with profile and address
 * editing below it. Previously the profile form sat above the orders, so the
 * commonest task was the furthest down the page.
 */
export default async function AccountPage() {
  const user = await requireUser("/account");
  const profile = await getCurrentProfile();

  let orders: Awaited<ReturnType<Awaited<ReturnType<typeof getOrderRepository>>["listByUser"]>> = [];
  try {
    orders = await (await getOrderRepository()).listByUser(user.id);
  } catch (e) {
    rethrowFrameworkErrors(e);
    console.error("[account] orders unavailable", e);
  }

  const inTransit = orders.filter((o) => isShipped(o.status) && o.status !== "delivered");
  const delivered = orders.filter((o) => o.status === "delivered");
  const recent = orders.slice(0, 5);
  const name = profile?.fullName?.trim() || user.email?.split("@")[0] || "Member";

  return (
    <div className={`${PAGE} max-w-5xl py-12 lg:py-16`}>
      <PageHeader
        eyebrow="Your account"
        title={`Welcome back, ${name}`}
        lead={user.email ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            {profile?.role === "admin" && (
              <Link
                href="/admin"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-yellow-500/40 px-4 text-[11px] font-semibold uppercase tracking-widest text-yellow-400 transition-colors hover:bg-yellow-500/10"
              >
                <ShieldCheck className="h-4 w-4" /> Admin
              </Link>
            )}
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/15 px-4 text-[11px] uppercase tracking-widest text-gray-300 transition-colors hover:border-red-500/50 hover:text-red-400"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </form>
          </div>
        }
      />

      {/* At-a-glance */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat icon={<Package className="h-4 w-4" />} label="Orders placed" value={orders.length} />
        <Stat
          icon={<Truck className="h-4 w-4" />}
          label="In transit"
          value={inTransit.length}
          sub={inTransit.length > 0 ? "Track below" : undefined}
        />
        <Stat icon={<ShieldCheck className="h-4 w-4" />} label="Delivered" value={delivered.length} />
      </div>

      {/* Quick links — the destinations a customer actually wants next. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <QuickLink href="/wishlist" icon={<Heart className="h-4 w-4" />} label="Wishlist" />
        <QuickLink href="/collections" icon={<Package className="h-4 w-4" />} label="Continue shopping" />
        <QuickLink href="/shipping" icon={<Truck className="h-4 w-4" />} label="Shipping rates" />
      </div>

      {/* Orders first: the commonest reason to be here. */}
      <section className="mt-12" aria-labelledby="orders-heading">
        <div className="flex items-end justify-between gap-3">
          <h2 id="orders-heading" className="font-display text-xl text-white">
            Recent orders
          </h2>
          {orders.length > recent.length && (
            <span className="text-[11px] text-gray-500">
              Showing {recent.length} of {orders.length}
            </span>
          )}
        </div>

        {orders.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title="No orders yet"
              body="When you place an order it will appear here, with tracking as soon as it ships."
              action={
                <Link href="/collections" className="btn-gold">
                  <span className="relative z-10">Browse the collection</span>
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {recent.map((o) => (
              <Card key={o.id} as="li" interactive>
                <Link
                  href={`/account/orders/${o.id}`}
                  className="flex min-h-[44px] items-center gap-4 p-4 sm:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">
                        #{o.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${orderStatusBadge(o.status)}`}
                      >
                        {orderStatusLabel(o.status)}
                      </span>
                      {o.trackingNumber && <Badge tone="blue">Tracked</Badge>}
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {new Date(o.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-yellow-400">
                    {formatMoney(o.total, o.currency)}
                  </p>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-600" />
                </Link>
              </Card>
            ))}
          </ul>
        )}
      </section>

      {/* Profile and saved address */}
      {profile && (
        <section className="mt-12" aria-labelledby="details-heading">
          <h2 id="details-heading" className="font-display text-xl text-white">
            Your details
          </h2>
          <p className="mt-1.5 text-xs text-gray-500">
            Saved here and pre-filled at checkout, so you only type an address
            once.
          </p>
          <Card className="mt-4 p-5 sm:p-6">
            <ProfileForm profile={profile} />
          </Card>
        </section>
      )}

      {/* Honest about what is not built rather than showing dead controls. */}
      <section className="mt-12">
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <MapPin className="h-4 w-4 shrink-0 text-yellow-600" />
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-gray-400">
            One address is saved at a time. Multiple saved addresses and a
            reusable address book are not built yet — for now, editing above
            replaces what checkout pre-fills.
          </p>
        </Card>
      </section>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Card interactive>
      <Link
        href={href}
        className="flex min-h-[44px] items-center gap-3 px-4 py-3.5 text-sm text-gray-200"
      >
        <span className="text-yellow-600">{icon}</span>
        <span className="flex-1">{label}</span>
        <ChevronRight className="h-4 w-4 text-gray-600" />
      </Link>
    </Card>
  );
}
