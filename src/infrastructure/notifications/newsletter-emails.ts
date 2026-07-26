import "server-only";

import { SITE_NAME, SITE_URL } from "@/lib/site";
import { interestLabel } from "@/domain/newsletter";

/** Black-and-gold HTML emails built with table layout and inline styles —
 *  the only combination Outlook, Gmail and Apple Mail all render alike. */

const GOLD = "#d4af37";
const INK = "#111111";

function shell(title: string, body: string, unsubscribeUrl: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${INK};color:#f5f5f5;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${INK};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0a0a0a;border:1px solid rgba(212,175,55,0.28);">
  <tr><td align="center" style="padding:40px 32px 8px;">
    <div style="font-size:13px;letter-spacing:6px;text-transform:uppercase;color:${GOLD};">${SITE_NAME}</div>
    <div style="margin-top:10px;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#8a8a8a;">Privé Circle</div>
  </td></tr>
  <tr><td style="padding:8px 32px 40px;">${body}</td></tr>
  <tr><td align="center" style="padding:24px 32px 36px;border-top:1px solid rgba(255,255,255,0.07);">
    <p style="margin:0;font-size:11px;line-height:1.7;color:#7d7d7d;font-family:Arial,Helvetica,sans-serif;">
      You are receiving this because you joined the ${SITE_NAME} Privé Circle.<br>
      <a href="${unsubscribeUrl}" style="color:${GOLD};text-decoration:underline;">Unsubscribe</a>
      &nbsp;·&nbsp;
      <a href="${SITE_URL}" style="color:${GOLD};text-decoration:underline;">Visit the house</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 8px;">
<tr><td align="center" style="background:${GOLD};">
<a href="${href}" style="display:inline-block;padding:15px 38px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#0a0a0a;text-decoration:none;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function unsubscribeUrl(token: string): string {
  return `${SITE_URL}/unsubscribe?token=${token}`;
}

export interface WelcomeEmail {
  subject: string;
  html: string;
  text: string;
}

/** The welcome email sent the moment someone joins the Privé Circle. */
export function buildWelcomeEmail(opts: {
  firstName: string;
  interests: string[];
  token: string;
}): WelcomeEmail {
  const url = unsubscribeUrl(opts.token);
  const name = escapeHtml(opts.firstName);
  const picks = opts.interests.map((i) => interestLabel(i));

  const interestBlock =
    picks.length > 0
      ? `<p style="margin:22px 0 0;font-size:12px;line-height:1.9;color:#9a9a9a;font-family:Arial,Helvetica,sans-serif;letter-spacing:1px;">
           CURATED FOR YOU: <span style="color:${GOLD};">${escapeHtml(picks.join(" · "))}</span>
         </p>`
      : "";

  const body = `
    <h1 style="margin:26px 0 0;font-size:27px;line-height:1.35;font-weight:normal;color:#ffffff;text-align:center;">
      Welcome to the ${SITE_NAME}<br><span style="color:${GOLD};">Privé Circle</span>
    </h1>
    <p style="margin:22px 0 0;font-size:15px;line-height:1.85;color:#c9c9c9;text-align:center;">
      ${name}, your journey into exclusive luxury begins now.
    </p>
    <p style="margin:20px 0 0;font-size:14px;line-height:1.9;color:#9d9d9d;text-align:center;font-family:Arial,Helvetica,sans-serif;">
      As a member you will receive early access to new collections, invitations to
      private sales, seasonal trend reports and offers reserved for our most
      valued members.
    </p>
    ${interestBlock}
    ${button(`${SITE_URL}/collections`, "Explore the collection")}
  `;

  const text = [
    `Welcome to the ${SITE_NAME} Privé Circle.`,
    "",
    `${opts.firstName}, your journey into exclusive luxury begins now.`,
    "",
    "You will receive early access to new collections, invitations to private",
    "sales, seasonal trend reports and offers reserved for our most valued members.",
    picks.length ? `\nCurated for you: ${picks.join(" · ")}` : "",
    "",
    `Explore the collection: ${SITE_URL}/collections`,
    "",
    `Unsubscribe: ${url}`,
  ].join("\n");

  return {
    subject: `Welcome to the ${SITE_NAME} Privé Circle`,
    html: shell("Welcome to the Privé Circle", body, url),
    text,
  };
}

/** Generic campaign wrapper — admin supplies the body, the house supplies the
 *  frame, so every send looks like it came from the same maison. */
export function buildCampaignEmail(opts: {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  token: string;
}): WelcomeEmail {
  const url = unsubscribeUrl(opts.token);
  const body = `<div style="font-size:15px;line-height:1.85;color:#c9c9c9;">${opts.bodyHtml}</div>`;
  return {
    subject: opts.subject,
    html: shell(opts.subject, body, url),
    text: `${opts.bodyText}\n\nUnsubscribe: ${url}`,
  };
}
