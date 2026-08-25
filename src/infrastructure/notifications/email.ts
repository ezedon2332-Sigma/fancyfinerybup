import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/infrastructure/db/client";
import { orders } from "@/infrastructure/db/schema";
import { formatMoney } from "@/domain/shared/money";
import {
  button,
  detailRows,
  fallbackLink,
  heading,
  paragraph,
  shell,
} from "./email-shell";

/** Customer-supplied names end up inside HTML; escape them. */
function escapeForEmail(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
import { BRAND_EMAIL, SITE_URL } from "@/lib/site";
import { orderStatusLabel } from "@/lib/order-status";
import {
  sendViaProvider,
  type SendResult,
} from "@/infrastructure/notifications/email-provider";
import { buildTransactionalEmail } from "@/infrastructure/notifications/newsletter-emails";

/**
 * Transactional email — order confirmations and status updates.
 *
 * Delivery goes through the shared provider transport, so a single provider
 * key powers both these notifications and the Privé Circle newsletter. With no
 * provider configured the transport no-ops and logs in dev.
 *
 * No unsubscribe link is attached: these are transactional, not marketing, and
 * a customer must not be able to opt out of hearing that their order shipped.
 *
 * All notify* helpers are best-effort and never throw, so they can't break
 * checkout or admin actions.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Optional override; otherwise the text is wrapped in the house frame. */
  html?: string;
  /**
   * Identifies the notification, not the attempt — e.g. `order-status:<id>:shipped`.
   * Lets the provider collapse a duplicate send caused by a retried invocation.
   */
  idempotencyKey?: string;
}

/** Send one transactional message. Never throws; returns the delivery result so
 *  a caller that cares can react, and logs so one that doesn't still leaves a
 *  trail. */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const result = await sendViaProvider({
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html ?? buildTransactionalEmail(msg.subject, msg.text),
    idempotencyKey: msg.idempotencyKey,
  });

  if (!result.ok) {
    // Surfaced rather than swallowed: a silent failure here is how order
    // confirmations go missing without anyone noticing.
    console.error(
      `[email] delivery failed → ${msg.to} (${msg.subject}): ${result.error}`,
    );
  }
  return result;
}

async function loadOrderEmail(orderId: string): Promise<{
  email: string | null;
  name: string | null;
  tracking: string | null;
} | null> {
  try {
    const row = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      columns: {
        shippingEmail: true,
        shippingName: true,
        trackingNumber: true,
      },
    });
    if (!row) return null;
    return {
      email: row.shippingEmail,
      name: row.shippingName,
      tracking: row.trackingNumber,
    };
  } catch {
    return null;
  }
}

/** Shipping confirmation after an order is placed. */
export async function notifyOrderPlaced(orderId: string): Promise<void> {
  const info = await loadOrderEmail(orderId);
  if (!info?.email) return;
  const ref = orderId.slice(0, 8).toUpperCase();
  const url = `${SITE_URL}/account/orders/${orderId}`;

  await sendEmail({
    to: info.email,
    idempotencyKey: `order-placed:${orderId}`,
    subject: "We've received your order — Fancy Finery",
    html: shell(
      "We've received your order",
      heading("Thank you for your order") +
        paragraph(`Hi ${escapeForEmail(info.name ?? "there")},`) +
        paragraph(
          "We have your order and are preparing it for despatch. You will get " +
            "tracking details by email the moment it ships.",
        ) +
        detailRows([["Order reference", `#${ref}`]]) +
        button(url, "View your order") +
        fallbackLink(url),
      { kicker: "Order Confirmation" },
    ),
    text:
      `Hi ${info.name ?? "there"},\n\n` +
      `Thanks for your order (#${ref}). We're preparing it for shipment and ` +
      `will email tracking details as soon as it ships.\n\n` +
      `View your order: ${url}\n\n— Fancy Finery`,
  });
}

/** Payment receipt once a charge is confirmed (webhook or callback). */
export async function notifyPaymentReceived(orderId: string): Promise<void> {
  try {
    const row = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      columns: {
        shippingEmail: true,
        shippingName: true,
        total: true,
        currency: true,
      },
    });
    if (!row?.shippingEmail) return;
    const amount = formatMoney(row.total, row.currency);
    const ref = orderId.slice(0, 8).toUpperCase();
    const url = `${SITE_URL}/account/orders/${orderId}`;

    await sendEmail({
      to: row.shippingEmail,
      // One receipt per order, even if a webhook, the browser callback and the
      // reconcile sweep all reach this line.
      idempotencyKey: `payment-received:${orderId}`,
      subject: "Payment received — Fancy Finery",
      html: shell(
        "Payment received",
        heading("Payment received") +
          paragraph(`Hi ${escapeForEmail(row.shippingName ?? "there")},`) +
          paragraph(
            "Your payment has cleared and your order is confirmed. We are " +
              "preparing it for despatch.",
          ) +
          detailRows([
            ["Order reference", `#${ref}`],
            ["Amount paid", amount],
          ]) +
          button(url, "View your order") +
          fallbackLink(url),
        { kicker: "Receipt" },
      ),
      text:
        `Hi ${row.shippingName ?? "there"},\n\n` +
        `We've received your payment of ${amount} for order #${ref}. Your ` +
        `order is confirmed and being prepared for shipment.\n\n` +
        `View your order: ${url}\n\nThank you for shopping with Fancy Finery.`,
    });
  } catch {
    /* best-effort — a receipt failing must never unwind a confirmed payment */
  }
}

/** Alert the team that a concierge conversation needs a human. Best-effort. */
export async function notifyHumanHandoff(
  conversationId: string,
  snippet: string,
): Promise<void> {
  try {
    await sendEmail({
      to: BRAND_EMAIL,
      subject: "A shopper asked for a human — Fancy Finery concierge",
      text:
        `A shopper has asked to speak with the team via the concierge.\n\n` +
        `Latest message: ${snippet.slice(0, 300)}\n\n` +
        `Open and reply here:\n${SITE_URL}/admin/ai/conversations/${conversationId}`,
    });
  } catch {
    /* best-effort */
  }
}

/** Tracking / status update when an order's status changes. */
export async function notifyOrderStatusChanged(
  orderId: string,
  status: string,
): Promise<void> {
  const info = await loadOrderEmail(orderId);
  if (!info?.email) return;
  const trackingLine = info.tracking
    ? `\nTracking number: ${info.tracking}`
    : "";
  await sendEmail({
    to: info.email,
    // Keyed by status, so "shipped" and a later "delivered" both go out.
    idempotencyKey: `order-status:${orderId}:${status}`,
    subject: `Your order is ${orderStatusLabel(status)} — Fancy Finery`,
    text:
      `Hi ${info.name ?? "there"},\n\n` +
      `Your order #${orderId.slice(0, 8)} is now "${orderStatusLabel(status)}".` +
      `${trackingLine}\n\n— Fancy Finery`,
  });
}
