import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, MapPin, MessageCircleQuestion } from "lucide-react";

import { requireUser } from "@/infrastructure/auth/session";
import { getOrderRepository } from "@/infrastructure/db/order-service";
import { isCurrencyPayable } from "@/infrastructure/payments/providers";
import { PayNowButton } from "@/components/checkout/PayNowButton";
import { CancelOrderButton } from "@/components/account/CancelOrderButton";
import { formatMoney } from "@/domain/shared/money";
import {
  orderStatusBadge,
  orderStatusLabel,
  paymentStatusBadge,
  paymentStatusLabel,
} from "@/lib/order-status";

export const metadata: Metadata = { title: "Order" };

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string; paid?: string; canceled?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { placed, paid, canceled } = await searchParams;

  const orders = await getOrderRepository();
  // Ownership is now an explicit argument. Under Supabase this was findById()
  // and RLS supplied `user_id = auth.uid()` invisibly — without it, any
  // signed-in customer could read any order by guessing its id.
  const order = await orders.findByIdForUser(id, user.id);
  if (!order) notFound();

  // Whether an online charge can be (re)started for this order right now.
  const canPayNow =
    (order.paymentStatus === "unpaid" || order.paymentStatus === "failed") &&
    isCurrencyPayable(order.currency);

  // Mirrors the repository predicate exactly (cancelUnpaidForUser): unpaid and
  // still processing. Kept in step so the button is never offered for something
  // the server would then refuse.
  const canCancel =
    (order.paymentStatus === "unpaid" || order.paymentStatus === "failed") &&
    order.status === "processing";

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:px-10">
      {paid ? (
        <div className="mb-8 flex items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/5 p-5">
          <CheckCircle2 className="h-6 w-6 text-green-400" />
          <div>
            <p className="font-semibold text-green-300">Payment received!</p>
            <p className="text-sm text-gray-400">
              Thank you — your payment is confirmed and your order is being
              prepared.
            </p>
          </div>
        </div>
      ) : placed ? (
        <div className="mb-8 flex items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/5 p-5">
          <CheckCircle2 className="h-6 w-6 text-green-400" />
          <div>
            <p className="font-semibold text-green-300">Order placed!</p>
            <p className="text-sm text-gray-400">
              We’ve received your order and will arrange delivery.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Order #{order.id.slice(0, 8)}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest ${orderStatusBadge(order.status)}`}>
          {orderStatusLabel(order.status)}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-400">
        {new Date(order.createdAt).toLocaleString()}
      </p>

      <div className="mt-8 rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
          Items
        </h2>
        <div className="mt-4 divide-y divide-white/5">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-3 text-sm">
              <span>
                {item.nameSnapshot}{" "}
                <span className="text-gray-500">× {item.qty}</span>
              </span>
              <span className="text-yellow-400">
                {formatMoney(item.unitPrice * item.qty, order.currency)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm">
          <div className="flex justify-between text-gray-300">
            <span>Subtotal</span>
            <span>{formatMoney(order.subtotal, order.currency)}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>
              Shipping{order.shippingMethod ? ` · ${order.shippingMethod}` : ""}
            </span>
            <span>
              {order.shippingCost === 0
                ? "FREE"
                : formatMoney(order.shippingCost, order.currency)}
            </span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-2 font-semibold">
            <span>Total</span>
            <span>{formatMoney(order.total, order.currency)}</span>
          </div>
        </div>
      </div>

      {/* Payment */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
          Payment
        </h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest ${paymentStatusBadge(order.paymentStatus)}`}
            >
              {paymentStatusLabel(order.paymentStatus)}
            </span>
            <span className="text-sm text-gray-400">
              {formatMoney(order.total, order.currency)}
            </span>
          </div>
          {canPayNow && (
            <PayNowButton
              orderId={order.id}
              label={order.paymentStatus === "failed" ? "Retry payment" : "Pay now"}
            />
          )}
        </div>
        {order.paymentStatus === "unpaid" && !canPayNow && (
          <p className="mt-3 text-sm text-gray-500">
            This order is payable on delivery.
          </p>
        )}
        {/* Somewhere to go when something is wrong.
            The order reference travels in the link, so the customer does not
            have to find and retype it and support does not have to ask. A
            payment that failed, an address that needs changing, an item that
            arrived damaged — all of it used to dead-end on this page. */}
        <div className="mt-5 border-t border-white/8 pt-4">
          <Link
            href={`/contact?order=${encodeURIComponent(order.id.slice(0, 8).toUpperCase())}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 underline transition-colors hover:text-yellow-400"
          >
            <MessageCircleQuestion className="h-3.5 w-3.5" />
            Problem with this order?
          </Link>
          {order.paymentStatus === "failed" && (
            <p className="mt-2 text-sm text-gray-500">
              Your last payment attempt did not go through. You can retry above,
              or get in touch and we will help.
            </p>
          )}
        </div>

        {canCancel && (
          <div className="mt-5 border-t border-white/8 pt-4">
            <CancelOrderButton orderId={order.id} />
          </div>
        )}
        {canceled && order.paymentStatus !== "paid" && (
          <p className="mt-3 text-sm text-gray-400">
            Payment was canceled — you can try again above.
          </p>
        )}
      </div>

      {order.trackingNumber && (
        <div className="mt-6 rounded-2xl border border-yellow-600/30 bg-neutral-950/60 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
            Tracking
          </h2>
          <p className="mt-2 text-sm text-gray-300">
            Your order is <strong>{orderStatusLabel(order.status)}</strong>.
            Tracking number:{" "}
            <span className="font-mono text-yellow-400">{order.trackingNumber}</span>
          </p>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gray-300">
          <MapPin className="h-4 w-4" /> Delivery
        </h2>
        <div className="mt-3 text-sm text-gray-300">
          <p>{order.shipping.name}</p>
          <p>{order.shipping.phone}</p>
          <p>
            {[
              order.shipping.address,
              order.shipping.apartment,
              order.shipping.city,
              order.shipping.state,
              order.shipping.postal,
              order.shipping.country,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
          {order.shipping.lat != null && order.shipping.lng != null && (
            <a
              href={`https://www.google.com/maps?q=${order.shipping.lat},${order.shipping.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-yellow-400 hover:text-yellow-300"
            >
              View pinned location →
            </a>
          )}
        </div>
      </div>

      <Link
        href="/account"
        className="mt-8 inline-block text-sm text-gray-400 hover:text-yellow-400"
      >
        ← Back to account
      </Link>
    </div>
  );
}
