"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Eye, EyeOff, Globe, MailCheck, X } from "lucide-react";

import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";
import { signUpAction } from "@/app/signup/actions";
import { signUpSchema, signUpFieldErrors } from "@/lib/validation";
import { COUNTRIES } from "@/domain/shipping/countries";
import {
  PASSWORD_RULES,
  checkPassword,
  scorePassword,
} from "@/domain/password-policy";
import { ErrorNote, FIELD, Field, Notice, Spinner } from "@/components/ui";

type Errors = Record<string, string>;

const EASE = [0.22, 1, 0.36, 1] as const;

const STRENGTH_COLOUR = [
  "bg-white/10",
  "bg-red-500",
  "bg-amber-500",
  "bg-yellow-400",
  "bg-green-500",
] as const;

/**
 * Create an account.
 *
 * Validation runs against the same zod schema the server action uses, so the
 * browser cannot show "looks fine" for something the server will reject — and
 * the server still re-validates, because a client check is a courtesy rather
 * than a control.
 */
export function SignUpForm({ next = "/account" }: { next?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "",
    acceptTerms: false,
    password: "",
    confirmPassword: "",
    website: "", // honeypot
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<"verify" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    // Clear a field's error the moment they start fixing it; leaving a red
    // message under a field someone is actively correcting is just nagging.
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  const policy = useMemo(() => checkPassword(form.password), [form.password]);
  const strength = useMemo(() => scorePassword(form.password), [form.password]);
  const confirmMatches =
    form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Every fault at once, not one per submit.
    const found = signUpFieldErrors(form);
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success || Object.keys(found).length > 0) {
      setErrors(found);
      setTouchedPassword(true);
      setFormError("Please check the highlighted fields.");
      return;
    }

    setErrors({});
    startTransition(async () => {
      const result = await signUpAction(parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error ?? "Could not create your account.");
        return;
      }
      if (result.kind === "verify") {
        setDone("verify");
        return;
      }
      // Session already established by the action; refresh so server components
      // pick up the signed-in state before navigating.
      router.replace(next);
      router.refresh();
    });
  }

  async function withGoogle() {
    setFormError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setFormError(error.message);
  }

  if (done === "verify") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="text-center"
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-yellow-600/30 bg-gradient-to-br from-yellow-500/15 to-transparent">
          <MailCheck className="h-6 w-6 text-yellow-500" />
        </span>
        <h2 className="brand-wordmark mt-6 text-2xl tracking-[0.04em]">
          Welcome to the house
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-gray-300">
          We have sent a confirmation link to{" "}
          <strong className="break-words text-gray-100">{form.email}</strong>.
          Open it to activate your account and start shopping.
        </p>
        <p className="mt-3 text-xs text-gray-500">
          It can take a minute to arrive. Check your spam folder if you do not
          see it.
        </p>
        <Link href="/login" className="btn-gold-ghost mt-8 inline-flex">
          Go to sign in
        </Link>
      </motion.div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {/* Honeypot. Off-screen rather than display:none, which some bots skip. */}
      <div className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden" aria-hidden>
        <label htmlFor="su-website">Leave this field empty</label>
        <input
          id="su-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => set("website")(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {/* Two-up from sm; stacked on phones so neither name field gets too
            narrow to read what you typed. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="su-first" error={errors.firstName}>
            <input
              id="su-first"
              value={form.firstName}
              onChange={(e) => set("firstName")(e.target.value)}
              autoComplete="given-name"
              required
              className={FIELD}
              placeholder="Adaeze"
              aria-invalid={Boolean(errors.firstName)}
            />
          </Field>

          <Field label="Last name" htmlFor="su-last" error={errors.lastName}>
            <input
              id="su-last"
              value={form.lastName}
              onChange={(e) => set("lastName")(e.target.value)}
              autoComplete="family-name"
              required
              className={FIELD}
              placeholder="Okafor"
              aria-invalid={Boolean(errors.lastName)}
            />
          </Field>
        </div>

        <Field label="Email address" htmlFor="su-email" error={errors.email}>
          <input
            id="su-email"
            type="email"
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
            autoComplete="email"
            required
            className={FIELD}
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Country"
            htmlFor="su-country"
            optional
            error={errors.country}
          >
            <select
              id="su-country"
              value={form.country}
              onChange={(e) => set("country")(e.target.value)}
              autoComplete="country"
              className={`${FIELD} appearance-none bg-[position:right_0.75rem_center] bg-no-repeat pr-10`}
              aria-invalid={Boolean(errors.country)}
            >
              <option value="">Select…</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Phone number"
            htmlFor="su-phone"
            optional
            error={errors.phone}
          >
            <input
              id="su-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone")(e.target.value)}
              autoComplete="tel"
              className={FIELD}
              placeholder="+234 800 000 0000"
              aria-invalid={Boolean(errors.phone)}
            />
          </Field>
        </div>

        <Field label="Password" htmlFor="su-password" error={errors.password}>
          <div className="relative">
            <input
              id="su-password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => set("password")(e.target.value)}
              onFocus={() => setTouchedPassword(true)}
              autoComplete="new-password"
              required
              className={`${FIELD} pr-12`}
              aria-invalid={Boolean(errors.password)}
              aria-describedby="su-password-rules"
            />
            <RevealButton
              shown={showPassword}
              onClick={() => setShowPassword((v) => !v)}
              label="password"
            />
          </div>
        </Field>

        {/* Requirements as a live checklist. Shown once the field has been
            touched so the form does not open under a wall of red crosses. */}
        <AnimatePresence initial={false}>
          {touchedPassword && (
            <motion.div
              id="su-password-rules"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3.5">
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                          i <= strength.score
                            ? STRENGTH_COLOUR[strength.score]
                            : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    aria-live="polite"
                    className="w-12 shrink-0 text-right text-[11px] text-gray-400"
                  >
                    {strength.label}
                  </span>
                </div>

                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {PASSWORD_RULES.map((rule) => {
                    const met = !policy.unmet.includes(rule.id);
                    return (
                      <li
                        key={rule.id}
                        className={`flex items-center gap-1.5 text-[11px] transition-colors ${
                          met ? "text-green-400" : "text-gray-500"
                        }`}
                      >
                        {met ? (
                          <Check className="h-3 w-3 shrink-0" strokeWidth={3} />
                        ) : (
                          <X className="h-3 w-3 shrink-0 opacity-50" />
                        )}
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Field
          label="Confirm password"
          htmlFor="su-confirm"
          error={errors.confirmPassword}
        >
          <div className="relative">
            <input
              id="su-confirm"
              type={showConfirm ? "text" : "password"}
              value={form.confirmPassword}
              onChange={(e) => set("confirmPassword")(e.target.value)}
              autoComplete="new-password"
              required
              className={`${FIELD} pr-12`}
              aria-invalid={Boolean(errors.confirmPassword)}
            />
            <RevealButton
              shown={showConfirm}
              onClick={() => setShowConfirm((v) => !v)}
              label="confirmed password"
            />
          </div>
        </Field>

        {/* Consent. The label wraps the whole sentence, so the tap target is
            the text rather than a 16px box. Wording is not hyperlinked yet:
            /terms and /privacy do not exist, and pointing a required consent
            control at two 404s is worse than pointing it nowhere. */}
        <div>
          <label
            htmlFor="su-terms"
            className="flex min-h-[44px] cursor-pointer items-center gap-3 py-2 text-xs leading-relaxed text-gray-400"
          >
            <input
              id="su-terms"
              type="checkbox"
              checked={form.acceptTerms}
              onChange={(e) => {
                setForm((f) => ({ ...f, acceptTerms: e.target.checked }));
                if (errors.acceptTerms) {
                  setErrors((prev) => ({ ...prev, acceptTerms: "" }));
                }
              }}
              className="h-4 w-4 shrink-0 accent-yellow-500"
              aria-invalid={Boolean(errors.acceptTerms)}
            />
            <span>
              I agree to the Terms &amp; Conditions and Privacy Policy
            </span>
          </label>
          {errors.acceptTerms && (
            <p className="mt-1.5 text-[11px] text-red-400">
              {errors.acceptTerms}
            </p>
          )}
        </div>

        <AnimatePresence initial={false}>
          {confirmMatches && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="flex items-center gap-1.5 text-[11px] text-green-400"
            >
              <Check className="h-3 w-3" strokeWidth={3} /> Passwords match
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {formError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="mt-5"
          >
            <ErrorNote>{formError}</ErrorNote>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="submit"
        disabled={pending}
        className="btn-gold mt-6 w-full disabled:opacity-60"
      >
        <span className="relative z-10 inline-flex items-center gap-2">
          {pending && <Spinner />}
          {pending ? "Creating your account…" : "Create account"}
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

      {/* The negative margin keeps the visual rhythm of the sentence while the
          padding gives the link a ~40px tap area. Inline links in prose can get
          away with being small; this one is a primary action. */}
      <p className="mt-5 text-center text-xs text-gray-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="-my-2 inline-block px-2 py-3 font-medium text-yellow-400 underline underline-offset-4 transition-colors hover:text-yellow-300"
        >
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

/** Show/hide control. Sized to 44x44 so it is a real target on touch. */
function RevealButton({
  shown,
  onClick,
  label,
}: {
  shown: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${shown ? "Hide" : "Show"} ${label}`}
      aria-pressed={shown}
      className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-r-lg text-gray-500 transition-colors hover:text-yellow-400"
    >
      {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}
