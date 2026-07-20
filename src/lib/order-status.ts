import type { OrderStatus } from "@/domain/entities/order";

/** Human labels for the fulfilment lifecycle. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Tailwind badge classes per status. */
export const ORDER_STATUS_BADGE: Record<OrderStatus, string> = {
  processing: "bg-yellow-500/15 text-yellow-400",
  packed: "bg-blue-500/15 text-blue-400",
  shipped: "bg-indigo-500/15 text-indigo-400",
  out_for_delivery: "bg-purple-500/15 text-purple-400",
  delivered: "bg-green-500/15 text-green-400",
  cancelled: "bg-red-500/15 text-red-400",
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}

export function orderStatusBadge(status: string): string {
  return ORDER_STATUS_BADGE[status as OrderStatus] ?? "bg-white/10 text-gray-300";
}

/** Statuses at/after which an order has a tracking number and is in transit. */
export function isShipped(status: string): boolean {
  return (
    status === "shipped" ||
    status === "out_for_delivery" ||
    status === "delivered"
  );
}
