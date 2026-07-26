import { Check, CircleDashed, Package, Truck, XCircle } from "lucide-react";

import type { OrderStatus } from "@/domain/entities/order";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";

/** The happy path, in order. `cancelled` is handled separately — it is an exit
 *  from the journey rather than a step along it. */
const JOURNEY: OrderStatus[] = [
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
];

const COPY: Record<OrderStatus, string> = {
  processing: "Your order has been received and is being prepared by our atelier.",
  packed: "Wrapped and boxed, awaiting collection by the courier.",
  shipped: "In transit with the carrier.",
  out_for_delivery: "With the courier for delivery today.",
  delivered: "Delivered. We hope you love it.",
  cancelled: "This order was cancelled.",
};

const ICON: Partial<Record<OrderStatus, typeof Check>> = {
  processing: CircleDashed,
  packed: Package,
  shipped: Truck,
  out_for_delivery: Truck,
  delivered: Check,
};

/**
 * Vertical shipment timeline.
 *
 * Progress is derived from the order's single status field rather than from a
 * stored event log: reaching "shipped" necessarily means it was packed, so
 * every earlier step renders as complete. A real per-event history with
 * timestamps needs an order_events table — see the shipping module notes.
 */
export function ShipmentTimeline({
  status,
  className = "",
}: {
  status: OrderStatus;
  className?: string;
}) {
  if (status === "cancelled") {
    return (
      <div
        className={`flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-5 ${className}`}
        role="status"
      >
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <div>
          <p className="font-medium text-red-300">Cancelled</p>
          <p className="mt-1 text-sm text-gray-400">{COPY.cancelled}</p>
        </div>
      </div>
    );
  }

  const currentIndex = JOURNEY.indexOf(status);
  const percent =
    currentIndex <= 0 ? 0 : (currentIndex / (JOURNEY.length - 1)) * 100;

  return (
    <div className={className}>
      {/* Progress rail — decorative; the list below carries the meaning. */}
      <div
        aria-hidden
        className="mb-8 h-px w-full overflow-hidden rounded-full bg-white/10"
      >
        <div
          className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-[width] duration-1000 ease-out"
          style={{ width: `${Math.max(percent, 2)}%` }}
        />
      </div>

      <ol className="relative space-y-7">
        {JOURNEY.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          const Icon = ICON[step] ?? CircleDashed;
          const last = i === JOURNEY.length - 1;

          return (
            <li key={step} className="relative flex gap-4 pl-0">
              {/* Connector to the next step */}
              {!last && (
                <span
                  aria-hidden
                  className={`absolute left-[15px] top-9 h-[calc(100%+0.5rem)] w-px ${
                    done ? "bg-yellow-600/60" : "bg-white/10"
                  }`}
                />
              )}

              <span
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-500 ${
                  done
                    ? "border-yellow-600/60 bg-yellow-500/20 text-yellow-400"
                    : active
                      ? "border-yellow-500 bg-yellow-500 text-black"
                      : "border-white/15 bg-white/[0.03] text-gray-600"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={done || active ? 2.5 : 1.5} />
              </span>

              <div className="min-w-0 pt-1">
                <p
                  className={`text-sm font-medium ${
                    active ? "text-yellow-400" : done ? "text-gray-200" : "text-gray-500"
                  }`}
                >
                  {ORDER_STATUS_LABELS[step]}
                  {active && (
                    <span className="ml-2 inline-flex items-center gap-1.5 align-middle text-[10px] uppercase tracking-widest text-yellow-500">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yellow-500" />
                      </span>
                      Current
                    </span>
                  )}
                </p>
                <p
                  className={`mt-1 text-xs leading-relaxed ${
                    done || active ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {COPY[step]}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
