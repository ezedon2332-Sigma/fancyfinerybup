import "server-only";
import { MAIL_FROM, MAIL_REPLY_TO } from "@/lib/site";

/**
 * Pluggable email transport. Resend is the house provider; the others are kept
 * as drop-in escape hatches.
 *
 * Every supported provider is reachable over plain HTTPS, so there is no SDK
 * dependency and no build-time coupling: pick one with EMAIL_PROVIDER and
 * supply its key. With nothing configured the transport no-ops and logs in dev
 * — so the whole newsletter flow (signup, welcome, campaigns) works end to end
 * before a provider exists. In production a missing key is logged as an error
 * rather than passing silently, because that is how a store discovers weeks
 * later that no customer ever got a receipt.
 *
 * Adding a provider means adding one entry to SENDERS. Nothing else changes.
 */

export const EMAIL_PROVIDERS = [
  "resend",
  "mailchimp",
  "klaviyo",
  "brevo",
  "mailgun",
  "ses",
  "postmark",
  "convertkit",
] as const;

export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

export interface MarketingEmail {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
  /** Surfaced as List-Unsubscribe so inbox providers show a native control. */
  unsubscribeUrl?: string;
  /** Override the Reply-To; defaults to the house mailbox. */
  replyTo?: string;
  /**
   * Stable key identifying the *thing being said*, e.g.
   * `payment-received:<orderId>`. Resend collapses repeat sends of the same key
   * for 24h, so a retried serverless invocation or a re-delivered webhook can't
   * email the customer the same receipt twice.
   */
  idempotencyKey?: string;
}

export interface SendResult {
  ok: boolean;
  provider: EmailProvider | "none";
  id?: string;
  error?: string;
}

function fromAddress(): string {
  // Must be an address on a domain verified with the provider — see MAIL_FROM
  // for why this is not the gmail house mailbox.
  return process.env.EMAIL_FROM?.trim() || MAIL_FROM;
}

function replyToAddress(msg: MarketingEmail): string {
  return msg.replyTo?.trim() || process.env.EMAIL_REPLY_TO?.trim() || MAIL_REPLY_TO;
}

/**
 * Resolve the live provider. EMAIL_PROVIDER is the current name;
 * NEWSLETTER_PROVIDER is still honoured so existing deployments keep working.
 */
function configured(): { provider: EmailProvider; key: string } | null {
  const raw = (
    process.env.EMAIL_PROVIDER ??
    process.env.NEWSLETTER_PROVIDER ??
    "resend"
  )
    .trim()
    .toLowerCase() as EmailProvider;
  if (!EMAIL_PROVIDERS.includes(raw)) return null;
  const key = process.env[KEY_ENV[raw]]?.trim();
  return key ? { provider: raw, key } : null;
}

const KEY_ENV: Record<EmailProvider, string> = {
  resend: "RESEND_API_KEY",
  mailchimp: "MAILCHIMP_API_KEY",
  klaviyo: "KLAVIYO_API_KEY",
  brevo: "BREVO_API_KEY",
  mailgun: "MAILGUN_API_KEY",
  ses: "AWS_SES_ACCESS_KEY",
  postmark: "POSTMARK_SERVER_TOKEN",
  convertkit: "CONVERTKIT_API_KEY",
};

type Sender = (msg: MarketingEmail, key: string) => Promise<SendResult>;

async function post(
  url: string,
  init: RequestInit,
  provider: EmailProvider,
): Promise<SendResult> {
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });
    if (!res.ok) {
      return { ok: false, provider, error: `${res.status} ${await res.text()}` };
    }
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      MessageID?: string;
      data?: { id?: string };
    };
    return { ok: true, provider, id: body.id ?? body.data?.id ?? body.MessageID };
  } catch (e) {
    return { ok: false, provider, error: (e as Error).message };
  }
}

function unsubscribeHeaders(msg: MarketingEmail): Record<string, string> {
  if (!msg.unsubscribeUrl) return {};
  return {
    "List-Unsubscribe": `<${msg.unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * Resend caps the Idempotency-Key at 256 chars and only accepts a single
 * header line, so keep the key to safe ASCII and truncate rather than let the
 * whole send 422 on a stray character.
 */
function idempotencyHeader(msg: MarketingEmail): Record<string, string> {
  if (!msg.idempotencyKey) return {};
  const key = msg.idempotencyKey
    .replace(/[^a-zA-Z0-9:_.@-]/g, "-")
    .slice(0, 256);
  return key ? { "Idempotency-Key": key } : {};
}

const SENDERS: Record<EmailProvider, Sender> = {
  // The house provider. Plain REST — the JSON body is snake_case (`reply_to`),
  // unlike the Node SDK's camelCase, which is the usual thing to get wrong here.
  resend: (msg, key) =>
    post(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          ...idempotencyHeader(msg),
        },
        body: JSON.stringify({
          from: fromAddress(),
          to: [msg.to],
          reply_to: replyToAddress(msg),
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          headers: unsubscribeHeaders(msg),
        }),
      },
      "resend",
    ),

  postmark: (msg, key) =>
    post(
      "https://api.postmarkapp.com/email",
      {
        method: "POST",
        headers: {
          "X-Postmark-Server-Token": key,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          From: fromAddress(),
          To: msg.to,
          Subject: msg.subject,
          HtmlBody: msg.html,
          TextBody: msg.text,
          MessageStream: process.env.POSTMARK_STREAM ?? "broadcast",
        }),
      },
      "postmark",
    ),

  brevo: (msg, key) =>
    post(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: { "api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { email: senderEmail(), name: "Fancy Finery" },
          to: [{ email: msg.to, name: msg.toName ?? undefined }],
          subject: msg.subject,
          htmlContent: msg.html,
          textContent: msg.text,
          headers: unsubscribeHeaders(msg),
        }),
      },
      "brevo",
    ),

  mailgun: (msg, key) => {
    const domain = process.env.MAILGUN_DOMAIN ?? "";
    const form = new URLSearchParams({
      from: fromAddress(),
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    if (msg.unsubscribeUrl) form.set("h:List-Unsubscribe", `<${msg.unsubscribeUrl}>`);
    return post(
      `https://api.mailgun.net/v3/${domain}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${key}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
      "mailgun",
    );
  },

  klaviyo: (msg, key) =>
    post(
      "https://a.klaviyo.com/api/events",
      {
        method: "POST",
        headers: {
          Authorization: `Klaviyo-API-Key ${key}`,
          revision: process.env.KLAVIYO_REVISION ?? "2024-10-15",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            type: "event",
            attributes: {
              properties: { subject: msg.subject, html: msg.html },
              metric: { data: { type: "metric", attributes: { name: msg.subject } } },
              profile: {
                data: {
                  type: "profile",
                  attributes: { email: msg.to, first_name: msg.toName ?? undefined },
                },
              },
            },
          },
        }),
      },
      "klaviyo",
    ),

  mailchimp: (msg, key) =>
    post(
      "https://mandrillapp.com/api/1.0/messages/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          message: {
            from_email: senderEmail(),
            from_name: "Fancy Finery",
            to: [{ email: msg.to, name: msg.toName ?? undefined, type: "to" }],
            subject: msg.subject,
            html: msg.html,
            text: msg.text,
            headers: unsubscribeHeaders(msg),
          },
        }),
      },
      "mailchimp",
    ),

  convertkit: (msg, key) =>
    post(
      "https://api.convertkit.com/v3/broadcasts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_secret: key,
          subject: msg.subject,
          content: msg.html,
          email_address: msg.to,
        }),
      },
      "convertkit",
    ),

  // SES's SigV4 signing needs the AWS SDK; wire it up when SES is chosen and
  // fail loudly rather than silently dropping mail.
  ses: async () => ({
    ok: false,
    provider: "ses" as const,
    error:
      "SES requires SigV4 signing — install @aws-sdk/client-sesv2 and complete " +
      "the sender in email-provider.ts.",
  }),
};

function senderEmail(): string {
  const m = /<([^>]+)>/.exec(fromAddress());
  return m ? m[1] : fromAddress();
}

/** Send one email through the configured provider. Backs both transactional
 *  mail (order confirmations) and marketing mail (the Privé Circle). Never
 *  throws — callers log the result rather than failing the user's request. */
export async function sendViaProvider(
  msg: MarketingEmail,
): Promise<SendResult> {
  const cfg = configured();
  if (!cfg) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email:noop] → ${msg.to}: ${msg.subject}`);
      // Dev keeps the optimistic result so the newsletter and checkout flows
      // stay exercisable end to end without a provider key.
      return { ok: true, provider: "none" };
    }
    // Production tells the truth: nothing was delivered. Reporting success here
    // is what lets "sent" pile up in automation_logs while inboxes stay empty.
    console.error(
      `[email] no provider configured — dropped "${msg.subject}" to ${msg.to}. ` +
        `Set RESEND_API_KEY (and EMAIL_FROM) in the environment.`,
    );
    return { ok: false, provider: "none", error: "No email provider configured." };
  }
  return SENDERS[cfg.provider](msg, cfg.key);
}

/** Which provider is live, for display in the admin dashboard. */
export function activeProvider(): EmailProvider | "none" {
  return configured()?.provider ?? "none";
}
