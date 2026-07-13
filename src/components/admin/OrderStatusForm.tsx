"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { updateOrderStatus } from "@/app/admin/orders/actions";

const STATUSES = ["pending", "paid", "fulfilled", "cancelled"] as const;

export function OrderStatusForm({
  orderId,
  current,
}: {
  orderId: string;
  current: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function onSave() {
    setBusy(true);
    setSaved(false);
    const res = await updateOrderStatus(orderId, status);
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1500);
    } else {
      alert(res.error ?? "Could not update.");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="rounded-sm border border-white/20 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onSave}
        disabled={busy || status === current}
        className="inline-flex items-center gap-2 rounded-sm bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-600 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {saved ? "Saved" : "Update"}
      </button>
    </div>
  );
}
