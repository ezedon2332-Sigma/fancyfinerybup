"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail } from "lucide-react";

import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";
import { magicLinkSchema } from "@/lib/validation";

type Status = "idle" | "sending" | "sent" | "error";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("redirect") ?? "/account";
  const authError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(
    authError ? "Sign-in link was invalid or expired. Try again." : null,
  );

  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const parsed = magicLinkSchema.safeParse({ email });
    if (!parsed.success) {
      setStatus("error");
      setMessage(parsed.error.issues[0].message);
      return;
    }
    setStatus("sending");
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  async function handleGoogle() {
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950/60 p-8 shadow-2xl"
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold text-yellow-400">Welcome</h1>
        <p className="mt-2 text-sm text-gray-400">
          Sign in to Fancy Finery to manage your orders.
        </p>
      </div>

      {status === "sent" ? (
        <div className="mt-8 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-5 text-center">
          <Mail className="mx-auto h-8 w-8 text-yellow-400" />
          <p className="mt-3 text-sm text-gray-200">
            Check your inbox — we sent a sign-in link to{" "}
            <span className="font-medium text-white">{email}</span>.
          </p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={handleGoogle}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-sm border border-white/20 bg-white px-4 py-3 font-medium text-black transition-colors hover:bg-gray-100"
          >
            <GoogleIcon /> Continue with Google
          </button>

          <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-widest text-gray-500">
            <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-sm border border-white/20 bg-black/40 px-4 py-3 text-white outline-none transition-colors placeholder:text-gray-500 focus:border-yellow-500"
              />
            </div>
            <button
              type="submit"
              disabled={status === "sending"}
              className="flex w-full items-center justify-center gap-2 rounded-sm bg-yellow-500 px-4 py-3 font-semibold text-black transition-colors hover:bg-yellow-600 disabled:opacity-50"
            >
              {status === "sending" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                "Email me a sign-in link"
              )}
            </button>
          </form>
        </>
      )}

      {message && (
        <p className="mt-4 text-center text-sm text-red-400">{message}</p>
      )}
    </motion.div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
