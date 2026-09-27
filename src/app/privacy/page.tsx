import type { Metadata } from "next";
import Link from "next/link";

import { PolicyPage, Section } from "@/components/site/PolicyPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Fancy Finery collects, uses and protects your personal information, including payments, delivery, email and cookies.",
};

/**
 * Describes what the application actually does, not generic boilerplate: the
 * processors named here are the ones the code really calls (Paystack, Stripe,
 * Resend, Anthropic), and the cookies listed are the ones it really sets.
 * Keeping it factual is what makes it worth publishing — and what means it has
 * to be revisited whenever a processor changes.
 */
export default function PrivacyPage() {
  return (
    <PolicyPage
      kicker="Your Privacy"
      title="Privacy Policy"
      updated="27 September 2026"
      intro="This policy explains what we collect when you shop with Fancy Finery, why we need it, and who else sees it."
    >
      <Section heading="What we collect">
        <p>
          <strong className="text-gray-100">Account details.</strong> Your name,
          email address and password. Passwords are stored only as a salted hash
          — we never hold the password itself and cannot recover it for you.
        </p>
        <p>
          <strong className="text-gray-100">Order and delivery details.</strong>{" "}
          Your phone number, delivery address, the items you bought and what you
          paid. We keep these because they are the order.
        </p>
        <p>
          <strong className="text-gray-100">Technical data.</strong> Your IP
          address is stored only as a salted hash, used to rate-limit signups and
          reviews. We cannot recover the original address from it.
        </p>
      </Section>

      <Section heading="Payments">
        <p>
          We do not see or store your card details. Card and bank information is
          entered on the payment provider&rsquo;s own page and never reaches our
          servers. Payments in Naira and US Dollars are handled by{" "}
          <strong className="text-gray-100">Paystack</strong>; payments in Euro
          and Pounds Sterling by <strong className="text-gray-100">Stripe</strong>.
          We receive only the outcome — whether the payment succeeded, the amount
          and a reference.
        </p>
      </Section>

      <Section heading="Who else processes your data">
        <p>
          <strong className="text-gray-100">Resend</strong> delivers our email:
          order confirmations, delivery updates, password resets and, if you
          asked for it, the newsletter.
        </p>
        <p>
          <strong className="text-gray-100">Google</strong> receives nothing
          unless you choose to sign in with Google, in which case we receive your
          name, email address and profile picture from them.
        </p>
        <p>
          <strong className="text-gray-100">Anthropic</strong> processes messages
          you send to our online assistant, where it is enabled, so it can reply.
        </p>
        <p>
          We do not sell your personal information, and we do not share it for
          advertising.
        </p>
      </Section>

      <Section heading="Cookies">
        <p>
          We use cookies only to make the shop work: one keeps you signed in, one
          remembers your chosen display currency, and one remembers your
          language. We do not use advertising or cross-site tracking cookies.
        </p>
      </Section>

      <Section heading="How long we keep it">
        <p>
          Order records are kept for as long as accounting and tax rules require.
          You can ask us to delete your account at any time; we will remove your
          personal details and retain only what the law requires us to keep
          against past orders.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          You can ask for a copy of the information we hold about you, ask us to
          correct it, or ask us to delete it. You can unsubscribe from marketing
          email using the link in any newsletter, without affecting the emails we
          must send about your orders.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Email us at{" "}
          <a
            href="mailto:orders@fancyfinerybup.com"
            className="text-yellow-500 underline-offset-4 hover:underline"
          >
            orders@fancyfinerybup.com
          </a>{" "}
          or use the{" "}
          <Link
            href="/contact"
            className="text-yellow-500 underline-offset-4 hover:underline"
          >
            contact page
          </Link>
          .
        </p>
      </Section>
    </PolicyPage>
  );
}
