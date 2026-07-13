import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin } from "lucide-react";

import { getCustomer } from "@/infrastructure/supabase/customer-service";
import { getCurrentUser } from "@/infrastructure/supabase/auth";
import { formatMoney } from "@/domain/shared/money";
import { RoleToggle } from "@/components/admin/RoleToggle";

export const metadata: Metadata = { title: "Admin · Customer" };

export default async function AdminCustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, me] = await Promise.all([getCustomer(id), getCurrentUser()]);
  if (!customer) notFound();

  const totalSpent = customer.orders
    .filter((o) => o.status !== "cancelled")
    .reduce((n, o) => n + o.total, 0);

  const addressLine = [
    customer.address,
    customer.city,
    customer.state,
    customer.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="max-w-3xl">
      <Link href="/admin/customers" className="text-sm text-gray-400 hover:text-yellow-400">
        ← All customers
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{customer.fullName ?? "Customer"}</h1>
          <p className="text-sm text-gray-400">{customer.email}</p>
          <p className="mt-1 text-xs text-gray-500">
            Joined {new Date(customer.createdAt).toLocaleDateString()} · role: {customer.role}
          </p>
        </div>
        <RoleToggle userId={customer.id} role={customer.role} isSelf={customer.id === me?.id} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Orders" value={String(customer.orders.length)} />
        <Stat label="Spent" value={formatMoney(totalSpent, "NGN")} />
        <Stat label="Phone" value={customer.phone ?? "—"} />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gray-300">
          <MapPin className="h-4 w-4" /> Saved address
        </h2>
        {addressLine ? (
          <p className="mt-3 text-sm text-gray-300">{addressLine}</p>
        ) : (
          <p className="mt-3 text-sm text-gray-500">No saved address.</p>
        )}
        {customer.lat != null && customer.lng != null && (
          <a
            href={`https://www.google.com/maps?q=${customer.lat},${customer.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-sm text-yellow-400 hover:text-yellow-300"
          >
            Open location in Maps →
          </a>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">Orders</h2>
        {customer.orders.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No orders yet.</p>
        ) : (
          <div className="mt-3 divide-y divide-white/5">
            {customer.orders.map((o) => (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="flex items-center justify-between py-3 text-sm transition-colors hover:text-yellow-400"
              >
                <span>
                  #{o.id.slice(0, 8)}{" "}
                  <span className="text-gray-500">· {o.status}</span>
                </span>
                <span className="font-semibold">{formatMoney(o.total, o.currency)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
      <p className="text-lg font-bold text-yellow-400">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  );
}
