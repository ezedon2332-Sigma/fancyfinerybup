import "server-only";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import { orderStatusLabel } from "@/lib/order-status";

/**
 * Pluggable transactional email.
 *
 * No provider is configured yet, so `sendEmail` safely no-ops (logging in dev).
 * The moment a provider key exists (e.g. RESEND_API_KEY) + a verified sender,
 * fill in the send call below and every notification starts delivering — no
 * other code changes needed. All notify* helpers are best-effort and never
 * throw, so they can't break checkout or admin actions.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email:noop] → ${msg.to}: ${msg.subject}`);
    }
    return; // no provider configured — hook point for real delivery
  }
  // When enabling: POST to your provider here using `apiKey` and a verified
  // FROM address (e.g. process.env.EMAIL_FROM). Kept out until configured so
  // no build/runtime dependency is introduced prematurely.
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
