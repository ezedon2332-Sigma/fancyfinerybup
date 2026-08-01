import "server-only";
import { BRAND_FROM } from "@/lib/site";

/**
 * Pluggable marketing-email transport.
 *
 * Every supported provider is reachable over plain HTTPS, so there is no SDK
 * dependency and no build-time coupling: pick one with NEWSLETTER_PROVIDER and
 * supply its key. With nothing configured the transport no-ops and logs in dev
 * — exactly like the transactional `sendEmail` helper — so the whole newsletter
 * flow (signup, welcome, campaigns) works end to end before a provider exists.
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
}

export interface SendResult {
  ok: boolean;
  provider: EmailProvider | "none";
  id?: string;
  error?: string;
}

function fromAddress(): string {
  // Defaults to the house mailbox rather than no-reply@fancyfinery.com, which
  // was a domain the business does not own — mail from an unowned domain fails
  // SPF and DKIM and is dropped or filed as spam. EMAIL_FROM overrides this the
  // day a real sending domain exists.
  return process.env.EMAIL_FROM ?? BRAND_FROM;
}

function configured(): { provider: EmailProvider; key: string } | null {
  const name = (process.env.NEWSLETTER_PROVIDER ?? "resend") as EmailProvider;
  if (!EMAIL_PROVIDERS.includes(name)) return null;
  const key = process.env[KEY_ENV[name]];
  return key ? { provider: name, key } : null;
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
    const body = (await res.json().catch(() => ({}))) as { id?: string; MessageID?: string };
    return { ok: true, provider, id: body.id ?? body.MessageID };
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

const SENDERS: Record<EmailProvider, Sender> = {
  resend: (msg, key) =>
    post(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress(),
          to: [msg.to],
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
      console.info(`[newsletter:noop] → ${msg.to}: ${msg.subject}`);
    }
    return { ok: true, provider: "none" };
  }
  return SENDERS[cfg.provider](msg, cfg.key);
}

/** Which provider is live, for display in the admin dashboard. */
export function activeProvider(): EmailProvider | "none" {
  return configured()?.provider ?? "none";
}
