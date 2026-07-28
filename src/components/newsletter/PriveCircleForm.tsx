"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, Sparkles } from "lucide-react";

import { joinPriveCircle, type JoinResult } from "@/app/newsletter/actions";
import { COUNTRIES } from "@/domain/shipping/countries";
import {
  CONSENT_TEXT,
  FASHION_INTERESTS,
  type SubscriberSource,
} from "@/domain/newsletter";

/** The join form itself. Shared verbatim by the homepage section and the VIP
 *  invitation modal — `source` is what tells them apart in the database. */
export function PriveCircleForm({
  source,
  compact = false,
  onJoined,
}: {
  source: SubscriberSource;
  compact?: boolean;
  onJoined?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<JoinResult | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);

  const toggle = (id: string) =>
    setInterests((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await joinPriveCircle({
        firstName: String(fd.get("firstName") ?? ""),
        lastName: String(fd.get("lastName") ?? "") || null,
        email: String(fd.get("email") ?? ""),
        country: String(fd.get("country") ?? "") || null,
        birthday: String(fd.get("birthday") ?? "") || null,
        interests,
        consent,
        source,
        website: String(fd.get("website") ?? ""),
      });
      setResult(res);
      if (res.ok) onJoined?.();
    });
  }

  if (result?.ok) return <JoinSuccess kind={result.kind} />;

  const err = (k: string) => result?.fieldErrors?.[k];

  return (
    <form onSubmit={onSubmit} noValidate className="text-left">
      {/* Honeypot — hidden from humans, harvested by bots */}
      <div aria-hidden className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
        <label htmlFor={`website-${source}`}>Leave this field empty</label>
        <input id={`website-${source}`} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First Name" error={err("firstName")} htmlFor={`fn-${source}`}>
          <input
            id={`fn-${source}`}
            name="firstName"
            required
            autoComplete="given-name"
            className={inputCls}
            placeholder="Adaeze"
          />
        </Field>
        <Field label="Last Name" optional error={err("lastName")} htmlFor={`ln-${source}`}>
          <input
            id={`ln-${source}`}
            name="lastName"
            autoComplete="family-name"
            className={inputCls}
            placeholder="Okafor"
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Email Address" error={err("email")} htmlFor={`em-${source}`}>
          <input
            id={`em-${source}`}
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputCls}
            placeholder="you@example.com"
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Country" error={err("country")} htmlFor={`co-${source}`}>
          <select id={`co-${source}`} name="country" defaultValue="" className={inputCls}>
            <option value="">Select your country</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.name} className="bg-neutral-950">
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Birthday" optional error={err("birthday")} htmlFor={`bd-${source}`}>
          <input
            id={`bd-${source}`}
            name="birthday"
            type="date"
            className={`${inputCls} [color-scheme:dark]`}
          />
        </Field>
      </div>

      <fieldset className={compact ? "mt-5" : "mt-6"}>
        <legend className="text-[10px] uppercase tracking-[0.28em] text-yellow-500/90">
          Fashion Interests
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {FASHION_INTERESTS.map((i) => {
            const on = interests.includes(i.id);
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => toggle(i.id)}
                aria-pressed={on}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-xs transition-all duration-300 ${
                  on
                    ? "border-yellow-500 bg-yellow-500/15 text-yellow-200"
                    : "border-white/15 text-gray-300 hover:border-yellow-600/60 hover:text-yellow-100"
                }`}
              >
                <span
                  className={`flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border transition-colors ${
                    on ? "border-yellow-400 bg-yellow-400" : "border-white/30"
                  }`}
                >
                  {on && <Check className="h-2.5 w-2.5 text-black" strokeWidth={4} />}
                </span>
                {i.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="mt-6 flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-gray-400">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-yellow-500"
        />
        <span>{CONSENT_TEXT}</span>
      </label>
      {err("consent") && <p className={errCls}>{err("consent")}</p>}

      {result?.error && (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          {result.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-gold mt-7 w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="relative z-10 inline-flex items-center gap-2">
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Joining…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Join the Privé Circle
            </>
          )}
        </span>
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/12 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors duration-300 placeholder:text-gray-600 focus:border-yellow-500/70 focus:bg-white/[0.06]";

const errCls = "mt-1.5 text-[11px] text-red-400";

function Field({
  label,
  optional,
  error,
  htmlFor,
  children,
}: {
  label: string;
  optional?: boolean;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-[10px] uppercase tracking-[0.24em] text-gray-400"
      >
        {label}
        {optional && <span className="ml-1.5 text-gray-600">(optional)</span>}
      </label>
      {children}
      {error && <p className={errCls}>{error}</p>}
    </div>
  );
}

/** Confirmation shown in place of the form once a member joins. */
function JoinSuccess({ kind }: { kind?: JoinResult["kind"] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="py-8 text-center"
      role="status"
      aria-live="polite"
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-yellow-500/50 bg-gradient-to-br from-yellow-500/25 to-transparent"
      >
        <motion.span
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.4 }}
        >
          <Check className="h-9 w-9 text-yellow-400" strokeWidth={1.5} />
        </motion.span>
      </motion.div>

      <h3 className="brand-wordmark mt-7 text-2xl tracking-[0.06em] sm:text-3xl">
        {kind === "already" ? "You are already with us" : "Welcome to the Privé Circle"}
      </h3>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-gray-300">
        {kind === "already"
          ? "This address is already part of the Fancy Finery Privé Circle. Your preferences have been updated."
          : "Your journey into exclusive luxury begins now. A welcome note is on its way to your inbox."}
      </p>
    </motion.div>
  );
}
