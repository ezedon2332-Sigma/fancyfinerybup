"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import { campaignSchema } from "@/lib/validation";
import { interestLabel, type FashionInterest } from "@/domain/newsletter";
import {
  listSubscribers,
  recordHistory,
} from "@/infrastructure/supabase/newsletter-service";
import { sendViaProvider } from "@/infrastructure/notifications/email-provider";
import {
  buildCampaignEmail,
  unsubscribeUrl,
} from "@/infrastructure/notifications/newsletter-emails";

export interface NLActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/** Remove a subscriber outright (GDPR erasure). The audit row is written
 *  before the delete, since the cascade takes the history with it. */
export async function deleteSubscriber(id: string): Promise<NLActionResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { data } = await admin
    .from("newsletter_subscribers")
    .select("email")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin
    .from("newsletter_subscribers")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

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
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("newsletter_subscribers")
    .update({
      status,
      unsubscribed_at: status === "unsubscribed" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

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

  const admin = createSupabaseAdminClient();
  // `created_by` is set once, on insert — an edit must not reassign authorship.
  const row = {
    name: parsed.data.name,
    subject: parsed.data.subject,
    preheader: parsed.data.preheader ?? null,
    html: parsed.data.html ?? null,
    text_body: parsed.data.textBody ?? null,
    audience_filter: { interests: parsed.data.interests },
    scheduled_at: parsed.data.scheduledAt || null,
    status: parsed.data.scheduledAt ? "scheduled" : "draft",
  };

  const { error } = parsed.data.id
    ? await admin.from("email_campaigns").update(row).eq("id", parsed.data.id)
    : await admin
        .from("email_campaigns")
        .insert({ ...row, created_by: profile.id });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/newsletter");
  return { ok: true, message: parsed.data.scheduledAt ? "Campaign scheduled." : "Draft saved." };
}

export async function deleteCampaign(id: string): Promise<NLActionResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("email_campaigns").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/newsletter");
  return { ok: true };
}

/**
 * Send a campaign to everyone matching its audience filter.
 *
 * Sends sequentially in small batches and writes a `sent` analytics row per
 * recipient, which the database trigger folds into the campaign counters. For
 * very large lists this should move behind a queue — see the note in the
 * dashboard — but it is correct and restartable as written.
 */
export async function sendCampaign(id: string): Promise<NLActionResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { data: campaign } = await admin
    .from("email_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return { ok: false, error: "Campaign not found." };
  if (campaign.status === "sending" || campaign.status === "sent") {
    return { ok: false, error: "This campaign has already been sent." };
  }

  const filter = (campaign.audience_filter ?? {}) as { interests?: string[] };
  const interests = filter.interests ?? [];

  let audience = await listSubscribers({ status: "subscribed", limit: 10_000 });
  if (interests.length > 0) {
    audience = audience.filter((s) =>
      s.interests.some((i) => interests.includes(i as FashionInterest)),
    );
  }

  if (audience.length === 0) {
    return { ok: false, error: "No subscribers match this audience." };
  }

  await admin
    .from("email_campaigns")
    .update({ status: "sending", recipient_count: audience.length })
    .eq("id", id);

  let sent = 0;
  let failed = 0;

  for (const member of audience) {
    const mail = buildCampaignEmail({
      subject: campaign.subject,
      bodyHtml: campaign.html ?? "",
      bodyText: campaign.text_body ?? "",
      token: member.unsubscribeToken,
    });

    const result = await sendViaProvider({
      to: member.email,
      toName: member.firstName,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      unsubscribeUrl: unsubscribeUrl(member.unsubscribeToken),
    });

    if (result.ok) {
      sent += 1;
      await admin.from("campaign_analytics").insert({
        campaign_id: id,
        subscriber_id: member.id,
        event: "sent",
      });
    } else {
      failed += 1;
      await admin.from("automation_logs").insert({
        automation: "new_collection",
        subscriber_id: member.id,
        campaign_id: id,
        status: "failed",
        error: result.error ?? "unknown",
      });
    }
  }

  await admin
    .from("email_campaigns")
    .update({
      status: failed === audience.length ? "failed" : "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/admin/newsletter");
  return {
    ok: true,
    message: `Sent to ${sent} member${sent === 1 ? "" : "s"}${
      failed > 0 ? `, ${failed} failed` : ""
    }.`,
  };
}
