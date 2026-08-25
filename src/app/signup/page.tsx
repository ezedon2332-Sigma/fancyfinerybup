import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";

import { AuthPanel } from "@/components/auth/AuthPanel";
import { getCurrentUser } from "@/infrastructure/auth/session";

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
    <div className="flex min-h-[75vh] items-center justify-center px-5 py-16 sm:px-6">
      {/* AuthPanel reads ?redirect via useSearchParams. */}
      <Suspense fallback={<div className="h-96 w-full max-w-md" />}>
        <AuthPanel mode="signup" />
      </Suspense>
    </div>
  );
}
