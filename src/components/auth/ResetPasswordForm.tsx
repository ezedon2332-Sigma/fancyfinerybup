"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { authClient } from "@/infrastructure/auth/client";
import { toast } from "@/components/ui/Toast";

const MIN_LENGTH = 10;

/** Sets a new password on the currently signed-in account. */
export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < MIN_LENGTH) {
      toast.error(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      toast.error("The two passwords don't match.");
      return;
    }
    setBusy(true);
    // Better Auth carries the reset token in the link's ?token= parameter
    // rather than establishing a recovery session first, so the token is passed
    // explicitly here instead of being implied by the current session.
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setBusy(false);
      toast.error("This reset link is invalid or has expired. Request a new one.");
      return;
    }

    const { error: err } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setBusy(false);
    if (err) {
      toast.error(err.message ?? "Could not reset your password.");
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6 text-center"
      >
        <Check className="mx-auto h-8 w-8 text-yellow-400" />
        <p className="mt-3 text-sm text-gray-200">
          Password updated. You can now sign in with it on any device.
        </p>
        <a
          href="/admin"
          className="mt-5 inline-block text-xs uppercase tracking-widest text-yellow-400 hover:text-yellow-300"
        >
          Go to the dashboard
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-white/10 bg-neutral-950/60 p-6"
    >
      <label htmlFor="new-password" className="mb-2 block text-xs text-gray-400">
        New password
      </label>
      <input
        id="new-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        required
        minLength={MIN_LENGTH}
        className={input}
      />

      <label
        htmlFor="confirm-password"
        className="mb-2 mt-4 block text-xs text-gray-400"
      >
        Confirm password
      </label>
      <input
        id="confirm-password"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        required
        className={input}
      />

      <p className="mt-3 text-[11px] text-gray-500">
        At least {MIN_LENGTH} characters. Use something unique to this site.
      </p>


      <button
        type="submit"
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-sm bg-yellow-500 px-4 py-3 font-semibold text-black transition-colors hover:bg-yellow-600 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}

const input =
  "w-full rounded-sm border border-white/20 bg-black/40 px-4 py-3 text-white outline-none transition-colors focus:border-yellow-500";
