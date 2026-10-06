import type { Metadata } from "next";

import { getCurrentUser, requireUser } from "@/infrastructure/auth/session";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

/**
 * Two ways to arrive here, and they are not the same.
 *
 * **From a reset email.** The link carries `?token=`, and that token IS the
 * credential — Better Auth mints it, emails it, and verifies it when the new
 * password is submitted. There is no session, and demanding one is what broke
 * recovery entirely: someone who has forgotten their password is signed out by
 * definition, so the page bounced them to /login and the reset could never be
 * completed.
 *
 * That gate was correct under Supabase, whose recovery link signed the user in
 * first. Better Auth replaced that with a one-time token, and this page was
 * never updated to match — the form already was.
 *
 * **From the account, while signed in.** No token, so a session is required and
 * the address is shown for confirmation.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const fromResetLink = Boolean(token);

  // Only the signed-in path requires a user. On the token path a session is not
  // merely unnecessary — it is not expected to exist.
  const user = fromResetLink
    ? await getCurrentUser().catch(() => null)
    : await requireUser("/reset-password");

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6 py-20">
      <p className="text-center text-[10px] uppercase tracking-[0.3em] text-yellow-500">
        Account security
      </p>
      <h1 className="mt-5 text-center font-display text-3xl text-white">
        Set a new password
      </h1>
      {user?.email ? (
        <p className="mt-3 text-center text-sm text-gray-400">
          For <span className="text-gray-200">{user.email}</span>
        </p>
      ) : (
        <p className="mt-3 text-center text-sm text-gray-400">
          Choose a new password for your account.
        </p>
      )}
      <div className="mt-8">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
