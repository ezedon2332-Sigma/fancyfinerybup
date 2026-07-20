import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";

export const metadata: Metadata = { title: "Admin Dashboard" };

interface AdminRow {
  email: string;
  active: boolean;
}

async function loadAdmins(): Promise<AdminRow[]> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: allow } = await admin.from("admin_allowlist").select("email");
    const emails = (allow ?? []).map((a) => a.email.toLowerCase());
    if (emails.length === 0) return [];

    const registered = new Set<string>();
    for (let page = 1; page <= 10; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      for (const u of data.users) {
        if (u.email) registered.add(u.email.toLowerCase());
      }
      if (data.users.length < 200) break;
    }
    return emails
      .sort()
      .map((email) => ({ email, active: registered.has(email) }));
  } catch {
    return [];
  }
}

export default async function AdminDashboard() {
  const supabase = await createSupabaseServerClient();

  const [products, published, categories, orders, admins] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("status", "published"),
    supabase.from("categories").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }),
    loadAdmins(),
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
        Manage your catalog, orders, shipping and store settings.
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

      {/* Administrators */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-yellow-500" />
          <h2 className="text-lg font-semibold">Administrators</h2>
          <span className="ml-auto text-xs text-gray-500">
            {admins.length} {admins.length === 1 ? "admin" : "admins"}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          These accounts have full admin access to the store.
        </p>

        {admins.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">No administrators found.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/5">
            {admins.map((a) => (
              <li
                key={a.email}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-500/15 text-sm font-bold uppercase text-yellow-400">
                    {a.email.charAt(0)}
                  </span>
                  <span className="text-sm text-gray-100">{a.email}</span>
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${
                    a.active
                      ? "bg-green-500/15 text-green-400"
                      : "bg-yellow-500/15 text-yellow-400"
                  }`}
                >
                  {a.active ? "Active" : "Pending sign-in"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
