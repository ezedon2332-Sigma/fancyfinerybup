import type { Metadata } from "next";
import Link from "next/link";

import { unsubscribeByToken } from "@/infrastructure/db/newsletter-service";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

/** One-click unsubscribe reached from the footer of every marketing email.
 *  No login required — the token in the link is the authorisation. */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const done = token ? await unsubscribeByToken(token) : false;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-500">
        Privé Circle
      </p>
      <h1 className="brand-wordmark mt-6 text-3xl tracking-[0.04em]">
        {done ? "You have been removed" : "Link not recognised"}
      </h1>
      <p className="mt-5 text-sm leading-relaxed text-gray-300">
        {done
          ? "You will no longer receive marketing emails from Fancy Finery. You remain welcome in the house at any time — order confirmations and delivery updates are unaffected."
          : "This unsubscribe link is invalid or has already been used. If you continue to receive emails, reply to any of them and we will remove you by hand."}
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link href="/" className="btn-gold-ghost">
          Return to Fancy Finery
        </Link>
        {done && (
          <Link href="/#prive-circle" className="btn-gold">
            <span className="relative z-10">Rejoin the Circle</span>
          </Link>
        )}
      </div>
    </div>
  );
}
