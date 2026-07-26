import "server-only";

import { createHash } from "node:crypto";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import type { Json, SubscriberStatus } from "@/infrastructure/supabase/database.types";
import {
  CONSENT_TEXT,
  SIGNUP_RATE_LIMIT,
  type Automation,
  type Campaign,
  type FashionInterest,
  type Subscriber,
  type SubscriberSource,
  type SubscriptionAction,
} from "@/domain/newsletter";
import { activeProvider, sendViaProvider } from "@/infrastructure/notifications/email-provider";
import {
  buildBirthdayEmail,
  buildCampaignEmail,
  buildWelcomeEmail,
  unsubscribeUrl,
} from "@/infrastructure/notifications/newsletter-emails";

/**
 * Data access + orchestration for the Privé Circle.
 *
 * Everything runs through the service-role client because the newsletter
 * tables have RLS on with no public policies — subscriber PII must never be
 * reachable from the browser.
 */

let warnedAboutSalt = false;

/** IPs are hashed before storage: enough to rate-limit and audit, but not a
 *  plaintext record of who signed up from where.
 *
 *  The salt must be secret. An IPv4 space is small enough to brute-force in
 *  seconds, so an unsalted — or publicly-known — hash is reversible and the
 *  column stops being pseudonymous. Falls back so local dev works, but says so
 *  loudly once in production. */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.IP_HASH_SALT;
  if (!salt && !warnedAboutSalt) {
    warnedAboutSalt = true;
    console.warn(
      "[newsletter] IP_HASH_SALT is not set — signup IP hashes are reversible. " +
        "Set it in the environment.",
    );
  }
  return createHash("sha256")
    .update(`${salt ?? "fancy-finery-dev"}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

interface SubscriberRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  country: string | null;
  birthday: string | null;
  status: Subscriber["status"];
  source: SubscriberSource;
  unsubscribe_token: string;
  created_at: string;
  unsubscribed_at: string | null;
  last_emailed_at: string | null;
  newsletter_preferences?: { interest: string }[] | null;
}

function toSubscriber(r: SubscriberRow): Subscriber {
  return {
    id: r.id,
    email: r.email,
    firstName: r.first_name,
    lastName: r.last_name,
    country: r.country,
    birthday: r.birthday,
    status: r.status,
    source: r.source,
    interests: (r.newsletter_preferences ?? []).map(
      (p) => p.interest as FashionInterest,
    ),
    unsubscribeToken: r.unsubscribe_token,
    createdAt: r.created_at,
    unsubscribedAt: r.unsubscribed_at,
    lastEmailedAt: r.last_emailed_at,
  };
}

/** Append-only audit trail. Best-effort: never blocks the caller. */
export async function recordHistory(entry: {
  subscriberId: string | null;
  email: string;
  action: SubscriptionAction;
  source?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  meta?: Json;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("subscription_history").insert({
      subscriber_id: entry.subscriberId,
      email: entry.email,
      action: entry.action,
      source: entry.source ?? null,
      ip_hash: entry.ipHash ?? null,
      user_agent: entry.userAgent?.slice(0, 400) ?? null,
      meta: entry.meta ?? {},
    });
  } catch {
    /* auditing must never break a signup */
  }
}

async function logAutomation(entry: {
  automation: Automation;
  subscriberId: string | null;
  status: "sent" | "failed" | "skipped";
  error?: string;
  payload?: Json;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("automation_logs").insert({
      automation: entry.automation,
      subscriber_id: entry.subscriberId,
      provider: activeProvider(),
      status: entry.status,
      error: entry.error ?? null,
      payload: entry.payload ?? {},
    });
  } catch {
    /* logging must never break a send */
  }
}

/** True when this IP has exceeded the signup allowance for the window. */
export async function isRateLimited(ipHash: string | null): Promise<boolean> {
  if (!ipHash) return false;
  const since = new Date(
    Date.now() - SIGNUP_RATE_LIMIT.windowMinutes * 60_000,
  ).toISOString();
  try {
    const admin = createSupabaseAdminClient();
    const { count } = await admin
      .from("subscription_history")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    return (count ?? 0) >= SIGNUP_RATE_LIMIT.max;
  } catch {
    return false; // fail open — a rate-limit outage must not block signups
  }
}

export interface SubscribeInput {
  email: string;
  firstName: string;
  lastName?: string | null;
  country?: string | null;
  birthday?: string | null;
  interests: string[];
  source: SubscriberSource;
  ipHash: string | null;
  userAgent: string | null;
}

export type SubscribeOutcome =
  | { kind: "created"; subscriber: Subscriber }
  | { kind: "resubscribed"; subscriber: Subscriber }
  | { kind: "already"; subscriber: Subscriber };

/**
 * Idempotent join. A repeat address never creates a second row: an active
 * member is reported back as `already`, and someone who had left is revived
 * as `resubscribed` with their new preferences.
 */
export async function subscribe(
  input: SubscribeInput,
): Promise<SubscribeOutcome> {
  const admin = createSupabaseAdminClient();
  const email = input.email.trim().toLowerCase();

  const { data: existingRow } = await admin
    .from("newsletter_subscribers")
    .select("*, newsletter_preferences(interest)")
    .ilike("email", email)
    .maybeSingle();

  const existing = existingRow as SubscriberRow | null;

  if (existing && existing.status === "subscribed") {
    await replaceInterests(existing.id, input.interests);
    await recordHistory({
      subscriberId: existing.id,
      email,
      action: "preferences_updated",
      source: input.source,
      ipHash: input.ipHash,
      userAgent: input.userAgent,
    });
    return { kind: "already", subscriber: toSubscriber(existing) };
  }

  const patch = {
    email,
    first_name: input.firstName,
    last_name: input.lastName ?? null,
    country: input.country ?? null,
    birthday: input.birthday || null,
    status: "subscribed" as const,
    source: input.source,
    consent: true,
    consent_at: new Date().toISOString(),
    consent_text: CONSENT_TEXT,
    ip_hash: input.ipHash,
    user_agent: input.userAgent?.slice(0, 400) ?? null,
    unsubscribed_at: null,
    confirmed_at: new Date().toISOString(),
  };

  const { data: savedRow, error } = existing
    ? await admin
        .from("newsletter_subscribers")
        .update(patch)
        .eq("id", existing.id)
        .select("*, newsletter_preferences(interest)")
        .single()
    : await admin
        .from("newsletter_subscribers")
        .insert(patch)
        .select("*, newsletter_preferences(interest)")
        .single();

  if (error || !savedRow) {
    throw new Error(error?.message ?? "Could not save your membership.");
  }

  const saved = savedRow as SubscriberRow;
  await replaceInterests(saved.id, input.interests);

  const kind = existing ? "resubscribed" : "created";
  await recordHistory({
    subscriberId: saved.id,
    email,
    action: existing ? "resubscribed" : "subscribed",
    source: input.source,
    ipHash: input.ipHash,
    userAgent: input.userAgent,
    meta: { interests: input.interests },
  });

  const subscriber = { ...toSubscriber(saved), interests: input.interests as FashionInterest[] };
  await sendWelcome(subscriber);

  return { kind, subscriber };
}

async function replaceInterests(
  subscriberId: string,
  interests: string[],
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from("newsletter_preferences")
    .delete()
    .eq("subscriber_id", subscriberId);
  if (interests.length === 0) return;
  await admin.from("newsletter_preferences").insert(
    interests.map((interest) => ({ subscriber_id: subscriberId, interest })),
  );
}

/** Fire the welcome email. Best-effort — a provider outage must not make the
 *  member think their join failed. */
async function sendWelcome(subscriber: Subscriber): Promise<void> {
  const mail = buildWelcomeEmail({
    firstName: subscriber.firstName,
    interests: subscriber.interests,
    token: subscriber.unsubscribeToken,
  });
  const result = await sendViaProvider({
    to: subscriber.email,
    toName: subscriber.firstName,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    unsubscribeUrl: unsubscribeUrl(subscriber.unsubscribeToken),
  });

  await logAutomation({
    automation: "welcome",
    subscriberId: subscriber.id,
    status: result.ok ? "sent" : "failed",
    error: result.error,
  });

  if (result.ok) {
    try {
      const admin = createSupabaseAdminClient();
      await admin
        .from("newsletter_subscribers")
        .update({ last_emailed_at: new Date().toISOString() })
        .eq("id", subscriber.id);
    } catch {
      /* non-critical */
    }
  }
}

export interface DispatchResult {
  ok: boolean;
  sent: number;
  failed: number;
  error?: string;
}

/**
 * Send one campaign to everyone matching its audience filter.
 *
 * Shared by the admin "Send now" button and the cron that fires scheduled
 * campaigns, so both take exactly the same path. Refuses to run twice: the
 * status is flipped to `sending` up front, which is also what makes a
 * concurrent cron tick and a button press safe together.
 *
 * Sends inline, one message at a time. Fine for a few thousand members; past
 * that this wants a queue so it is not bound by request timeouts.
 */
export async function dispatchCampaign(id: string): Promise<DispatchResult> {
  const admin = createSupabaseAdminClient();

  const { data: campaign } = await admin
    .from("email_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return { ok: false, sent: 0, failed: 0, error: "Campaign not found." };
  if (campaign.status === "sending" || campaign.status === "sent") {
    return { ok: false, sent: 0, failed: 0, error: "This campaign has already been sent." };
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
    return { ok: false, sent: 0, failed: 0, error: "No subscribers match this audience." };
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
      await admin
        .from("campaign_analytics")
        .insert({ campaign_id: id, subscriber_id: member.id, event: "sent" });
    } else {
      failed += 1;
      await admin.from("automation_logs").insert({
        automation: "new_collection",
        subscriber_id: member.id,
        campaign_id: id,
        provider: activeProvider(),
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

  return { ok: true, sent, failed };
}

/** Fire every campaign whose scheduled time has arrived. */
export async function runDueCampaigns(): Promise<{
  campaigns: number;
  sent: number;
  failed: number;
}> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("email_campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .limit(10);

  let sent = 0;
  let failed = 0;
  const due = data ?? [];
  for (const c of due) {
    const r = await dispatchCampaign(c.id);
    sent += r.sent;
    failed += r.failed;
  }
  return { campaigns: due.length, sent, failed };
}

/**
 * Birthday wishes for members whose birthday is today (UTC).
 *
 * Month/day matching happens in memory rather than in SQL, so this does not
 * need a database function the operator would have to install separately. It
 * reads every member with a birthday on file — fine into the low tens of
 * thousands; past that, move the match into an RPC and the expression index
 * from the migration starts earning its keep.
 */
export async function runBirthdayEmails(): Promise<{
  matched: number;
  sent: number;
  skipped: number;
}> {
  const admin = createSupabaseAdminClient();
  const today = new Date();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();

  const { data } = await admin
    .from("newsletter_subscribers")
    .select("id, email, first_name, birthday, unsubscribe_token")
    .eq("status", "subscribed")
    .not("birthday", "is", null)
    .limit(20_000);

  const birthdayFolk = (data ?? []).filter((s) => {
    if (!s.birthday) return false;
    // Parsed as UTC parts, not via Date, so a local timezone cannot shift the day.
    const [, m, d] = s.birthday.split("-").map(Number);
    return m === month && d === day;
  });

  if (birthdayFolk.length === 0) return { matched: 0, sent: 0, skipped: 0 };

  // Anyone already wished this year is skipped, so a re-run is harmless.
  const yearAgo = new Date(Date.now() - 300 * 86_400_000).toISOString();
  const { data: recent } = await admin
    .from("automation_logs")
    .select("subscriber_id")
    .eq("automation", "birthday")
    .eq("status", "sent")
    .gte("created_at", yearAgo);
  const alreadyWished = new Set(
    (recent ?? []).map((r) => r.subscriber_id).filter(Boolean),
  );

  let sent = 0;
  let skipped = 0;

  for (const person of birthdayFolk) {
    if (alreadyWished.has(person.id)) {
      skipped += 1;
      continue;
    }
    const mail = buildBirthdayEmail({
      firstName: person.first_name,
      token: person.unsubscribe_token,
    });
    const result = await sendViaProvider({
      to: person.email,
      toName: person.first_name,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      unsubscribeUrl: unsubscribeUrl(person.unsubscribe_token),
    });
    if (result.ok) sent += 1;
    await logAutomation({
      automation: "birthday",
      subscriberId: person.id,
      status: result.ok ? "sent" : "failed",
      error: result.error,
    });
  }

  return { matched: birthdayFolk.length, sent, skipped };
}

/** One-click unsubscribe by token. Returns false for an unknown token. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("newsletter_subscribers")
    .select("id, email")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  if (!data) return false;

  await admin
    .from("newsletter_subscribers")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("id", data.id);

  await recordHistory({
    subscriberId: data.id,
    email: data.email,
    action: "unsubscribed",
    source: "email_link",
  });
  return true;
}

export interface SubscriberQuery {
  search?: string;
  status?: string;
  interest?: string;
  limit?: number;
}

/** Admin listing with search + filters. */
export async function listSubscribers(
  q: SubscriberQuery = {},
): Promise<Subscriber[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("newsletter_subscribers")
    .select("*, newsletter_preferences(interest)")
    .order("created_at", { ascending: false })
    .limit(q.limit ?? 500);

  if (q.status) query = query.eq("status", q.status as SubscriberStatus);
  if (q.search) {
    const term = `%${q.search.trim()}%`;
    query = query.or(
      `email.ilike.${term},first_name.ilike.${term},last_name.ilike.${term},country.ilike.${term}`,
    );
  }

  const { data } = await query;
  const rows = ((data ?? []) as SubscriberRow[]).map(toSubscriber);
  // Interest lives in a child table, so filter it after hydration rather than
  // forcing an inner join that would drop members with no preferences set.
  return q.interest
    ? rows.filter((r) => r.interests.includes(q.interest as FashionInterest))
    : rows;
}

export interface NewsletterStats {
  total: number;
  subscribed: number;
  unsubscribed: number;
  last30Days: number;
  byInterest: { interest: string; count: number }[];
}

export async function newsletterStats(): Promise<NewsletterStats> {
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [total, subscribed, unsubscribed, recent, prefs] = await Promise.all([
    admin.from("newsletter_subscribers").select("id", { count: "exact", head: true }),
    admin
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .eq("status", "subscribed"),
    admin
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .eq("status", "unsubscribed"),
    admin
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    admin.from("newsletter_preferences").select("interest"),
  ]);

  const counts = new Map<string, number>();
  for (const row of (prefs.data ?? []) as { interest: string }[]) {
    counts.set(row.interest, (counts.get(row.interest) ?? 0) + 1);
  }

  return {
    total: total.count ?? 0,
    subscribed: subscribed.count ?? 0,
    unsubscribed: unsubscribed.count ?? 0,
    last30Days: recent.count ?? 0,
    byInterest: [...counts.entries()]
      .map(([interest, count]) => ({ interest, count }))
      .sort((a, b) => b.count - a.count),
  };
}

interface CampaignRow {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  status: Campaign["status"];
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number;
  sent_count: number;
  open_count: number;
  click_count: number;
  conversion_count: number;
  bounce_count: number;
  unsubscribe_count: number;
  created_at: string;
}

export async function listCampaigns(): Promise<Campaign[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("email_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return ((data ?? []) as CampaignRow[]).map((c) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    preheader: c.preheader,
    status: c.status,
    scheduledAt: c.scheduled_at,
    sentAt: c.sent_at,
    recipientCount: c.recipient_count,
    sentCount: c.sent_count,
    openCount: c.open_count,
    clickCount: c.click_count,
    conversionCount: c.conversion_count,
    bounceCount: c.bounce_count,
    unsubscribeCount: c.unsubscribe_count,
    createdAt: c.created_at,
  }));
}

/** Record an engagement event. The unique index means repeat opens from the
 *  same member collapse into one row, keeping unique-rate maths honest. */
export async function recordCampaignEvent(entry: {
  campaignId: string;
  subscriberId: string | null;
  event: string;
  url?: string | null;
  userAgent?: string | null;
  ipHash?: string | null;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("campaign_analytics").insert({
      campaign_id: entry.campaignId,
      subscriber_id: entry.subscriberId,
      event: entry.event,
      url: entry.url ?? null,
      user_agent: entry.userAgent?.slice(0, 400) ?? null,
      ip_hash: entry.ipHash ?? null,
    });
  } catch {
    /* duplicate engagement or transient failure — nothing to do */
  }
}
