import Link from "next/link";
import type { Metadata } from "next";

import { listAdminOrders } from "@/infrastructure/supabase/admin-service";
import { formatMoney } from "@/domain/shared/money";
import { orderStatusBadge, orderStatusLabel } from "@/lib/order-status";

export const metadata: Metadata = { title: "Admin · Orders" };

export default async function AdminOrdersPage() {
  const orders = await listAdminOrders();

  return (
    <div>
      <h1 className="text-2xl font-bold">Orders</h1>
      {orders.length === 0 ? (
        <p className="mt-10 text-gray-400">No orders yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-widest text-gray-400">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orders.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-white/5">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-medium text-white hover:text-yellow-400">
                      #{o.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {o.customerName ?? "—"}
                    <span className="block text-xs text-gray-500">{o.customerEmail}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{o.itemCount}</td>
                  <td className="px-4 py-3 text-yellow-400">{formatMoney(o.total, o.currency)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusBadge(o.status)}`}>
                      {orderStatusLabel(o.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
