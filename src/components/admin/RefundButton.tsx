"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { refundOrder } from "@/app/admin/orders/actions";
import { toast } from "@/components/ui/Toast";

/** Full refund of a paid order, with a confirm guard. Admin-only. */
export function RefundButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
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
    const res = await refundOrder(orderId);
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      toast.error(res.error ?? "Refund failed.");
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
    </div>
  );
}
