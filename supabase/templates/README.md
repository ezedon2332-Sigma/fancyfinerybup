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

Fixing it means pointing Supabase at your own SMTP:

- Dashboard → **Project Settings** → **Authentication** → **SMTP Settings**
- Enable custom SMTP, set **Sender name** to `Fancy Finery` and **Sender email**
  to an address on a domain you control

There is a second reason to do this regardless of branding: Supabase's built-in
email sender is intended for development and is rate limited, so a busy signup
day can silently stop delivering confirmations.

This codebase already speaks Resend (`src/infrastructure/notifications/email-provider.ts`,
keyed on `RESEND_API_KEY`), and Resend publishes SMTP credentials alongside its
API — so the same account can serve both the newsletter and Supabase auth. No
mail provider is configured in `.env` yet, so that key needs setting either way.

Whichever provider you use, authenticate the sending domain (SPF, DKIM and
ideally DMARC) or a well-branded confirmation email will still land in spam.

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
