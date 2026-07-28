"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Globe, MailCheck } from "lucide-react";

import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";
import { emailSchema } from "@/lib/validation";
import { ErrorNote, FIELD, Field, Notice, Spinner } from "@/components/ui";

/** Minimum that is worth enforcing. Longer beats complex — a 12-character
 *  passphrase resists guessing better than 8 characters of punctuation — so the
 *  bar is length, and the rest is guidance rather than rejection. */
const MIN_PASSWORD = 8;

/**
 * Create an account with a password.
 *
 * Login already offered password sign-in, a magic link, Google and password
 * reset, but there was no way to *create* a password account — a customer had
 * to sign in by link and never had a password to use afterwards. This closes
 * that gap.
 */
export function SignUpForm({ next = "/account" }: { next?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "confirm" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const strength = scorePassword(password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      setStatus("error");
      setMessage(parsedEmail.error.issues[0].message);
      return;
    }
    if (name.trim().length < 2) {
      setStatus("error");
      setMessage("Please enter your name.");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setStatus("error");
      setMessage(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setMessage("Those passwords do not match.");
      return;
    }

    setStatus("sending");
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsedEmail.data,
      password,
      options: {
        // Carried into the profile by the on-signup trigger.
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(
        /already registered/i.test(error.message)
          ? "An account already exists for that email. Sign in instead."
          : error.message,
      );
      return;
    }

    // With email confirmation on, there is no session yet — say so rather than
    // pushing to a page that will bounce them back to login.
    if (!data.session) {
      setStatus("confirm");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function withGoogle() {
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  if (status === "confirm") {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto h-6 w-6 text-yellow-500" />
        <h2 className="brand-wordmark mt-5 text-2xl tracking-[0.04em]">
          Check your inbox
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-gray-300">
          We have sent a confirmation link to{" "}
          <strong className="text-gray-100">{email}</strong>. Open it to finish
          creating your account.
        </p>
        <Link href="/login" className="btn-gold-ghost mt-8 inline-flex">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="space-y-4">
        <Field label="Full name" htmlFor="su-name">
          <input
            id="su-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            className={FIELD}
            placeholder="Adaeze Okafor"
          />
        </Field>

        <Field label="Email" htmlFor="su-email">
          <input
            id="su-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className={FIELD}
            placeholder="you@example.com"
          />
        </Field>

        <Field
          label="Password"
          htmlFor="su-password"
          hint={`At least ${MIN_PASSWORD} characters. A short phrase is stronger than a short word.`}
        >
          <input
            id="su-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
            className={FIELD}
          />
        </Field>

        {password.length > 0 && (
          <div aria-live="polite">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i < strength.score ? strength.colour : "bg-white/10"
                  }`}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-gray-500">{strength.label}</p>
          </div>
        )}

        <Field label="Confirm password" htmlFor="su-confirm">
          <input
            id="su-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            className={FIELD}
          />
        </Field>

        {confirm.length > 0 && password === confirm && (
          <p className="flex items-center gap-1.5 text-[11px] text-green-400">
            <Check className="h-3 w-3" /> Passwords match
          </p>
        )}
      </div>

      {status === "error" && message && (
        <div className="mt-5">
          <ErrorNote>{message}</ErrorNote>
        </div>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="btn-gold mt-6 w-full disabled:opacity-60"
      >
        <span className="relative z-10 inline-flex items-center gap-2">
          {status === "sending" && <Spinner />}
          {status === "sending" ? "Creating account…" : "Create account"}
        </span>
      </button>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600">
          or
        </span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <button
        type="button"
        onClick={withGoogle}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-white/15 text-sm text-gray-200 transition-colors hover:border-yellow-500/60 hover:text-yellow-400"
      >
        <Globe className="h-4 w-4" /> Continue with Google
      </button>

      <p className="mt-6 text-center text-xs text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="text-yellow-400 underline underline-offset-4">
          Sign in
        </Link>
      </p>

      <div className="mt-5">
        <Notice>
          Creating an account saves your addresses, keeps your order history and
          lets your reviews show as verified purchases.
        </Notice>
      </div>
    </form>
  );
}

/** Rough strength signal: length first, variety second. Deliberately advisory
 *  — only the length minimum is enforced. */
function scorePassword(pw: string): {
  score: number;
  label: string;
  colour: string;
} {
  if (!pw) return { score: 0, label: "", colour: "bg-white/10" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^\w\s]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: "Weak — try a longer phrase", colour: "bg-red-500" };
  if (score === 2) return { score: 2, label: "Fair", colour: "bg-amber-500" };
  if (score === 3) return { score: 3, label: "Good", colour: "bg-yellow-400" };
  return { score: 4, label: "Strong", colour: "bg-green-500" };
}
