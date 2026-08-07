import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentUser } from "@/infrastructure/supabase/auth";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

/**
 * Placeholder while the authentication experience is rebuilt. Account creation
 * will return here. Signed-in visitors go straight to their account.
 */
export default async function SignUpPage() {
  const user = await getCurrentUser();
  if (user) redirect("/account");

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 py-16 text-center">
      <div className="max-w-sm">
        <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-500">
          Fancy Finery
        </p>
        <h1 className="brand-wordmark mt-3 text-2xl">Accounts coming soon</h1>
        <p className="mt-4 text-sm leading-relaxed text-gray-400">
          Our sign-up experience is being refreshed. Please check back shortly.
        </p>
      </div>
    </div>
  );
}
