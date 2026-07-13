import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, MapPin } from "lucide-react";

import { requireUser } from "@/infrastructure/supabase/auth";
import { getOrderRepository } from "@/infrastructure/supabase/order-service";
import { formatMoney } from "@/domain/shared/money";

export const metadata: Metadata = { title: "Order" };

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { placed } = await searchParams;

  const orders = await getOrderRepository();
  const order = await orders.findById(id); // RLS: only the owner (or admin) sees it
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:px-10">
      {placed && (
        <div className="mb-8 flex items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/5 p-5">
          <CheckCircle2 className="h-6 w-6 text-green-400" />
          <div>
            <p className="font-semibold text-green-300">Order placed!</p>
            <p className="text-sm text-gray-400">
              We’ve received your order and will arrange delivery.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Order #{order.id.slice(0, 8)}</h1>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-yellow-400">
          {order.status}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-400">
        {new Date(order.createdAt).toLocaleString()}
      </p>

      <div className="mt-8 rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
          Items
        </h2>
        <div className="mt-4 divide-y divide-white/5">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-3 text-sm">
              <span>
                {item.nameSnapshot}{" "}
                <span className="text-gray-500">× {item.qty}</span>
              </span>
              <span className="text-yellow-400">
                {formatMoney(item.unitPrice * item.qty, order.currency)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between border-t border-white/10 pt-4 font-semibold">
          <span>Total</span>
          <span>{formatMoney(order.total, order.currency)}</span>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gray-300">
          <MapPin className="h-4 w-4" /> Delivery
        </h2>
        <div className="mt-3 text-sm text-gray-300">
          <p>{order.shipping.name}</p>
          <p>{order.shipping.phone}</p>
          <p>
            {[
              order.shipping.address,
              order.shipping.city,
              order.shipping.state,
              order.shipping.country,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
          {order.shipping.lat != null && order.shipping.lng != null && (
            <a
              href={`https://www.google.com/maps?q=${order.shipping.lat},${order.shipping.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-yellow-400 hover:text-yellow-300"
            >
              View pinned location →
            </a>
          )}
        </div>
      </div>

      <Link
        href="/account"
        className="mt-8 inline-block text-sm text-gray-400 hover:text-yellow-400"
      >
        ← Back to account
      </Link>
    </div>
  );
}
