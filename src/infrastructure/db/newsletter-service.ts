import "server-only";

import { createHash } from "node:crypto";

import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";

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
import {
  activeProvider,
  sendViaProvider,
} from "@/infrastructure/notifications/email-provider";
import {
  buildBirthdayEmail,
  buildCampaignEmail,
  buildWelcomeEmail,
  unsubscribeUrl,
} from "@/infrastructure/notifications/newsletter-emails";
import { db } from "./client";
import {
  automationLogs,
  campaignAnalytics,
  emailCampaigns,
  newsletterPreferences,
  newsletterSubscribers,
  subscriptionHistory,
} from "./schema";

/**
 * Data access + orchestration for the Privé Circle.
 *
 * Subscriber PII is only ever reachable from server code — there is no
 * browser-facing database API any more, which is what the RLS-with-no-policies
 * arrangement was standing in for.
 */

/** jsonb payloads. Replaces the generated `Json` type from the Supabase types. */
type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

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

type SubscriberRow = typeof newsletterSubscribers.$inferSelect;

function toSubscriber(
  r: SubscriberRow & { newsletterPreferences?: { interest: string }[] | null },
): Subscriber {
  return {
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    country: r.country,
    birthday: r.birthday,
    status: r.status as Subscriber["status"],
    source: r.source as SubscriberSource,
    interests: (r.newsletterPreferences ?? []).map(
      (p) => p.interest as FashionInterest,
    ),
    unsubscribeToken: r.unsubscribeToken,
    createdAt: r.createdAt,
    unsubscribedAt: r.unsubscribedAt,
    lastEmailedAt: r.lastEmailedAt,
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
    await db.insert(subscriptionHistory).values({
      subscriberId: entry.subscriberId,
      email: entry.email,
      action: entry.action,
      source: entry.source ?? null,
      ipHash: entry.ipHash ?? null,
      userAgent: entry.userAgent?.slice(0, 400) ?? null,
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
    await db.insert(automationLogs).values({
      automation: entry.automation,
      subscriberId: entry.subscriberId,
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
    const [row] = await db
      .select({ n: count() })
      .from(subscriptionHistory)
      .where(
        and(
          eq(subscriptionHistory.ipHash, ipHash),
          gte(subscriptionHistory.createdAt, since),
        ),
      );
    return (row?.n ?? 0) >= SIGNUP_RATE_LIMIT.max;
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

/** Matches the `newsletter_subscribers_email_key` unique index on lower(email),
 *  so the lookup is the one the index can actually serve. */
function byEmail(email: string) {
  return sql`lower(${newsletterSubscribers.email}) = ${email}`;
}

/**
 * Idempotent join. A repeat address never creates a second row: an active
 * member is reported back as `already`, and someone who had left is revived
 * as `resubscribed` with their new preferences.
 */
export async function subscribe(
  input: SubscribeInput,
): Promise<SubscribeOutcome> {
  const email = input.email.trim().toLowerCase();

  const existing = await db.query.newsletterSubscribers.findFirst({
    where: byEmail(email),
    with: { newsletterPreferences: { columns: { interest: true } } },
  });

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

  const now = new Date().toISOString();
  const patch = {
    email,
    firstName: input.firstName,
    lastName: input.lastName ?? null,
    country: input.country ?? null,
    birthday: input.birthday || null,
    status: "subscribed" as const,
    source: input.source,
    consent: true,
    consentAt: now,
    consentText: CONSENT_TEXT,
    ipHash: input.ipHash,
    userAgent: input.userAgent?.slice(0, 400) ?? null,
    unsubscribedAt: null,
    confirmedAt: now,
  };

  const [saved] = existing
    ? await db
        .update(newsletterSubscribers)
        .set(patch)
        .where(eq(newsletterSubscribers.id, existing.id))
        .returning()
    : await db.insert(newsletterSubscribers).values(patch).returning();

  if (!saved) throw new Error("Could not save your membership.");

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

  const subscriber = {
    ...toSubscriber(saved),
    interests: input.interests as FashionInterest[],
  };
  await sendWelcome(subscriber);

  return { kind, subscriber };
}

async function replaceInterests(
  subscriberId: string,
  interests: string[],
): Promise<void> {
  // One transaction: the delete and the insert are a single "set the
  // preferences to exactly this" operation. Split apart, a failure between them
  // leaves a member with no interests at all — silently unsubscribed from every
  // segment while still counted as a subscriber.
  await db.transaction(async (tx) => {
    await tx
      .delete(newsletterPreferences)
      .where(eq(newsletterPreferences.subscriberId, subscriberId));
    if (interests.length === 0) return;
    await tx
      .insert(newsletterPreferences)
      .values(interests.map((interest) => ({ subscriberId, interest })));
  });
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
      await db
        .update(newsletterSubscribers)
        .set({ lastEmailedAt: new Date().toISOString() })
        .where(eq(newsletterSubscribers.id, subscriber.id));
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
  const campaign = await db.query.emailCampaigns.findFirst({
    where: eq(emailCampaigns.id, id),
  });
  if (!campaign) {
    return { ok: false, sent: 0, failed: 0, error: "Campaign not found." };
  }
  if (campaign.status === "sending" || campaign.status === "sent") {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      error: "This campaign has already been sent.",
    };
  }

  const filter = (campaign.audienceFilter ?? {}) as { interests?: string[] };
  const interests = filter.interests ?? [];

  let audience = await listSubscribers({ status: "subscribed", limit: 10_000 });
  if (interests.length > 0) {
    audience = audience.filter((s) =>
      s.interests.some((i) => interests.includes(i as FashionInterest)),
    );
  }
  if (audience.length === 0) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      error: "No subscribers match this audience.",
    };
  }

  // Claim the campaign before sending anything. The conditional WHERE makes
  // this the point where a cron tick and a button press are decided: only one
  // of them moves the row off its current status, and the loser returns without
  // sending. The Supabase version updated unconditionally, so two concurrent
  // callers could both proceed and mail the list twice.
  const claimed = await db
    .update(emailCampaigns)
    .set({ status: "sending", recipientCount: audience.length })
    .where(
      and(
        eq(emailCampaigns.id, id),
        inArray(emailCampaigns.status, ["draft", "scheduled", "failed"]),
      ),
    )
    .returning({ id: emailCampaigns.id });

  if (claimed.length === 0) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      error: "This campaign has already been sent.",
    };
  }

  let sent = 0;
  let failed = 0;

  for (const member of audience) {
    const mail = buildCampaignEmail({
      subject: campaign.subject,
      bodyHtml: campaign.html ?? "",
      bodyText: campaign.textBody ?? "",
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
      await db
        .insert(campaignAnalytics)
        .values({ campaignId: id, subscriberId: member.id, event: "sent" });
    } else {
      failed += 1;
      await db.insert(automationLogs).values({
        automation: "new_collection",
        subscriberId: member.id,
        campaignId: id,
        provider: activeProvider(),
        status: "failed",
        error: result.error ?? "unknown",
      });
    }
  }

  await db
    .update(emailCampaigns)
    .set({
      status: failed === audience.length ? "failed" : "sent",
      sentAt: new Date().toISOString(),
    })
    .where(eq(emailCampaigns.id, id));

  return { ok: true, sent, failed };
}

/** Fire every campaign whose scheduled time has arrived. */
export async function runDueCampaigns(): Promise<{
  campaigns: number;
  sent: number;
  failed: number;
}> {
  const due = await db
    .select({ id: emailCampaigns.id })
    .from(emailCampaigns)
    .where(
      and(
        eq(emailCampaigns.status, "scheduled"),
        lte(emailCampaigns.scheduledAt, new Date().toISOString()),
      ),
    )
    .limit(10);

  let sent = 0;
  let failed = 0;
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
 * The month/day match now runs in SQL. The Supabase version pulled up to 20,000
 * subscriber rows and filtered them in JavaScript, with a comment explaining
 * that moving the match into the database would need an RPC the operator had to
 * install. It does not: `newsletter_subscribers_birthday_idx` — an expression
 * index on EXTRACT(month) and EXTRACT(day) — has been in the schema since the
 * newsletter migration and was never once used by a query. This uses it.
 */
export async function runBirthdayEmails(): Promise<{
  matched: number;
  sent: number;
  skipped: number;
}> {
  const today = new Date();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();

  const birthdayFolk = await db
    .select({
      id: newsletterSubscribers.id,
      email: newsletterSubscribers.email,
      firstName: newsletterSubscribers.firstName,
      unsubscribeToken: newsletterSubscribers.unsubscribeToken,
    })
    .from(newsletterSubscribers)
    .where(
      and(
        eq(newsletterSubscribers.status, "subscribed"),
        sql`${newsletterSubscribers.birthday} is not null`,
        sql`extract(month from ${newsletterSubscribers.birthday}) = ${month}`,
        sql`extract(day from ${newsletterSubscribers.birthday}) = ${day}`,
      ),
    )
    .limit(20_000);

  if (birthdayFolk.length === 0) return { matched: 0, sent: 0, skipped: 0 };

  // Anyone already wished this year is skipped, so a re-run is harmless.
  const yearAgo = new Date(Date.now() - 300 * 86_400_000).toISOString();
  const recent = await db
    .select({ subscriberId: automationLogs.subscriberId })
    .from(automationLogs)
    .where(
      and(
        eq(automationLogs.automation, "birthday"),
        eq(automationLogs.status, "sent"),
        gte(automationLogs.createdAt, yearAgo),
      ),
    );
  const alreadyWished = new Set(
    recent.map((r) => r.subscriberId).filter(Boolean),
  );

  let sent = 0;
  let skipped = 0;

  for (const person of birthdayFolk) {
    if (alreadyWished.has(person.id)) {
      skipped += 1;
      continue;
    }
    const mail = buildBirthdayEmail({
      firstName: person.firstName,
      token: person.unsubscribeToken,
    });
    const result = await sendViaProvider({
      to: person.email,
      toName: person.firstName,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      unsubscribeUrl: unsubscribeUrl(person.unsubscribeToken),
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
  const row = await db.query.newsletterSubscribers.findFirst({
    where: eq(newsletterSubscribers.unsubscribeToken, token),
    columns: { id: true, email: true },
  });
  if (!row) return false;

  await db
    .update(newsletterSubscribers)
    .set({
      status: "unsubscribed",
      unsubscribedAt: new Date().toISOString(),
    })
    .where(eq(newsletterSubscribers.id, row.id));

  await recordHistory({
    subscriberId: row.id,
    email: row.email,
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
  const filters = [];
  if (q.status) filters.push(eq(newsletterSubscribers.status, q.status));

  if (q.search?.trim()) {
    // The search term is a bound parameter now.
    //
    // PostgREST's `.or()` took a raw filter STRING, so the term was spliced
    // into query syntax rather than bound — which is why the old code had to
    // strip `,().:*"\%` by hand and explain that a search for
    // `x,status.eq.subscribed` would otherwise append a condition. None of that
    // applies here: the value can never be parsed as syntax. Only the LIKE
    // wildcards still need escaping, and only so the match means what was typed.
    const term = "%" + q.search.trim().replace(/[\\%_]/g, (c) => "\\" + c) + "%";
    filters.push(
      or(
        ilike(newsletterSubscribers.email, term),
        ilike(newsletterSubscribers.firstName, term),
        ilike(newsletterSubscribers.lastName, term),
        ilike(newsletterSubscribers.country, term),
      )!,
    );
  }

  const rows = await db.query.newsletterSubscribers.findMany({
    where: filters.length > 0 ? and(...filters) : undefined,
    with: { newsletterPreferences: { columns: { interest: true } } },
    orderBy: [desc(newsletterSubscribers.createdAt)],
    limit: q.limit ?? 500,
  });

  const subscribers = rows.map(toSubscriber);
  // Interest lives in a child table, so filter it after hydration rather than
  // forcing an inner join that would drop members with no preferences set.
  return q.interest
    ? subscribers.filter((r) =>
        r.interests.includes(q.interest as FashionInterest),
      )
    : subscribers;
}

export interface NewsletterStats {
  total: number;
  subscribed: number;
  unsubscribed: number;
  last30Days: number;
  byInterest: { interest: string; count: number }[];
}

export async function newsletterStats(): Promise<NewsletterStats> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  // Four head-count round trips collapse into one aggregate pass, and the
  // interest tally is grouped by Postgres instead of by reading every
  // preference row into a Map.
  const [[totals], byInterest] = await Promise.all([
    db
      .select({
        total: count(),
        subscribed: sql<number>`count(*) filter (where ${newsletterSubscribers.status} = 'subscribed')::int`,
        unsubscribed: sql<number>`count(*) filter (where ${newsletterSubscribers.status} = 'unsubscribed')::int`,
        last30Days: sql<number>`count(*) filter (where ${newsletterSubscribers.createdAt} >= ${since})::int`,
      })
      .from(newsletterSubscribers),
    db
      .select({
        interest: newsletterPreferences.interest,
        count: count(),
      })
      .from(newsletterPreferences)
      .groupBy(newsletterPreferences.interest)
      .orderBy(desc(count())),
  ]);

  return {
    total: totals?.total ?? 0,
    subscribed: totals?.subscribed ?? 0,
    unsubscribed: totals?.unsubscribed ?? 0,
    last30Days: totals?.last30Days ?? 0,
    byInterest,
  };
}

export async function listCampaigns(): Promise<Campaign[]> {
  const rows = await db
    .select()
    .from(emailCampaigns)
    .orderBy(desc(emailCampaigns.createdAt))
    .limit(100);

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    preheader: c.preheader,
    status: c.status as Campaign["status"],
    scheduledAt: c.scheduledAt,
    sentAt: c.sentAt,
    recipientCount: c.recipientCount,
    sentCount: c.sentCount,
    openCount: c.openCount,
    clickCount: c.clickCount,
    conversionCount: c.conversionCount,
    bounceCount: c.bounceCount,
    unsubscribeCount: c.unsubscribeCount,
    createdAt: c.createdAt,
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
    await db.insert(campaignAnalytics).values({
      campaignId: entry.campaignId,
      subscriberId: entry.subscriberId,
      event: entry.event,
      url: entry.url ?? null,
      userAgent: entry.userAgent?.slice(0, 400) ?? null,
      ipHash: entry.ipHash ?? null,
    });
  } catch {
    /* duplicate engagement or transient failure — nothing to do */
  }
}
