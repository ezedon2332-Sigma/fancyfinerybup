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

### Sending as that address

Only one route actually works, and it is worth understanding why before trying
the other.

A mail service will only let you send **from** an address whose domain you can
prove you own, by adding DKIM and SPF records to its DNS. Nobody can add DNS
records to `gmail.com`. So Resend, SendGrid, Postmark and the rest will all
reject `fancyxquisite@gmail.com` as a sender no matter what is typed into the
box. The one server entitled to send as that address is Google's own.

**Supabase → Project Settings → Authentication → SMTP Settings**

| Field | Value |
| --- | --- |
| Host | `smtp.gmail.com` |
| Port | `465` (SSL) — or `587` for STARTTLS |
| Username | `fancyxquisite@gmail.com` |
| Password | a Google **App Password**, not the account password |
| Sender name | `Fancy Finery` |
| Sender email | `fancyxquisite@gmail.com` |

An App Password is generated at Google Account → Security → 2-Step Verification
→ App passwords, and 2-Step Verification has to be switched on first. A normal
password will be refused.

Two limits to know about rather than discover:

- A free Gmail account allows roughly **500 recipients a day** and throttles
  bursts. Fine for early signups; it will not survive a launch.
- The inbox will read **Fancy Finery**, which is the goal, but the address
  underneath still says `@gmail.com`. Every luxury house a customer compares you
  to writes from its own domain, so this is worth revisiting when there is one.

### The better long-term answer

Buy the domain, then send from `no-reply@` or `hello@` on it through Resend —
which this codebase already speaks (`src/infrastructure/notifications/email-provider.ts`,
keyed on `RESEND_API_KEY`). Set `EMAIL_FROM` to override the default, point
Supabase's SMTP at Resend, and authenticate the domain with SPF, DKIM and
ideally DMARC. No daily cap, better deliverability, and it reads as a real
company.

Whichever route you take, note that Supabase's built-in sender is intended for
development and is rate limited, so leaving it in place risks confirmations
silently failing to arrive.

### What the code already does

`EMAIL_FROM` overrides the sender for the app's own mail (newsletter, order
notifications). Its default was `no-reply@fancyfinery.com` — a domain the
business does not own, which would have failed SPF and DKIM and been dropped or
filed as spam. It now falls back to `BRAND_FROM`, the house address.

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
