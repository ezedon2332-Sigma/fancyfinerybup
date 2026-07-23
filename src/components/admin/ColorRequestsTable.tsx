"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Mail } from "lucide-react";

import {
  COLOR_REQUEST_STATUSES,
  COLOR_REQUEST_STATUS_BADGE,
  COLOR_REQUEST_STATUS_LABEL,
  colorHex,
  type ColorRequestStatus,
} from "@/domain/colors";
import {
  notifyColorAvailable,
  saveColorRequestNote,
  updateColorRequestStatus,
} from "@/app/admin/color-requests/actions";

export interface ColorRequestRow {
  id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  requested_color: string;
  requested_size: string | null;
  quantity: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  note: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
}

function csvCell(v: string | number | null): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ColorRequestsTable({ requests }: { requests: ColorRequestRow[] }) {
  const router = useRouter();
  const [status, setStatus] = useState("all");
  const [colorQ, setColorQ] = useState("");
  const [productQ, setProductQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const c = colorQ.trim().toLowerCase();
    const p = productQ.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : 0;
    return requests.filter(
      (r) =>
        (status === "all" || r.status === status) &&
        (!c || r.requested_color.toLowerCase().includes(c)) &&
        (!p || r.product_name.toLowerCase().includes(p)) &&
        (!from || new Date(r.created_at).getTime() >= from),
    );
  }, [requests, status, colorQ, productQ, dateFrom]);

  function exportCsv() {
    const header = [
      "Date", "Product", "SKU", "Colour", "Size", "Qty",
      "Name", "Email", "Phone", "Note", "Status",
    ];
    const rows = filtered.map((r) => [
      new Date(r.created_at).toISOString(),
      r.product_name, r.product_sku, r.requested_color, r.requested_size,
      r.quantity, r.customer_name, r.customer_email, r.customer_phone,
      r.note, r.status,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `color-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function setRowStatus(id: string, s: string) {
    setBusy(id);
    await updateColorRequestStatus(id, s);
    setBusy(null);
    router.refresh();
  }
  async function saveNote(id: string, note: string) {
    setBusy(id);
    await saveColorRequestNote(id, note);
    setBusy(null);
    router.refresh();
  }
  async function notify(id: string) {
    setBusy(id);
    const res = await notifyColorAvailable(id);
    setBusy(null);
    if (!res.ok) alert(res.error ?? "Could not notify.");
    else router.refresh();
  }

  const field =
    "rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500";

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
          <option value="all">All statuses</option>
          {COLOR_REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>{COLOR_REQUEST_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <input value={productQ} onChange={(e) => setProductQ(e.target.value)} placeholder="Filter product…" className={`${field} w-40`} />
        <input value={colorQ} onChange={(e) => setColorQ(e.target.value)} placeholder="Filter colour…" className={`${field} w-36`} />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={field} />
        <span className="text-xs text-gray-500">{filtered.length} of {requests.length}</span>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-yellow-500/40 px-3 py-2 text-xs font-medium text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-40"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 rounded-xl border border-white/10 p-8 text-center text-sm text-gray-400">
          No colour requests {requests.length > 0 ? "match your filters" : "yet"}.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4">
              <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr_auto]">
                {/* Product + colour */}
                <div>
                  <p className="text-sm font-semibold text-gray-100">{r.product_name}</p>
                  {r.product_sku && (
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">SKU {r.product_sku}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="h-4 w-4 rounded-full border border-white/20" style={{ background: colorHex(r.requested_color) }} />
                    <span className="text-gray-200">{r.requested_color}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Size {r.requested_size ?? "—"} · Qty {r.quantity}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>

                {/* Customer */}
                <div className="text-sm text-gray-300">
                  <p>{r.customer_name}</p>
                  <p className="text-xs text-gray-400">{r.customer_email}</p>
                  {r.customer_phone && <p className="text-xs text-gray-400">{r.customer_phone}</p>}
                  {r.note && <p className="mt-1 text-xs italic text-gray-500">“{r.note}”</p>}
                </div>

                {/* Actions */}
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${COLOR_REQUEST_STATUS_BADGE[r.status as ColorRequestStatus] ?? "bg-white/10 text-gray-300"}`}>
                    {COLOR_REQUEST_STATUS_LABEL[r.status as ColorRequestStatus] ?? r.status}
                  </span>
                  <select
                    value={r.status}
                    disabled={busy === r.id}
                    onChange={(e) => setRowStatus(r.id, e.target.value)}
                    className={`${field} w-40`}
                  >
                    {COLOR_REQUEST_STATUSES.map((s) => (
                      <option key={s} value={s}>{COLOR_REQUEST_STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => notify(r.id)}
                    disabled={busy === r.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40"
                  >
                    {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                    Notify available
                  </button>
                </div>
              </div>

              {/* Internal note */}
              <details className="mt-3 border-t border-white/5 pt-3">
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-yellow-400">
                  Internal note {r.admin_note ? "✓" : ""}
                </summary>
                <NoteEditor
                  initial={r.admin_note ?? ""}
                  busy={busy === r.id}
                  onSave={(v) => saveNote(r.id, v)}
                />
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NoteEditor({
  initial,
  busy,
  onSave,
}: {
  initial: string;
  busy: boolean;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <div className="mt-2 flex gap-2">
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Internal note (not shown to customer)…"
        className="h-16 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-gray-200 outline-none focus:border-yellow-500"
      />
      <button
        type="button"
        onClick={() => onSave(v)}
        disabled={busy}
        className="self-start rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}
