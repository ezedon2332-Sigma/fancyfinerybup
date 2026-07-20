import type { Metadata } from "next";

import { getShippingRepository } from "@/infrastructure/supabase/shipping-service";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
import { ShippingManager } from "@/components/admin/ShippingManager";
import type {
  ShippingCountry,
  ShippingSettings,
} from "@/domain/shipping/shipping";
import { DEFAULT_NGN_PER_USD } from "@/domain/shipping/currency";
import { formatMoney } from "@/domain/shared/money";
import { isShipped } from "@/lib/order-status";

export const metadata: Metadata = { title: "Admin · Shipping" };

interface ShippingStats {
  orders: number;
  inTransit: number;
  delivered: number;
  revenueNgn: number;
  revenueUsd: number;
}

async function loadStats(): Promise<ShippingStats> {
  const stats: ShippingStats = {
    orders: 0,
    inTransit: 0,
    delivered: 0,
    revenueNgn: 0,
    revenueUsd: 0,
  };
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("orders")
      .select("status, shipping_cost, currency");
    for (const o of data ?? []) {
      stats.orders += 1;
      if (o.status === "delivered") stats.delivered += 1;
      else if (isShipped(o.status)) stats.inTransit += 1;
      if (o.currency === "USD") stats.revenueUsd += o.shipping_cost;
      else stats.revenueNgn += o.shipping_cost;
    }
  } catch {
    /* orders/shipping tables not ready */
  }
  return stats;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <p className="text-xs uppercase tracking-widest text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-yellow-400">{value}</p>
    </div>
  );
}

export default async function AdminShippingPage() {
  let countries: ShippingCountry[] = [];
  let settings: ShippingSettings = { ngnPerUsd: DEFAULT_NGN_PER_USD };
  try {
    const repo = await getShippingRepository();
    [countries, settings] = await Promise.all([
      repo.listCountries(),
      repo.getSettings(),
    ]);
  } catch {
    // Tables not migrated yet — render the empty state so the admin can seed.
  }

  const stats = await loadStats();
  const enabledCount = countries.filter((c) => c.enabled).length;

  return (
    <div>
      <h1 className="text-2xl font-bold">Shipping</h1>
      <p className="mt-1 text-sm text-gray-400">
        Manage countries, per-country rates, zones, delivery estimates, express
        options and free-shipping rules.
      </p>

      {/* Analytics */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Countries on" value={`${enabledCount}/${countries.length}`} />
        <Stat label="Orders" value={String(stats.orders)} />
        <Stat label="In transit" value={String(stats.inTransit)} />
        <Stat label="Delivered" value={String(stats.delivered)} />
        <Stat label="Ship rev (NGN)" value={formatMoney(stats.revenueNgn, "NGN")} />
        <Stat label="Ship rev (USD)" value={formatMoney(stats.revenueUsd, "USD")} />
      </div>

      <div className="mt-8">
        <ShippingManager countries={countries} settings={settings} />
      </div>
    </div>
  );
}
