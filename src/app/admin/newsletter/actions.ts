"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/infrastructure/auth/session";
import { eq } from "drizzle-orm";

import { db } from "@/infrastructure/db/client";
import { emailCampaigns, newsletterSubscribers } from "@/infrastructure/db/schema";
import { campaignSchema } from "@/lib/validation";
import { interestLabel } from "@/domain/newsletter";
import {
  dispatchCampaign,
  listSubscribers,
  recordHistory,
} from "@/infrastructure/db/newsletter-service";

export interface NLActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/** Remove a subscriber outright (GDPR erasure). The audit row is written
 *  before the delete, since the cascade takes the history with it. */
export async function deleteSubscriber(id: string): Promise<NLActionResult> {
  await requireAdmin();
  // Read the address before deleting: the audit trail needs it, and the row is
  // about to be gone. Returning it from the DELETE gets both in one statement
  // and removes the window where the read succeeds and the delete does not.
  let deleted;
  try {
    deleted = await db
      .delete(newsletterSubscribers)
      .where(eq(newsletterSubscribers.id, id))
      .returning({ email: newsletterSubscribers.email });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const data = deleted[0];
  if (data?.email) {
    await recordHistory({
      subscriberId: null,
      email: data.email,
      action: "deleted",
      source: "admin",
    });
  }

  revalidatePath("/admin/newsletter");
  return { ok: true };
}

/** Flip a member between subscribed and unsubscribed from the dashboard. */
export async function setSubscriberStatus(
  id: string,
  status: "subscribed" | "unsubscribed",
): Promise<NLActionResult> {
  await requireAdmin();
  try {
    await db
      .update(newsletterSubscribers)
      .set({
        status,
        unsubscribedAt:
          status === "unsubscribed" ? new Date().toISOString() : null,
      })
      .where(eq(newsletterSubscribers.id, id));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/admin/newsletter");
  return { ok: true };
}

/** CSV of the current filter selection, built server-side so the browser
 *  never has to hold the whole list. */
export async function exportSubscribersCsv(filters: {
  search?: string;
  status?: string;
  interest?: string;
}): Promise<{ ok: boolean; csv?: string; error?: string }> {
  await requireAdmin();
  try {
    const rows = await listSubscribers({ ...filters, limit: 10_000 });
    const header = [
      "Email",
      "First Name",
      "Last Name",
      "Country",
      "Birthday",
      "Status",
      "Source",
      "Interests",
      "Joined",
    ];
    const body = rows.map((r) =>
      [
        r.email,
        r.firstName,
        r.lastName ?? "",
        r.country ?? "",
        r.birthday ?? "",
        r.status,
        r.source,
        r.interests.map(interestLabel).join(" | "),
        new Date(r.createdAt).toISOString().slice(0, 10),
      ]
        .map(csvCell)
        .join(","),
    );
    return { ok: true, csv: [header.join(","), ...body].join("\r\n") };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Quote for CSV, and defuse the leading characters spreadsheets treat as
 *  formulas — a subscriber-supplied name must not execute in Excel. */
function csvCell(value: string): string {
  const v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${v.replace(/"/g, '""')}"`;
}

export async function saveCampaign(input: unknown): Promise<NLActionResult> {
  const profile = await requireAdmin();
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign." };
  }

  // `created_by` is set once, on insert — an edit must not reassign authorship.
  const row = {
    name: parsed.data.name,
    subject: parsed.data.subject,
    preheader: parsed.data.preheader ?? null,
    html: parsed.data.html ?? null,
    textBody: parsed.data.textBody ?? null,
    audienceFilter: { interests: parsed.data.interests },
    scheduledAt: parsed.data.scheduledAt || null,
    status: parsed.data.scheduledAt ? "scheduled" : "draft",
  };

  try {
    if (parsed.data.id) {
      await db
        .update(emailCampaigns)
        .set(row)
        .where(eq(emailCampaigns.id, parsed.data.id));
    } else {
      await db.insert(emailCampaigns).values({ ...row, createdBy: profile.id });
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/admin/newsletter");
  return { ok: true, message: parsed.data.scheduledAt ? "Campaign scheduled." : "Draft saved." };
}

export async function deleteCampaign(id: string): Promise<NLActionResult> {
  await requireAdmin();
  try {
    await db.delete(emailCampaigns).where(eq(emailCampaigns.id, id));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/admin/newsletter");
  return { ok: true };
}

/** Send a campaign now. The work lives in the service layer so this and the
 *  scheduled-campaign cron take exactly the same path. */
export async function sendCampaign(id: string): Promise<NLActionResult> {
  await requireAdmin();

  const result = await dispatchCampaign(id);
  revalidatePath("/admin/newsletter");

  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    message: `Sent to ${result.sent} member${result.sent === 1 ? "" : "s"}${
      result.failed > 0 ? `, ${result.failed} failed` : ""
    }.`,
  };
}
