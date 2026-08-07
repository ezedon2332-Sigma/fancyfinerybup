"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";

import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";
import { checkEmailExists } from "@/app/auth/actions";
import { magicLinkSchema } from "@/lib/validation";
import { SignUpForm } from "@/components/auth/SignUpForm";

type Step = "signin" | "signup" | "welcome";
type Status = "idle" | "sending" | "sent" | "reset-sent";
type Mode = "password" | "link";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Only same-origin paths are safe post-login redirect targets. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

/**
 * Sign in — returning customers first.
 *
 * The Sign In form is the default; a returning customer never meets a
 * create-account form. A small link toggles to registration, and arriving with
 * ?intent=signup (the header's "Create Account") opens straight on it. Already
 * signed-in visitors are redirected before this component renders (see the
 * /login and /signup server pages), so they only ever see a welcome, never this.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("redirect"));
  const authError = searchParams.get("error");
  const signupIntent = searchParams.get("intent") === "signup";

  const [step, setStep] = useState<Step>(signupIntent ? "signup" : "signin");
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [welcomeName, setWelcomeName] = useState<string>("");
  const [message, setMessage] = useState<string | null>(
    authError ? "Sign-in link was invalid or expired. Try again." : null,
  );

  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    const parsed = magicLinkSchema.safeParse({ email });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0].message);
      return;
    }
    if (!password) {
      setMessage("Enter your password.");
      return;
    }
    setStatus("sending");
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password,
    });
    if (error) {
      setStatus("idle");
      if (error.message === "Invalid login credentials") {
        // Detect whether the account exists so the guidance is truthful:
        // no account → nudge to register; account exists → wrong password.
        const check = await checkEmailExists(parsed.data.email);
        if (check.ok && !check.exists) {
          setMessage("We couldn't find an account with that email — create one below.");
          setStep("signup");
          return;
        }
        setMessage(
          "That email and password don't match. Use “Forgot password?” below if you've never set one.",
        );
        return;
      }
      setMessage(error.message);
      return;
    }
    // Greet by first name, then hand off with a full navigation so Server
    // Components re-read the fresh session cookie.
    const meta = data.user?.user_metadata as
      | { first_name?: string; full_name?: string }
      | undefined;
    setWelcomeName(
      meta?.first_name || meta?.full_name?.split(" ")[0] || "",
    );
    setStep("welcome");
    setTimeout(() => {
      router.replace(next);
      router.refresh();
    }, 1100);
  }

  async function handleForgot() {
    const parsed = magicLinkSchema.safeParse({ email });
    if (!parsed.success) {
      setMessage("Enter your email first.");
      return;
    }
    setStatus("sending");
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setStatus(error ? "idle" : "reset-sent");
    if (error) setMessage(error.message);
  }

  async function handleMagicLink() {
    const parsed = magicLinkSchema.safeParse({ email });
    if (!parsed.success) {
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
    setStatus(error ? "idle" : "sent");
    if (error) setMessage(error.message);
  }

  async function handleGoogle() {
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) setMessage(error.message);
  }

  const field =
    "w-full rounded-sm border border-white/20 bg-black/40 px-4 py-3 text-white outline-none transition-colors placeholder:text-gray-500 focus:border-yellow-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950/60 p-8 shadow-2xl"
    >
      <AnimatePresence mode="wait" initial={false}>
        {status === "sent" || status === "reset-sent" ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-5 text-center"
          >
            <Mail className="mx-auto h-8 w-8 text-yellow-400" />
            <p className="mt-3 text-sm text-gray-200">
              {status === "reset-sent"
                ? "Check your inbox — we sent a link to set a new password for "
                : "Check your inbox — we sent a sign-in link to "}
              <span className="font-medium text-white">{email}</span>.
            </p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="mt-4 text-xs uppercase tracking-widest text-gray-500 transition-colors hover:text-yellow-400"
            >
              Back to sign in
            </button>
          </motion.div>
        ) : step === "welcome" ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="py-6 text-center"
          >
            <CheckCircle2 className="mx-auto h-12 w-12 text-yellow-400" />
            <h1 className="brand-wordmark mt-5 text-2xl">
              {welcomeName ? `Welcome back, ${welcomeName}!` : "Welcome back!"}
            </h1>
            <p className="mt-2 text-sm text-gray-300">We&apos;re glad to see you again.</p>
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Taking you in…
            </p>
          </motion.div>
        ) : step === "signup" ? (
          <motion.div
            key="signup"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            <button
              type="button"
              onClick={() => { setStep("signin"); setMessage(null); }}
              className="mb-4 inline-flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-yellow-400"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </button>
            <h1 className="brand-wordmark text-2xl">Create your account</h1>
            <p className="mt-1.5 text-sm text-gray-400">
              One account for orders, addresses and the pieces you love.
            </p>
            <div className="mt-6">
              <SignUpForm initialEmail={email} next={next} />
            </div>
          </motion.div>
        ) : (
          /* -------- Default: Sign In form -------- */
          <motion.div
            key="signin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            <div className="text-center">
              <h1 className="text-2xl font-bold text-yellow-400">Welcome back</h1>
              <p className="mt-2 text-sm text-gray-400">
                Sign in to Fancy Finery to manage your orders.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-sm border border-white/20 bg-white px-4 py-3 font-medium text-black transition-colors hover:bg-gray-100"
            >
              <GoogleIcon /> Continue with Google
            </button>

            <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-widest text-gray-500">
              <span className="h-px flex-1 bg-white/10" /> or{" "}
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <form
              onSubmit={
                mode === "password"
                  ? handlePassword
                  : (e) => { e.preventDefault(); handleMagicLink(); }
              }
              className="space-y-4"
            >
              <div>
                <label htmlFor="email" className="sr-only">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                  className={field}
                />
              </div>

              {mode === "password" && (
                <div>
                  <label htmlFor="password" className="sr-only">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    autoComplete="current-password"
                    className={field}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-yellow-500 px-4 py-3 font-semibold text-black transition-colors hover:bg-yellow-600 disabled:opacity-50"
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {mode === "password" ? "Signing in…" : "Sending…"}
                  </>
                ) : mode === "password" ? (
                  "Sign in"
                ) : (
                  "Email me a sign-in link"
                )}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => { setMode(mode === "password" ? "link" : "password"); setMessage(null); }}
                className="inline-flex min-h-[44px] items-center text-gray-400 transition-colors hover:text-yellow-400"
              >
                {mode === "password" ? "Use a sign-in link" : "Use a password"}
              </button>
              {mode === "password" && (
                <button
                  type="button"
                  onClick={handleForgot}
                  className="inline-flex min-h-[44px] items-center text-gray-400 transition-colors hover:text-yellow-400"
                >
                  Forgot password?
                </button>
              )}
            </div>

            {/* Registration is one deliberate tap away — never the default. */}
            <p className="mt-4 border-t border-white/10 pt-5 text-center text-sm text-gray-400">
              New to Fancy Finery?{" "}
              <button
                type="button"
                onClick={() => { setStep("signup"); setMessage(null); }}
                className="font-medium text-yellow-400 underline underline-offset-4 transition-colors hover:text-yellow-300"
              >
                Create an account
              </button>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {message && (
        <p className="mt-4 text-center text-sm text-red-400">{message}</p>
      )}
    </motion.div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
