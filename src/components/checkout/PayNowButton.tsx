"use client";

import { useState } from "react";

import { startPaymentAction } from "@/app/checkout/payment-actions";

/** Starts (or retries) online payment for an existing order and redirects to
 *  the provider's hosted page. Shown on unpaid / failed orders. */
export function PayNowButton({
  orderId,
  label = "Pay now",
}: {
  orderId: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);
    const res = await startPaymentAction(orderId);
    if (res.ok && res.url) {
      window.location.href = res.url;
      return;
    }
    setError(res.error ?? "Could not start payment. Please try again.");
    setLoading(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className="inline-flex items-center rounded-full bg-yellow-500 px-6 py-3 font-semibold text-black transition-colors hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Starting…" : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
