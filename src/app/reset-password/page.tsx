import type { Metadata } from "next";

import { requireUser } from "@/infrastructure/auth/session";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

/**
 * Landing page for the password-reset link, and the place any signed-in user
 * can set or change their password. Reaching it already requires a valid
 * session — the recovery link establishes one via /auth/callback.
 */
export default async function ResetPasswordPage() {
  const user = await requireUser("/reset-password");

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6 py-20">
      <p className="text-center text-[10px] uppercase tracking-[0.3em] text-yellow-500">
        Account security
      </p>
      <h1 className="mt-5 text-center font-display text-3xl text-white">
        Set a new password
      </h1>
      <p className="mt-3 text-center text-sm text-gray-400">
        For <span className="text-gray-200">{user.email}</span>
      </p>
      <div className="mt-8">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
