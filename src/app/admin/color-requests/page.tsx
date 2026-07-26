import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import {
  ColorRequestsTable,
  type ColorRequestRow,
} from "@/components/admin/ColorRequestsTable";

export const metadata: Metadata = { title: "Admin · Color Requests" };

export default async function ColorRequestsPage() {
  let requests: ColorRequestRow[] = [];
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("color_requests")
      .select("*")
      .order("created_at", { ascending: false });
    requests = (data ?? []) as ColorRequestRow[];
  } catch {
    // color_requests table not migrated yet — show empty state.
  }

  // Trending insight: same product+colour requested ≥3× in the last 30 days.
  // eslint-disable-next-line react-hooks/purity -- server component, evaluated once per request
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const counts = new Map<string, number>();
  for (const r of requests) {
    if (new Date(r.created_at).getTime() < monthAgo) continue;
    if (r.status === "cancelled") continue;
    const key = `${r.product_name} • ${r.requested_color}`;
    counts.set(key, (counts.get(key) ?? 0) + r.quantity);
  }
  const trending = [...counts.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div>
      <h1 className="text-2xl font-bold">Color Requests</h1>
      <p className="mt-1 text-sm text-gray-400">
        Customer requests for colours not yet in stock — fulfil manually or add
        them to inventory.
      </p>

      {trending.length > 0 && (
        <div className="mt-6 rounded-2xl border border-yellow-600/30 bg-yellow-500/5 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-yellow-400">
            <Sparkles className="h-4 w-4" /> Trending requests (last 30 days)
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-gray-200">
            {trending.map(([key, n]) => {
              const [product, color] = key.split(" • ");
              return (
                <li key={key}>
                  <strong className="text-yellow-400">{n}</strong> customers
                  requested <strong>{product}</strong> in{" "}
                  <strong>{color}</strong> this month.
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-gray-500">
            Consider stocking these colours next.
          </p>
        </div>
      )}

      <div className="mt-6">
        <ColorRequestsTable requests={requests} />
      </div>
    </div>
  );
}
