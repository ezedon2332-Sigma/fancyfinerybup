import "server-only";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import { formatMoney } from "@/domain/shared/money";
import { orderStatusLabel } from "@/lib/order-status";
import { sendViaProvider } from "@/infrastructure/notifications/email-provider";
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
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const result = await sendViaProvider({
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html ?? buildTransactionalEmail(msg.subject, msg.text),
  });

  if (!result.ok) {
    // Surfaced rather than swallowed: a silent failure here is how order
    // confirmations go missing without anyone noticing.
    console.error(
      `[email] delivery failed → ${msg.to} (${msg.subject}): ${result.error}`,
    );
  }
}

async function loadOrderEmail(orderId: string): Promise<{
  email: string | null;
  name: string | null;
  tracking: string | null;
} | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("orders")
      .select("shipping_email, shipping_name, tracking_number")
      .eq("id", orderId)
      .maybeSingle();
    if (!data) return null;
    return {
      email: data.shipping_email,
      name: data.shipping_name,
      tracking: data.tracking_number,
    };
  } catch {
    return null;
  }
}

/** Shipping confirmation after an order is placed. */
export async function notifyOrderPlaced(orderId: string): Promise<void> {
  const info = await loadOrderEmail(orderId);
  if (!info?.email) return;
  await sendEmail({
    to: info.email,
    subject: "We've received your order — Fancy Finery",
    text:
      `Hi ${info.name ?? "there"},\n\n` +
      `Thanks for your order (#${orderId.slice(0, 8)}). We're preparing it for ` +
      `shipment and will email tracking details as soon as it ships.\n\n— Fancy Finery`,
  });
}

/** Payment receipt once a charge is confirmed (webhook or callback). */
export async function notifyPaymentReceived(orderId: string): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("orders")
      .select("shipping_email, shipping_name, total, currency")
      .eq("id", orderId)
      .maybeSingle();
    if (!data?.shipping_email) return;
    const amount = formatMoney(data.total, data.currency);
    await sendEmail({
      to: data.shipping_email,
      subject: "Payment received — Fancy Finery",
      text:
        `Hi ${data.shipping_name ?? "there"},\n\n` +
        `We've received your payment of ${amount} for order ` +
        `#${orderId.slice(0, 8)}. Your order is confirmed and being prepared ` +
        `for shipment.\n\nThank you for shopping with Fancy Finery.`,
    });
  } catch {
    /* best-effort — a receipt failing must never unwind a confirmed payment */
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
    subject: `Your order is ${orderStatusLabel(status)} — Fancy Finery`,
    text:
      `Hi ${info.name ?? "there"},\n\n` +
      `Your order #${orderId.slice(0, 8)} is now "${orderStatusLabel(status)}".` +
      `${trackingLine}\n\n— Fancy Finery`,
  });
}
