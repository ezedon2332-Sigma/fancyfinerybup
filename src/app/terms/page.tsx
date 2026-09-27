import type { Metadata } from "next";
import Link from "next/link";

import { PolicyPage, Section } from "@/components/site/PolicyPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms on which Fancy Finery sells and delivers, including pricing, payment, delivery, returns and cancellations.",
};

export default function TermsPage() {
  return (
    <PolicyPage
      kicker="Terms"
      title="Terms of Service"
      updated="27 September 2026"
      intro="These terms govern your use of this website and any order you place with Fancy Finery."
    >
      <Section heading="Orders">
        <p>
          Placing an order is an offer to buy. A contract is formed when we
          confirm your order by email after payment has cleared — or, where an
          order is payable on delivery, when we confirm it directly.
        </p>
        <p>
          We may decline an order where an item is out of stock, where a price
          has been listed in error, or where we cannot deliver to the address
          given. If we decline after payment, you are refunded in full.
        </p>
      </Section>

      <Section heading="Prices and currency">
        <p>
          Prices are held in Naira and may be displayed in your chosen currency
          for convenience. The currency shown at checkout is the currency you are
          charged in. Any tax that applies is shown separately before you pay.
        </p>
        <p>
          Delivery is charged separately and depends on destination and parcel
          weight. Current rates are on our{" "}
          <Link
            href="/shipping"
            className="text-yellow-500 underline-offset-4 hover:underline"
          >
            shipping page
          </Link>
          .
        </p>
      </Section>

      <Section heading="Payment">
        <p>
          Payment is taken through Paystack or Stripe depending on your currency.
          An order is not confirmed until the payment provider reports the charge
          as successful. Unpaid orders may be cancelled.
        </p>
      </Section>

      <Section heading="Delivery">
        <p>
          We deliver within Nigeria and internationally. Delivery estimates are
          estimates, not guarantees, and do not include customs clearance time.
        </p>
        <p>
          Duties and import taxes for international deliveries are the
          recipient&rsquo;s responsibility and are not included in the price you
          pay us.
        </p>
      </Section>

      <Section heading="Cancellations, returns and refunds">
        <p>
          You may cancel an order at any time before it is despatched, from your
          account. Once despatched, a return must be arranged with us.
        </p>
        <p>
          Items must be returned unworn, unwashed and with their tags intact.
          Refunds are made to the original payment method once the return has
          been received and checked.
        </p>
        <p>
          Nothing in these terms limits your rights in respect of goods that are
          faulty, damaged or not as described.
        </p>
      </Section>

      <Section heading="Your account">
        <p>
          You are responsible for keeping your password confidential and for
          activity under your account. Tell us at once if you believe someone
          else has access to it.
        </p>
      </Section>

      <Section heading="Product presentation">
        <p>
          We photograph our pieces as faithfully as we can, but colour can vary
          between screens. Measurements are given as a guide.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about these terms:{" "}
          <a
            href="mailto:orders@fancyfinerybup.com"
            className="text-yellow-500 underline-offset-4 hover:underline"
          >
            orders@fancyfinerybup.com
          </a>{" "}
          or the{" "}
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
