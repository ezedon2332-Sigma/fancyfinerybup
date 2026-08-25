// Send one real email using the app's own template code, so what lands in the
// inbox is exactly what a customer receives.
//
//   npx tsx scripts/send-test-email.mts <address>
//
// Renders the ORDER CONFIRMATION body — the message most customers see first —
// through the shared house shell (src/infrastructure/notifications/email-shell).
// Nothing is duplicated here; if the template changes, this changes with it.

import {
  button,
  detailRows,
  fallbackLink,
  heading,
  paragraph,
  shell,
} from "../src/infrastructure/notifications/email-shell.ts";

process.loadEnvFile(".env");

const to = process.argv[2];
if (!to) {
  console.error("Usage: npx tsx scripts/send-test-email.mts <address>");
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;
if (!apiKey || !from) {
  console.error("RESEND_API_KEY and EMAIL_FROM must both be set in .env.");
  process.exit(1);
}

const ref = "A1B2C3D4";
const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/account/orders/demo`;

const html = shell(
  "We've received your order",
  heading("Thank you for your order") +
    paragraph("Hi there,") +
    paragraph(
      "We have your order and are preparing it for despatch. You will get " +
        "tracking details by email the moment it ships.",
    ) +
    detailRows([
      ["Order reference", `#${ref}`],
      ["Item", "Golden Hour Gown"],
      ["Total", "₦450,000"],
    ]) +
    button(url, "View your order") +
    fallbackLink(url),
  { kicker: "Order Confirmation" },
);

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from,
    to: [to],
    reply_to: process.env.EMAIL_REPLY_TO || undefined,
    subject: "We've received your order — Fancy Finery",
    html,
    text:
      `Hi there,\n\nThanks for your order (#${ref}). We're preparing it for ` +
      `shipment and will email tracking details as soon as it ships.\n\n` +
      `View your order: ${url}\n\n— Fancy Finery`,
  }),
});

const body = await res.text();
if (!res.ok) {
  console.error(`\n  FAILED (${res.status}): ${body}\n`);
  if (/domain|verif/i.test(body)) {
    console.error(
      "  Resend will not send from an unverified domain. Verify EMAIL_FROM's\n" +
        "  domain at resend.com/domains and add the DKIM/SPF records it issues.\n",
    );
  }
  process.exit(1);
}

console.log(`\n  Sent to ${to}`);
console.log(`  From:   ${from}`);
console.log(`  ${body}\n`);
