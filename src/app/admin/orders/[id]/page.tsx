import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin } from "lucide-react";

import { getOrderRepository } from "@/infrastructure/supabase/order-service";
import { formatMoney } from "@/domain/shared/money";
import { OrderStatusForm } from "@/components/admin/OrderStatusForm";

export const metadata: Metadata = { title: "Admin · Order" };

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orders = await getOrderRepository();
  const order = await orders.findById(id); // admin sees all via RLS
  if (!order) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/admin/orders" className="text-sm text-gray-400 hover:text-yellow-400">
        ← All orders
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Order #{order.id.slice(0, 8)}</h1>
          <p className="text-sm text-gray-400">
            {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        <OrderStatusForm orderId={order.id} current={order.status} />
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">Items</h2>
        <div className="mt-4 divide-y divide-white/5">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-3 text-sm">
              <span>
                {item.nameSnapshot} <span className="text-gray-500">× {item.qty}</span>
              </span>
              <span className="text-yellow-400">
                {formatMoney(item.unitPrice * item.qty, order.currency)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm">
          <div className="flex justify-between text-gray-300">
            <span>Subtotal</span>
            <span>{formatMoney(order.subtotal, order.currency)}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>
              Shipping{order.shippingMethod ? ` · ${order.shippingMethod}` : ""}
            </span>
            <span>
              {order.shippingCost === 0
                ? "FREE"
                : formatMoney(order.shippingCost, order.currency)}
            </span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-2 font-semibold">
            <span>Total</span>
            <span>{formatMoney(order.total, order.currency)}</span>
          </div>
        </div>
      </div>

      {order.trackingNumber && (
        <div className="mt-6 rounded-2xl border border-yellow-600/30 bg-neutral-950/60 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gray-300">
            Shipment
          </h2>
          <p className="mt-2 text-sm text-gray-300">
            Tracking number:{" "}
            <span className="font-mono text-yellow-400">{order.trackingNumber}</span>
          </p>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gray-300">
          <MapPin className="h-4 w-4" /> Delivery
        </h2>
        <div className="mt-3 text-sm text-gray-300">
          <p>{order.shipping.name}</p>
          <p>{order.shipping.email}</p>
          <p>{order.shipping.phone}</p>
          <p>
            {[
              order.shipping.address,
              order.shipping.apartment,
              order.shipping.city,
              order.shipping.state,
              order.shipping.postal,
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
              Open location in Maps →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
