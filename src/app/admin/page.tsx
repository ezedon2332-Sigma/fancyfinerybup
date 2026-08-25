import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { listAdmins } from "@/infrastructure/db/admin-invite-service";
import { loadAdminCounts } from "@/infrastructure/db/admin-read-service";

export const metadata: Metadata = { title: "Admin Dashboard" };

interface AdminRow {
  email: string;
  active: boolean;
}

/**
 * The store's admins.
 *
 * This used to cross-reference the `admin_allowlist` table against every
 * registered identity, paging the Supabase Admin API up to ten times to decide
 * whether an allowlisted email had actually signed up. Admins are now simply
 * profiles with role='admin' in our own database, so "active" is not something
 * to infer — every row returned IS a real account. Pending invitations live in
 * `admin_invites` and are shown on Admin -> Team.
 */
async function loadAdmins(): Promise<AdminRow[]> {
  try {
    const rows = await listAdmins();
    return rows
      .map((r) => ({ email: (r.email ?? "").toLowerCase(), active: true }))
      .filter((r) => r.email.length > 0)
      .sort((a, b) => a.email.localeCompare(b.email));
  } catch {
    return [];
  }
}

export default async function AdminDashboard() {
  const [counts, admins] = await Promise.all([loadAdminCounts(), loadAdmins()]);

  const stats = [
    { label: "Products", value: counts.products },
    { label: "Published", value: counts.published },
    { label: "Categories", value: counts.categories },
    { label: "Orders", value: counts.orders },
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
