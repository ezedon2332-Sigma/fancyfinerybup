import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/SignUpForm";
import { Card } from "@/components/ui";
import { getCurrentUser } from "@/infrastructure/supabase/auth";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create a Fancy Finery account to save addresses, track orders and review your pieces.",
};

export default async function SignUpPage() {
  // Already signed in? No signup prompts — take them to their account.
  const user = await getCurrentUser();
  if (user) redirect("/account");

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 py-16 sm:px-6">
      <div className="w-full max-w-md">
        <header className="text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-500">
            Fancy Finery
          </p>
          <h1 className="brand-wordmark mt-5 text-3xl tracking-[0.04em]">
            Create your account
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-gray-400">
            One account for orders, addresses and the pieces you love.
          </p>
        </header>

        {/* No Suspense boundary. The form reads no search params and fetches
            nothing, so wrapping it bought nothing except a blank card while
            React held the markup in a hidden staging div and swapped it in
            afterwards. Rendered inline it is in the first HTML response. */}
        <Card className="mt-8 p-6 sm:p-7">
          <SignUpForm />
        </Card>
      </div>
    </div>
  );
}
