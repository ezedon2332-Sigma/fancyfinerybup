"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";

import { cancelOrder } from "@/app/account/orders/actions";
import { toastResult } from "@/components/ui/Toast";

/**
 * Cancel an unpaid order.
 *
 * Only rendered when the server has already decided the order is cancellable,
 * so this is not a permission check — the action re-decides on the server, and
 * hiding the button is purely so a customer is not offered something that will
 * fail.
 *
 * Two-step, because cancelling is not undoable from here: the first click asks,
 * the second commits.
 */
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      const res = await cancelOrder(orderId);
      toastResult(res, { success: "Order cancelled." });
      if (!res.ok) setConfirming(false);
      // On success the page revalidates and this button disappears with it.
    });
  }

  if (!confirming) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 underline transition-colors hover:text-red-400"
        >
          <X className="h-3.5 w-3.5" />
          Cancel this order
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
      <p className="text-sm text-gray-200">
        Cancel this order? This cannot be undone — you would need to place it
        again.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400 disabled:opacity-50"
        >
          {pending ? "Cancelling…" : "Yes, cancel it"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/30 disabled:opacity-50"
        >
          Keep my order
        </button>
      </div>
    </div>
  );
}
