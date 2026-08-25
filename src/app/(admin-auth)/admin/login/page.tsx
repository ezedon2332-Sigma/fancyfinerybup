import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { getCurrentProfile } from "@/infrastructure/auth/session";

export const metadata: Metadata = {
  title: "Admin sign in",
  // Never index a staff entrance.
  robots: { index: false, follow: false },
};

/**
 * Staff sign-in, separate from the customer one.
 *
 * **Why this lives in a route group.** It renders at /admin/login but must NOT
 * sit inside `app/admin/`, because `app/admin/layout.tsx` calls requireAdmin()
 * on every child — including, if it were a child, the sign-in page itself. That
 * produced a redirect loop: visit /admin/login -> layout gate fails -> redirect
 * to /admin/login -> repeat, which the browser shows as a flickering page.
 * `(admin-auth)` is a route group, so it shapes the layout tree without
 * appearing in the URL: the page keeps its address and inherits only the root
 * layout.
 *
 * This is a SEPARATE ROUTE, not a separate security boundary — worth being
 * precise about. There is one identity system and one session cookie; an admin
 * signing in here or at /login ends up with exactly the same session. What the
 * separation buys is:
 *
 *   - staff never land on a storefront-styled page with newsletter prompts,
 *   - the customer sign-up path is absent, so nobody creates an account here,
 *   - `/admin/*` redirects here instead of /login, so a bookmark works.
 *
 * The authorization is still `requireAdmin()` in the admin layout and in every
 * admin Server Action. A customer who signs in on this page gets a customer
 * session and is bounced by that gate, exactly as they would be anywhere else —
 * which is the property that makes a pretty staff door safe to have.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: target } = await searchParams;

  // Already an admin? Go where they were headed.
  const profile = await getCurrentProfile();
  if (profile?.role === "admin") {
    const safe =
      target && target.startsWith("/") && !target.startsWith("//")
        ? target
        : "/admin";
    redirect(safe);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-5 py-16">
      <Suspense fallback={<div className="h-96 w-full max-w-sm" />}>
        <AdminLoginForm signedInAsCustomer={Boolean(profile)} />
      </Suspense>
    </div>
  );
}
