import type { Metadata } from "next";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

export const metadata: Metadata = { title: "Admin Dashboard" };

export default async function AdminDashboard() {
  const supabase = await createSupabaseServerClient();

  const [products, published, categories, orders] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("status", "published"),
    supabase.from("categories").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Products", value: products.count ?? 0 },
    { label: "Published", value: published.count ?? 0 },
    { label: "Categories", value: categories.count ?? 0 },
    { label: "Orders", value: orders.count ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-sm text-gray-400">
        Welcome back. Full catalog & order management lands in Phase 5.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/10 bg-neutral-950/60 p-6"
          >
            <p className="text-3xl font-bold text-yellow-400">{s.value}</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-gray-400">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
