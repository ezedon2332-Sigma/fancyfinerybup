# Auth email templates

`confirm-signup.html` replaces the body of the account-confirmation email
Supabase sends when someone registers.

## Applying it

Supabase auth emails are configured in the dashboard, not in this repository —
nothing here is picked up automatically.

1. Supabase Dashboard → **Authentication** → **Emails** → **Confirm signup**
2. Set the subject to: `Confirm your Fancy Finery account`
3. Paste the whole of `confirm-signup.html` into the message body
4. Save, then register a test address and check the result

`{{ .ConfirmationURL }}` appears twice — on the button and as copyable text
underneath. Both must survive any edit or verification breaks. Everything else
is ordinary HTML and safe to change.

## The template does not change who the email is from

This is the part worth understanding before deciding the job is done.

A template controls the **body**. The sender name and address come from the
project's SMTP configuration. Until that is changed, the inbox line still reads
**Supabase Auth &lt;noreply@mail.app.supabase.io&gt;** no matter how the message
looks once opened — which is the first thing a customer sees and the last piece
of generic branding.

The house address is `fancyxquisite@gmail.com` — the mailbox that owns the admin
dashboard, defined once as `BRAND_EMAIL` in `src/lib/site.ts`.

### Route the auth emails through Resend

The app's own mail already goes through Resend. Supabase's auth mail does not —
it is sent by Supabase, from Supabase's servers, so no amount of application
code can move it. Point Supabase's SMTP at Resend and both halves finally leave
from the same place.

**Supabase → Project Settings → Authentication → SMTP Settings**

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` (implicit TLS) — or `587` for STARTTLS |
| Username | `resend` (literally that word, for every account) |
| Password | your `RESEND_API_KEY` |
| Sender name | `Fancy Finery` |
| Sender email | `orders@fancyfinerybup.com` |

Prerequisite: `fancyfinerybup.com` must be verified in **Resend → Domains**,
with the DKIM and SPF records it issues added to that domain's DNS. Until then
Resend rejects the send and confirmations silently stop arriving.

Keep the sender email identical to `EMAIL_FROM` in `.env`. One address, one
verified domain, one reputation to build — a customer sees the same sender
whether they are confirming an account or reading a receipt.

### Why not send as the gmail address

A mail service will only let you send **from** an address whose domain you can
prove you own, by adding DKIM and SPF records to its DNS. Nobody can add DNS
records to `gmail.com`. So Resend, SendGrid, Postmark and the rest all reject
`fancyxquisite@gmail.com` as a sender no matter what is typed into the box.

Gmail's own SMTP (`smtp.gmail.com` with a Google App Password) is the one server
entitled to send as it, and it was the interim answer before the house owned a
domain. It is no longer the right one: a free Gmail account caps out around
**500 recipients a day** and throttles bursts, and the address underneath still
reads `@gmail.com` where every house a customer compares you to writes from its
own domain.

That mailbox stays useful as the **reply** address — `EMAIL_REPLY_TO` — which
needs no verification, so a customer who hits Reply reaches a human.

Note either way that Supabase's built-in sender is intended for development and
is heavily rate limited, so leaving it in place risks confirmations silently
failing to arrive. That is exactly why `signUpAction` currently creates
already-confirmed accounts (see `src/app/signup/actions.ts`); once SMTP above is
live, the email-verification flow can be restored.

### What the code already does

- `EMAIL_PROVIDER` (default `resend`) picks the transport; `RESEND_API_KEY`
  activates it. See `src/infrastructure/notifications/email-provider.ts`.
- `EMAIL_FROM` sets the sender, defaulting to `orders@` on the site's own domain
  (`MAIL_FROM` in `src/lib/site.ts`).
- `EMAIL_REPLY_TO` sets Reply-To, defaulting to the house mailbox.
- Transactional sends carry an `Idempotency-Key`, so a retried invocation or a
  re-delivered webhook cannot send the same receipt twice within 24h.

## Other auth emails

Only **Confirm signup** has been rebranded. Supabase also sends **Magic Link**,
**Reset Password**, **Change Email Address** and **Invite User**, and those are
still the stock templates. They share this shell, so converting them is quick —
say the word.

## Editing notes

The markup is deliberately old-fashioned: tables, inline styles, no flexbox or
grid. Outlook renders through Word rather than a browser engine, so modern
layout silently collapses there.

- The button is doubled up — a VML `roundrect` for Outlook and a table cell for
  everyone else, inside `<!--[if mso]>` branches. Change the URL in **both**.
- The logo is an absolute `https://` URL. A relative path cannot resolve inside
  an inbox.
- The wordmark is live text rather than part of the image, so the brand still
  reads when a client blocks images — which most do until the reader allows them.
- Keep the file under ~100KB. Gmail clips messages past that and hides the
  bottom behind a "view entire message" link.
