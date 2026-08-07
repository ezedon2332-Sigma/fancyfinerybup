import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/infrastructure/supabase/auth";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Fancy Finery.",
};

/** Only same-origin paths are safe redirect targets. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  // A valid session skips the auth screens entirely.
  const user = await getCurrentUser();
  const { redirect: next } = await searchParams;
  if (user) redirect(safeNext(next));

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
