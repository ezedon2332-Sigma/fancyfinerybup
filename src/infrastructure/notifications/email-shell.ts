import "server-only";

import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * The house email style — one shell for every message the store sends.
 *
 * This markup existed already but was private to newsletter-emails.ts, so the
 * campaign mail was black-and-gold and branded while order confirmations,
 * payment receipts and every auth email went out as bare plain text. A customer
 * who bought something got a worse-looking email than one who joined a mailing
 * list. Extracting it here makes the brand the default rather than the
 * exception.
 *
 * Constraints that dictate the markup, none of them stylistic preference:
 *
 *  - **Tables and inline styles.** Gmail strips <style> blocks, Outlook renders
 *    with Word's engine and ignores most modern CSS. Nested tables with inline
 *    attributes is the only layout all three render alike.
 *  - **Absolute, publicly reachable image URLs.** An email has no origin to
 *    resolve "/logo.png" against, and the reader's mail client fetches it from
 *    wherever they are — so assets come from EMAIL_ASSET_BASE_URL, never from
 *    whatever host the sending process happens to be on.
 *  - **A text alternative alongside every HTML body.** Some clients show only
 *    text, and a message with no text part scores as spam.
 */

export const GOLD = "#d4af37";
export const INK = "#111111";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The brand mark.
 *
 * Built from EMAIL_ASSET_BASE_URL, **not** SITE_URL, and that distinction is
 * the whole point. SITE_URL is `http://localhost:3000` in development, so every
 * email sent from a developer machine — including the ones sent to real
 * addresses while testing — carried an image no mail client on earth could
 * fetch. The logo silently failed to render and the message looked broken.
 *
 * An email asset has to live at a publicly reachable, stable URL regardless of
 * where the process sending it happens to be running. Falls back to SITE_URL so
 * a deployment that never sets it still works in production, where the two are
 * the same thing anyway.
 */
export function emailAssetBase(): string {
  return (process.env.EMAIL_ASSET_BASE_URL || SITE_URL).replace(/\/$/, "");
}

export function logoUrl(): string {
  return `${emailAssetBase()}/logo.png`;
}

export interface ShellOptions {
  /** Small caps line under the wordmark, e.g. "Order Confirmation". */
  kicker?: string;
  /** Present only on marketing mail — a receipt must never offer to opt out. */
  unsubscribeUrl?: string;
}

export function shell(
  title: string,
  body: string,
  opts: ShellOptions = {},
): string {
  const kicker = opts.kicker
    ? `<div style="margin-top:10px;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#8a8a8a;">${escapeHtml(opts.kicker)}</div>`
    : "";

  const footer = opts.unsubscribeUrl
    ? `You are receiving this because you joined the ${SITE_NAME} Privé Circle.<br>
       <a href="${opts.unsubscribeUrl}" style="color:${GOLD};text-decoration:underline;">Unsubscribe</a>
       &nbsp;·&nbsp;
       <a href="${SITE_URL}" style="color:${GOLD};text-decoration:underline;">Visit the house</a>`
    : `<a href="${SITE_URL}" style="color:${GOLD};text-decoration:underline;">${SITE_NAME}</a>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${INK};color:#f5f5f5;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${INK};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0a0a0a;border:1px solid rgba(212,175,55,0.28);">
  <tr><td align="center" style="padding:36px 32px 8px;">
    <!-- Many clients block remote images until the reader allows them, so the
         gold wordmark below is the real brand signal and the mark is an
         enhancement. alt text carries the name either way. -->
    <img src="${logoUrl()}" width="56" height="56" alt="${escapeHtml(SITE_NAME)}"
         style="display:block;border:0;outline:none;text-decoration:none;margin:0 auto 14px;max-width:56px;">
    <div style="font-size:13px;letter-spacing:6px;text-transform:uppercase;color:${GOLD};">${escapeHtml(SITE_NAME)}</div>
    ${kicker}
  </td></tr>
  <tr><td style="padding:8px 32px 40px;">${body}</td></tr>
  <tr><td align="center" style="padding:24px 32px 36px;border-top:1px solid rgba(255,255,255,0.07);">
    <p style="margin:0;font-size:11px;line-height:1.7;color:#7d7d7d;font-family:Arial,Helvetica,sans-serif;">
      ${footer}
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** Headline inside the body. */
export function heading(text: string): string {
  return `<h1 style="margin:0 0 18px;font-size:24px;font-weight:400;letter-spacing:1px;color:#f5f5f5;">${escapeHtml(text)}</h1>`;
}

/** Body paragraph. */
export function paragraph(html: string): string {
  return `<p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#cfcfcf;">${html}</p>`;
}

/**
 * Call-to-action. A table rather than a styled <a> because Outlook will not
 * apply padding to an inline element, which collapses the button to bare text.
 */
export function button(href: string, label: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0;">
  <tr><td align="center" bgcolor="${GOLD}" style="background:${GOLD};">
    <a href="${href}" style="display:inline-block;padding:15px 38px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#0a0a0a;text-decoration:none;">${escapeHtml(label)}</a>
  </td></tr>
</table>`;
}

/** A link spelled out, for clients that strip buttons. */
export function fallbackLink(href: string): string {
  return `<p style="margin:22px 0 0;font-size:12px;line-height:1.8;color:#7d7d7d;font-family:Arial,Helvetica,sans-serif;">
    If the button does not work, paste this into your browser:<br>
    <span style="word-break:break-all;color:#9a9a9a;">${escapeHtml(href)}</span>
  </p>`;
}

/** Key/value rows — order totals, tracking details. */
export function detailRows(rows: [string, string][]): string {
  const body = rows
    .map(
      ([k, v]) => `<tr>
      <td style="padding:7px 0;font-size:13px;color:#9a9a9a;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(k)}</td>
      <td align="right" style="padding:7px 0;font-size:13px;color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(v)}</td>
    </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="margin:22px 0;border-top:1px solid rgba(255,255,255,0.09);border-bottom:1px solid rgba(255,255,255,0.09);">
    ${body}
  </table>`;
}
