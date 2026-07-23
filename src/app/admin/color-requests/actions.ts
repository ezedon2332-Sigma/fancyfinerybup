"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import { COLOR_REQUEST_STATUSES } from "@/domain/colors";
import { sendEmail } from "@/infrastructure/notifications/email";

export interface CRActionResult {
  ok: boolean;
  error?: string;
}

const statusSchema = z.enum(
  COLOR_REQUEST_STATUSES as unknown as [string, ...string[]],
);

export async function updateColorRequestStatus(
  id: string,
  status: string,
): Promise<CRActionResult> {
  await requireAdmin();
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Invalid status." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("color_requests")
    .update({ status: parsed.data })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/color-requests");
  return { ok: true };
}

export async function saveColorRequestNote(
  id: string,
  note: string,
): Promise<CRActionResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("color_requests")
    .update({ admin_note: note.slice(0, 1000) })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/color-requests");
  return { ok: true };
}

/** Email the customer that their colour is available, and set status. */
export async function notifyColorAvailable(id: string): Promise<CRActionResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { data: r } = await admin
    .from("color_requests")
    .select("customer_email, customer_name, requested_color, product_name")
    .eq("id", id)
    .maybeSingle();
  if (!r?.customer_email) return { ok: false, error: "No customer email on file." };

  await sendEmail({
    to: r.customer_email,
    subject: `Your ${r.requested_color} ${r.product_name} is available — Fancy Finery`,
    text:
      `Hi ${r.customer_name ?? "there"},\n\n` +
      `Great news! The ${r.requested_color} colour you requested for ` +
      `"${r.product_name}" is now available. Reply to this email or visit the ` +
      `store to place your order.\n\n— Fancy Finery`,
  });

  await admin.from("color_requests").update({ status: "available" }).eq("id", id);
  revalidatePath("/admin/color-requests");
  return { ok: true };
}
