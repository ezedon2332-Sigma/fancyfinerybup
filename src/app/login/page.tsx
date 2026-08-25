import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { AuthPanel } from "@/components/auth/AuthPanel";
import { getCurrentUser } from "@/infrastructure/auth/session";

export const metadata: Metadata = { title: "Sign in" };

/** Same guard as AuthPanel: internal paths only, never protocol-relative. */
function safeRedirect(target: string | undefined): string {
  if (!target) return "/account";
  if (!target.startsWith("/") || target.startsWith("//")) return "/account";
  return target;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: target } = await searchParams;

  // An already-signed-in visitor who follows a `?redirect=/checkout` link is
  // trying to get to checkout, not to their dashboard. Sending them to /account
  // here would strand them exactly as the sign-in handler used to.
  const user = await getCurrentUser();
  if (user) redirect(safeRedirect(target));

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-5 py-16 sm:px-6">
      {/* AuthPanel reads the `redirect` query param via useSearchParams, which
          Next requires to sit under a Suspense boundary. */}
      <Suspense fallback={<div className="h-96 w-full max-w-md" />}>
        <AuthPanel mode="signin" />
      </Suspense>
    </div>
  );
}
