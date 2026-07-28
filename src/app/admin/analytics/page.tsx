import type { Metadata } from "next";
import Link from "next/link";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
import { formatMoney } from "@/domain/shared/money";
import { orderStatusBadge, orderStatusLabel } from "@/lib/order-status";

export const metadata: Metadata = { title: "Admin · Analytics" };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
      <p className="text-xs uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-yellow-400">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export default async function AnalyticsPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: ordersData }, { data: itemsData }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total, currency, status, created_at, shipping_name")
      .order("created_at", { ascending: false }),
    supabase.from("order_items").select("name_snapshot, unit_price, qty, product_id"),
  ]);
  const orders = ordersData ?? [];
  const items = itemsData ?? [];

  // Orders are charged in whichever currency the customer selected, so
  // revenue is bucketed by currency. Summing across them would add euros to
  // naira and produce a number that means nothing.
  const revenue = new Map<string, number>();
  const last30 = new Map<string, number>();
  const statusCounts: Record<string, number> = {};
  let unitsSold = 0;
  // Server component: rendered once per request, so reading the clock here is
  // deterministic for that render. The purity rule targets client re-renders.
  // eslint-disable-next-line react-hooks/purity -- server component, evaluated once per request
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  for (const o of orders) {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
    if (o.status !== "cancelled") {
      const cur = (o.currency || "NGN").toUpperCase();
      revenue.set(cur, (revenue.get(cur) ?? 0) + o.total);
      if (new Date(o.created_at).getTime() >= monthAgo) {
        last30.set(cur, (last30.get(cur) ?? 0) + o.total);
      }
    }
  }

  const byProduct = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const it of items) {
    const key = it.product_id ?? it.name_snapshot;
    const cur = byProduct.get(key) ?? { name: it.name_snapshot, qty: 0, revenue: 0 };
    cur.qty += it.qty;
    cur.revenue += it.unit_price * it.qty;
    unitsSold += it.qty;
    byProduct.set(key, cur);
  }
  const topProducts = [...byProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);
  const recent = orders.slice(0, 8);
  const statuses = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
  const revenueByCurrency = [...revenue.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Sales Analytics</h1>
      <p className="mt-1 text-sm text-gray-400">
        Revenue and order performance across your store.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total orders" value={String(orders.length)} />
        <Stat label="Units sold" value={String(unitsSold)} />
        {revenueByCurrency.length === 0 && (
          <Stat label="Revenue" value={formatMoney(0, "NGN")} sub="no orders yet" />
        )}
        {revenueByCurrency.map(([cur, amount]) => (
          <Stat
            key={cur}
            label={`Revenue (${cur})`}
            value={formatMoney(amount, cur)}
            sub={`${formatMoney(last30.get(cur) ?? 0, cur)} last 30 days`}
          />
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Orders by status */}
        <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
            Orders by status
          </h2>
          {statuses.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No orders yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {statuses.map(([s, n]) => (
                <li key={s} className="flex items-center justify-between text-sm">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusBadge(s)}`}>
                    {orderStatusLabel(s)}
                  </span>
                  <span className="font-semibold text-gray-200">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top products */}
        <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
            Top products
          </h2>
          {topProducts.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No sales yet.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {topProducts.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-gray-200">
                    {i + 1}. {p.name}
                  </span>
                  <span className="whitespace-nowrap text-gray-400">{p.qty} sold</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
          Recent orders
        </h2>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No orders yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <tbody className="divide-y divide-white/5">
                {recent.map((o) => (
                  <tr key={o.id} className="hover:bg-white/5">
                    <td className="py-2 pr-3">
                      <Link href={`/admin/orders/${o.id}`} className="text-white hover:text-yellow-400">
                        #{o.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-gray-300">{o.shipping_name ?? "—"}</td>
                    <td className="py-2 pr-3 text-yellow-400">{formatMoney(o.total, o.currency)}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${orderStatusBadge(o.status)}`}>
                        {orderStatusLabel(o.status)}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500">
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
