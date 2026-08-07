"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";

/**
 * Minimal, temporary sign-in — a placeholder while the full authentication
 * experience is rebuilt. Deliberately bare (email + password only) and not
 * linked from the site chrome; it exists so administrators can always sign in.
 * Uses the existing hardened Supabase browser client.
 */
export function SignInStub() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setBusy(false);
      setError(
        err.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : err.message,
      );
      return;
    }
    router.replace("/account");
    router.refresh();
  }

  const field =
    "w-full rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-yellow-500";

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-950/60 p-8 text-center shadow-2xl">
      <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-500">Fancy Finery</p>
      <h1 className="brand-wordmark mt-3 text-2xl">Sign in</h1>
      <form onSubmit={submit} className="mt-7 space-y-4 text-left">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          aria-label="Email"
          autoFocus
          className={field}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          aria-label="Password"
          className={field}
        />
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-500 px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-yellow-400 disabled:opacity-60"
        >
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : "Sign in"}
        </button>
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </form>
    </div>
  );
}
