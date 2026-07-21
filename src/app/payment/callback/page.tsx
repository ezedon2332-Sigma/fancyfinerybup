import Link from "next/link";
import { redirect } from "next/navigation";
import { XCircle } from "lucide-react";

import { confirmPaystackByReference } from "@/infrastructure/payments/confirm";

export const dynamic = "force-dynamic";

/** Where Paystack redirects the customer after payment. Verifies the charge
 *  server-side, marks the order paid, and forwards to the order page. */
export default async function PaymentCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const { reference, trxref } = await searchParams;
  const ref = reference || trxref;

  if (ref) {
    const res = await confirmPaystackByReference(ref);
    if (res.ok && res.orderId) {
      redirect(`/account/orders/${res.orderId}?paid=1`);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <XCircle className="mx-auto h-12 w-12 text-red-400" />
      <h1 className="mt-4 text-2xl font-bold">Payment not confirmed</h1>
      <p className="mt-2 text-sm text-gray-400">
        We couldn&apos;t confirm this payment yet. If you were charged, it will be
        reconciled automatically — check your orders shortly.
      </p>
      <Link
        href="/account"
        className="mt-6 inline-block rounded-full bg-yellow-500 px-6 py-3 font-semibold text-black transition-colors hover:bg-yellow-400"
      >
        Go to my orders
      </Link>
    </div>
  );
}
