import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/AuthCard";
import { getCurrentUser } from "@/infrastructure/supabase/auth";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create your Fancy Finery account.",
};

/** Only same-origin paths are safe redirect targets. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; intent?: string }>;
}) {
  // A valid session never sees the auth screen.
  const user = await getCurrentUser();
  const { redirect: next, intent } = await searchParams;
  if (user) redirect(safeNext(next));

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-5 py-16 sm:px-6">
      <Suspense fallback={null}>
        <AuthCard initialTab={intent === "signup" ? "signup" : "signin"} />
      </Suspense>
    </div>
  );
}
