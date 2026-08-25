"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/infrastructure/auth/session";
import { eq } from "drizzle-orm";

import { db } from "@/infrastructure/db/client";
import { colorRequests } from "@/infrastructure/db/schema";
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

  try {
    await db
      .update(colorRequests)
      .set({ status: parsed.data })
      .where(eq(colorRequests.id, id));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/admin/color-requests");
  return { ok: true };
}

export async function saveColorRequestNote(
  id: string,
  note: string,
): Promise<CRActionResult> {
  await requireAdmin();
  try {
    await db
      .update(colorRequests)
      .set({ adminNote: note.slice(0, 1000) })
      .where(eq(colorRequests.id, id));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/admin/color-requests");
  return { ok: true };
}

/** Email the customer that their colour is available, and set status. */
export async function notifyColorAvailable(id: string): Promise<CRActionResult> {
  await requireAdmin();
  const r = await db.query.colorRequests.findFirst({
    where: eq(colorRequests.id, id),
    columns: {
      customerEmail: true,
      customerName: true,
      requestedColor: true,
      productName: true,
    },
  });
  if (!r?.customerEmail) return { ok: false, error: "No customer email on file." };

  await sendEmail({
    to: r.customerEmail,
    subject: `Your ${r.requestedColor} ${r.productName} is available — Fancy Finery`,
    text:
      `Hi ${r.customerName ?? "there"},\n\n` +
      `Great news! The ${r.requestedColor} colour you requested for ` +
      `"${r.productName}" is now available. Reply to this email or visit the ` +
      `store to place your order.\n\n— Fancy Finery`,
  });

  await db
    .update(colorRequests)
    .set({ status: "available" })
    .where(eq(colorRequests.id, id));
  revalidatePath("/admin/color-requests");
  return { ok: true };
}
