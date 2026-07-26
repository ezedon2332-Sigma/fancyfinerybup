"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";

const MIN_LENGTH = 10;

/** Sets a new password on the currently signed-in account. */
export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
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

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          {error}
        </p>
      )}

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
