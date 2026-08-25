"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { formatMoney } from "@/domain/shared/money";
import type { CustomerRow } from "@/domain/entities/customer-views";
import { RoleToggle } from "./RoleToggle";

type Filter = "all" | "with-orders" | "admins";

export function CustomersTable({
  customers,
  currentUserId,
}: {
  customers: CustomerRow[];
  currentUserId: string;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return customers.filter((c) => {
      if (filter === "with-orders" && c.orderCount === 0) return false;
      if (filter === "admins" && c.role !== "admin") return false;
      if (!term) return true;
      return (
        (c.email ?? "").toLowerCase().includes(term) ||
        (c.fullName ?? "").toLowerCase().includes(term)
      );
    });
  }, [customers, q, filter]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-sm border border-white/20 bg-black/40 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-yellow-500"
          />
        </div>
        <div className="flex gap-2 text-xs">
          {(["all", "with-orders", "admins"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1.5 uppercase tracking-widest transition-colors ${
                filter === f
                  ? "border-yellow-500 bg-yellow-500 text-black"
                  : "border-white/20 text-gray-300 hover:border-yellow-500"
              }`}
            >
              {f === "with-orders" ? "With orders" : f}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-widest text-gray-400">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Spent</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-white/5">
                <td className="px-4 py-3">
                  <Link href={`/admin/customers/${c.id}`} className="font-medium text-white hover:text-yellow-400">
                    {c.fullName ?? "—"}
                  </Link>
                  <span className="block text-xs text-gray-500">{c.email}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${c.role === "admin" ? "bg-yellow-500/15 text-yellow-400" : "bg-white/10 text-gray-300"}`}>
                    {c.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300">{c.orderCount}</td>
                <td className="px-4 py-3 text-yellow-400">
                  {formatMoney(c.totalSpent, "NGN")}
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <RoleToggle userId={c.id} role={c.role} isSelf={c.id === currentUserId} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No customers match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
