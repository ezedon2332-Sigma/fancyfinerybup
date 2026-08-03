"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { refundOrder } from "@/app/admin/orders/actions";

/** Full refund of a paid order, with a confirm guard. Admin-only. */
export function RefundButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleRefund() {
    if (
      !window.confirm(
        "Refund this order in full through the payment provider? This cannot be undone.",
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    const res = await refundOrder(orderId);
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      setError(res.error ?? "Refund failed.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRefund}
        disabled={loading}
        className="inline-flex items-center rounded-full border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Refunding…" : "Refund order"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
