"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, Loader2, Search, Trash2, UserCheck, UserMinus } from "lucide-react";

import {
  deleteSubscriber,
  exportSubscribersCsv,
  setSubscriberStatus,
} from "@/app/admin/newsletter/actions";
import {
  FASHION_INTERESTS,
  SUBSCRIBER_STATUSES,
  interestLabel,
  type Subscriber,
} from "@/domain/newsletter";

/** Membership table: search, filter, export, promote/demote, erase. */
export function SubscribersPanel({
  subscribers,
  filters,
}: {
  subscribers: Subscriber[];
  filters: { q: string; status: string; interest: string };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/admin/newsletter?${next.toString()}`));
  };

  async function onExport() {
    setExporting(true);
    try {
      const res = await exportSubscribersCsv(filters);
      if (!res.ok || !res.csv) return;
      // Prepend a BOM so Excel reads the UTF-8 accents correctly.
      const blob = new Blob([`﻿${res.csv}`], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prive-circle-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function onDelete(s: Subscriber) {
    if (!confirm(`Permanently remove ${s.email}? This cannot be undone.`)) return;
    setBusyId(s.id);
    await deleteSubscriber(s.id);
    setBusyId(null);
    router.refresh();
  }

  async function onToggle(s: Subscriber) {
    setBusyId(s.id);
    await setSubscriberStatus(
      s.id,
      s.status === "subscribed" ? "unsubscribed" : "subscribed",
    );
    setBusyId(null);
    router.refresh();
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-white">
          Members
          <span className="ml-2 text-sm text-gray-500">({subscribers.length})</span>
        </h2>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting || subscribers.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-gray-200 transition-colors hover:border-yellow-500/60 hover:text-yellow-400 disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export CSV
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            defaultValue={filters.q}
            onKeyDown={(e) => {
              if (e.key === "Enter") setParam("q", e.currentTarget.value);
            }}
            onBlur={(e) => setParam("q", e.currentTarget.value)}
            placeholder="Search name, email or country…"
            aria-label="Search members"
            className="w-full rounded-lg border border-white/12 bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-yellow-500/70"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => setParam("status", e.target.value)}
          aria-label="Filter by status"
          className="rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-500/70"
        >
          <option value="" className="bg-neutral-950">All statuses</option>
          {SUBSCRIBER_STATUSES.map((s) => (
            <option key={s} value={s} className="bg-neutral-950">
              {s}
            </option>
          ))}
        </select>
        <select
          value={filters.interest}
          onChange={(e) => setParam("interest", e.target.value)}
          aria-label="Filter by interest"
          className="rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-500/70"
        >
          <option value="" className="bg-neutral-950">All interests</option>
          {FASHION_INTERESTS.map((i) => (
            <option key={i.id} value={i.id} className="bg-neutral-950">
              {i.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest text-gray-400">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Interests</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className={pending ? "opacity-60" : undefined}>
            {subscribers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                  No members match these filters yet.
                </td>
              </tr>
            )}
            {subscribers.map((s) => (
              <tr key={s.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">
                    {s.firstName} {s.lastName ?? ""}
                  </div>
                  <div className="text-xs text-gray-500">{s.email}</div>
                </td>
                <td className="px-4 py-3 text-gray-300">{s.country ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {s.interests.length === 0 && (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                    {s.interests.map((i) => (
                      <span
                        key={i}
                        className="rounded-full border border-yellow-600/25 px-2 py-0.5 text-[10px] text-gray-300"
                      >
                        {interestLabel(i)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{s.source}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                      s.status === "subscribed"
                        ? "bg-green-500/15 text-green-300"
                        : "bg-white/10 text-gray-400"
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(s.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onToggle(s)}
                      disabled={busyId === s.id}
                      title={
                        s.status === "subscribed"
                          ? "Mark unsubscribed"
                          : "Reinstate membership"
                      }
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-yellow-400 disabled:opacity-40"
                    >
                      {s.status === "subscribed" ? (
                        <UserMinus className="h-4 w-4" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(s)}
                      disabled={busyId === s.id}
                      title="Delete permanently"
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                    >
                      {busyId === s.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
