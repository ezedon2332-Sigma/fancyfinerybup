"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  X,
} from "lucide-react";

import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";
import { signUpAction } from "@/app/signup/actions";
import { magicLinkSchema, signUpSchema } from "@/lib/validation";
import {
  PASSWORD_RULES,
  checkPassword,
  scorePassword,
} from "@/domain/password-policy";

type Tab = "signin" | "signup";
type View = Tab | "forgot" | "welcome" | "verify" | "sent";

const EASE = [0.22, 1, 0.36, 1] as const;
const STRENGTH = ["bg-white/10", "bg-red-500", "bg-amber-500", "bg-yellow-400", "bg-green-500"] as const;

function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

/**
 * The single authentication surface: Sign In and Create Account as one card,
 * with inline Forgot Password and a Welcome Back hand-off. Guests choose; once
 * a session exists the /login and /signup pages redirect here-away to /account,
 * so this is only ever seen while signed out. Auth logic runs through the
 * hardened Supabase SSR clients + server action — only the UI is new.
 */
export function AuthCard({ initialTab = "signin" }: { initialTab?: Tab }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("redirect"));

  const [view, setView] = useState<View>(initialTab);
  const [error, setError] = useState<string | null>(
    params.get("error") ? "That sign-in link was invalid or expired." : null,
  );
  const [welcomeName, setWelcomeName] = useState("");
  const [sentTo, setSentTo] = useState("");

  const isTab = view === "signin" || view === "signup";
  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (e) setError(e.message);
  }

  function toWelcome(name: string) {
    setWelcomeName(name);
    setView("welcome");
    setTimeout(() => {
      router.replace(next);
      router.refresh();
    }, 1100);
  }

  return (
    <div className="w-full max-w-md">
      <div className="overflow-hidden rounded-3xl border border-yellow-600/20 bg-neutral-950/70 shadow-2xl shadow-black/60 backdrop-blur-xl">
        {/* Brand header */}
        <div className="border-b border-white/8 px-7 pt-7 pb-5 text-center">
          <p className="text-[10px] uppercase tracking-[0.34em] text-yellow-500/90">
            Fancy Finery
          </p>
          <h1 className="brand-wordmark mt-2 text-2xl">
            {view === "signup"
              ? "Create your account"
              : view === "forgot"
                ? "Reset your password"
                : "Welcome"}
          </h1>
        </div>

        {/* Segmented control (only on the two main tabs) */}
        {isTab && (
          <div className="px-7 pt-5">
            <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-black/40 p-1">
              {(["signin", "signup"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setView(t); setError(null); }}
                  className={`relative rounded-full py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
                    view === t ? "text-black" : "text-gray-400 hover:text-yellow-300"
                  }`}
                >
                  {view === t && (
                    <motion.span
                      layoutId="auth-seg"
                      className="absolute inset-0 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-500"
                      transition={{ duration: 0.3, ease: EASE }}
                    />
                  )}
                  <span className="relative z-10">
                    {t === "signin" ? "Sign In" : "Create Account"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-7 py-6">
          <AnimatePresence mode="wait" initial={false}>
            {view === "welcome" ? (
              <Fade key="welcome">
                <div className="py-6 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-yellow-400" />
                  <h2 className="brand-wordmark mt-5 text-2xl">
                    {welcomeName ? `Welcome back, ${welcomeName}!` : "Welcome back!"}
                  </h2>
                  <p className="mt-2 text-sm text-gray-300">
                    We&apos;re glad to see you again.
                  </p>
                  <p className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Taking you in…
                  </p>
                </div>
              </Fade>
            ) : view === "verify" ? (
              <Fade key="verify">
                <Confirmation
                  title="Confirm your email"
                  body={
                    <>We sent a confirmation link to <b className="text-white">{sentTo}</b>. Open it to activate your account.</>
                  }
                  onBack={() => setView("signin")}
                  backLabel="Back to sign in"
                />
              </Fade>
            ) : view === "sent" ? (
              <Fade key="sent">
                <Confirmation
                  title="Check your inbox"
                  body={
                    <>We sent a password-reset link to <b className="text-white">{sentTo}</b>.</>
                  }
                  onBack={() => setView("signin")}
                  backLabel="Back to sign in"
                />
              </Fade>
            ) : view === "forgot" ? (
              <Fade key="forgot">
                <ForgotForm
                  redirectTo={redirectTo()}
                  onSent={(email) => { setSentTo(email); setView("sent"); }}
                  onBack={() => setView("signin")}
                  setError={setError}
                />
              </Fade>
            ) : view === "signup" ? (
              <Fade key="signup">
                <SignUpFields
                  next={next}
                  google={google}
                  onVerify={(email) => { setSentTo(email); setView("verify"); }}
                  onActive={toWelcome}
                  setError={setError}
                />
              </Fade>
            ) : (
              <Fade key="signin">
                <SignInFields
                  google={google}
                  onSignedIn={toWelcome}
                  onForgot={() => { setView("forgot"); setError(null); }}
                  setError={setError}
                />
              </Fade>
            )}
          </AnimatePresence>

          {error && (
            <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- primitives */

const FIELD =
  "w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-yellow-500";
const LABEL = "mb-1.5 block text-xs font-medium uppercase tracking-widest text-gray-400";

function Fade({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function GoogleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-100"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
      </svg>
      Continue with Google
    </button>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-widest text-gray-600">
      <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${FIELD} pr-11`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-0 top-0 flex h-full w-11 items-center justify-center text-gray-500 hover:text-yellow-400"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SubmitButton({ pending, label, busyLabel }: { pending: boolean; label: string; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-yellow-300 to-yellow-500 px-4 py-3 text-sm font-semibold text-black transition-all hover:from-yellow-200 hover:to-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> {busyLabel}</> : label}
    </button>
  );
}

function Confirmation({
  title,
  body,
  onBack,
  backLabel,
}: {
  title: string;
  body: React.ReactNode;
  onBack: () => void;
  backLabel: string;
}) {
  return (
    <div className="py-4 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-yellow-600/30 bg-yellow-500/5">
        <Mail className="h-6 w-6 text-yellow-400" />
      </span>
      <h2 className="brand-wordmark mt-5 text-xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-gray-300">{body}</p>
      <p className="mt-2 text-xs text-gray-500">It can take a minute — check your spam folder too.</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-gray-400 hover:text-yellow-400"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------- forms */

function SignInFields({
  google,
  onSignedIn,
  onForgot,
  setError,
}: {
  google: () => void;
  onSignedIn: (name: string) => void;
  onForgot: () => void;
  setError: (m: string | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = magicLinkSchema.safeParse({ email });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (!password) return setError("Enter your password.");
    setError(null);
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password,
      });
      if (error) {
        setError(
          error.message === "Invalid login credentials"
            ? "That email and password don't match. Try “Forgot password?” if you've never set one."
            : error.message,
        );
        return;
      }
      const meta = data.user?.user_metadata as { first_name?: string; full_name?: string } | undefined;
      onSignedIn(meta?.first_name || meta?.full_name?.split(" ")[0] || "");
    });
  }

  return (
    <div>
      <GoogleButton onClick={google} />
      <Divider />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="si-email" className={LABEL}>Email</label>
          <input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus className={FIELD} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="si-pw" className={LABEL}>Password</label>
            <button type="button" onClick={onForgot} className="mb-1.5 text-xs text-gray-400 hover:text-yellow-400">
              Forgot password?
            </button>
          </div>
          <PasswordInput id="si-pw" value={password} onChange={setPassword} placeholder="Your password" autoComplete="current-password" />
        </div>
        <SubmitButton pending={pending} label="Sign In" busyLabel="Signing in…" />
      </form>
    </div>
  );
}

function SignUpFields({
  next,
  google,
  onVerify,
  onActive,
  setError,
}: {
  next: string;
  google: () => void;
  onVerify: (email: string) => void;
  onActive: (name: string) => void;
  setError: (m: string | null) => void;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
    website: "", // honeypot
  });
  const [touched, setTouched] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof form) => (v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const policy = useMemo(() => checkPassword(form.password), [form.password]);
  const strength = useMemo(() => scorePassword(form.password), [form.password]);
  const match = form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the highlighted fields.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await signUpAction(parsed.data);
      if (!res.ok) {
        setError(res.error ?? "Could not create your account.");
        return;
      }
      if (res.kind === "verify") onVerify(form.email);
      else onActive(form.firstName);
    });
  }

  return (
    <div>
      <GoogleButton onClick={google} />
      <Divider />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {/* honeypot */}
        <div className="absolute left-[-9999px] h-px w-px overflow-hidden" aria-hidden>
          <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website")(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="su-first" className={LABEL}>First name</label>
            <input id="su-first" value={form.firstName} onChange={(e) => set("firstName")(e.target.value)} autoComplete="given-name" placeholder="Adaeze" className={FIELD} />
          </div>
          <div>
            <label htmlFor="su-last" className={LABEL}>Last name</label>
            <input id="su-last" value={form.lastName} onChange={(e) => set("lastName")(e.target.value)} autoComplete="family-name" placeholder="Okafor" className={FIELD} />
          </div>
        </div>

        <div>
          <label htmlFor="su-email" className={LABEL}>Email</label>
          <input id="su-email" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} autoComplete="email" placeholder="you@example.com" className={FIELD} />
        </div>

        <div>
          <label htmlFor="su-pw" className={LABEL}>Password</label>
          <PasswordInput id="su-pw" value={form.password} onChange={(v) => { set("password")(v); setTouched(true); }} placeholder="Create a password" autoComplete="new-password" />
          <AnimatePresence initial={false}>
            {touched && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-2.5 rounded-lg border border-white/8 bg-white/[0.02] p-3">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.score ? STRENGTH[strength.score] : "bg-white/10"}`} />
                    ))}
                  </div>
                  <ul className="mt-2.5 grid grid-cols-2 gap-1">
                    {PASSWORD_RULES.map((rule) => {
                      const met = !policy.unmet.includes(rule.id);
                      return (
                        <li key={rule.id} className={`flex items-center gap-1.5 text-[11px] ${met ? "text-green-400" : "text-gray-500"}`}>
                          {met ? <Check className="h-3 w-3 shrink-0" strokeWidth={3} /> : <X className="h-3 w-3 shrink-0 opacity-50" />}
                          {rule.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div>
          <label htmlFor="su-confirm" className={LABEL}>Confirm password</label>
          <PasswordInput id="su-confirm" value={form.confirmPassword} onChange={set("confirmPassword")} placeholder="Repeat your password" autoComplete="new-password" />
          {match && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-green-400">
              <Check className="h-3 w-3" strokeWidth={3} /> Passwords match
            </p>
          )}
        </div>

        <label htmlFor="su-terms" className="flex cursor-pointer items-center gap-2.5 py-1 text-xs text-gray-400">
          <input id="su-terms" type="checkbox" checked={form.acceptTerms} onChange={(e) => set("acceptTerms")(e.target.checked)} className="h-4 w-4 shrink-0 accent-yellow-500" />
          I agree to the Terms &amp; Conditions and Privacy Policy
        </label>

        <SubmitButton pending={pending} label="Create Account" busyLabel="Creating your account…" />
      </form>
    </div>
  );
}

function ForgotForm({
  redirectTo,
  onSent,
  onBack,
  setError,
}: {
  redirectTo: string;
  onSent: (email: string) => void;
  onBack: () => void;
  setError: (m: string | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = magicLinkSchema.safeParse({ email });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: redirectTo.replace(/next=[^&]*/, "next=/reset-password"),
      });
      if (error) setError(error.message);
      else onSent(parsed.data.email);
    });
  }

  return (
    <div>
      <p className="text-sm text-gray-400">
        Enter your email and we&apos;ll send a link to set a new password.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="fp-email" className={LABEL}>Email</label>
          <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus className={FIELD} />
        </div>
        <SubmitButton pending={pending} label="Send reset link" busyLabel="Sending…" />
      </form>
      <button type="button" onClick={onBack} className="mt-5 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-yellow-400">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
      </button>
    </div>
  );
}
