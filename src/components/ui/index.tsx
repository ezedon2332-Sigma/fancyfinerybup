import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";

/**
 * Shared UI primitives.
 *
 * The point is leverage: page-level consistency comes from a small set of
 * pieces everything else composes, not from restyling twenty screens by hand
 * and hoping they match. Every value here is drawn from the existing palette —
 * black grounds, gold accents, hairline white borders — so adopting these
 * changes proportions and rhythm without touching brand colour.
 *
 * Server-safe: no hooks, no client directive, so these render inside server
 * components too. Anything needing state lives in its own client file.
 */

// --- Spacing scale ----------------------------------------------------------
// One source of truth for page rhythm. Screens differed by 20-30px of padding
// for no reason, which is most of what reads as "inconsistent".
export const PAGE = "mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-10";
export const SECTION = "py-14 sm:py-16 lg:py-20";

// --- Type -------------------------------------------------------------------

export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  actions?: React.ReactNode;
  align?: "left" | "center";
}) {
  const centred = align === "center";
  return (
    <header
      className={`flex flex-wrap items-end justify-between gap-4 ${
        centred ? "flex-col items-center text-center" : ""
      }`}
    >
      <div className={centred ? "max-w-2xl" : "min-w-0"}>
        {eyebrow && (
          <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-500">
            {eyebrow}
          </p>
        )}
        <h1
          className={`font-display text-white ${
            centred ? "mt-5 text-3xl sm:text-4xl" : "mt-2 text-2xl sm:text-3xl"
          }`}
        >
          {title}
        </h1>
        {lead && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400">
            {lead}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  href,
  hrefLabel = "View all",
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="text-[10px] uppercase tracking-[0.28em] text-yellow-500">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-2 font-display text-2xl text-white sm:text-[28px]">
          {title}
        </h2>
      </div>
      {href && (
        <Link
          href={href}
          className="text-[11px] uppercase tracking-[0.16em] text-gray-400 underline decoration-yellow-600/40 underline-offset-4 transition-colors hover:text-yellow-400"
        >
          {hrefLabel}
        </Link>
      )}
    </div>
  );
}

// --- Surfaces ---------------------------------------------------------------

export function Card({
  children,
  className = "",
  interactive = false,
  as: As = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** Adds the lift-and-warm hover used on anything clickable. */
  interactive?: boolean;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <As
      className={`rounded-xl border border-white/10 bg-white/[0.025] backdrop-blur-sm ${
        interactive
          ? "transition-all duration-500 hover:-translate-y-0.5 hover:border-yellow-600/45 hover:shadow-[0_16px_40px_-24px_rgba(212,175,55,0.5)]"
          : ""
      } ${className}`}
    >
      {children}
    </As>
  );
}

/** Headline number for dashboards. */
export function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="p-5">
      {icon && <div className="text-yellow-500">{icon}</div>}
      <p className="mt-3 text-2xl font-semibold tabular-nums text-white">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-widest text-gray-500">
        {label}
      </p>
      {sub && <p className="mt-1.5 text-[11px] text-gray-600">{sub}</p>}
    </Card>
  );
}

// --- Feedback ---------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="text-yellow-600">{icon}</div>}
      <p className="mt-4 font-display text-lg text-white">{title}</p>
      {body && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-400">
          {body}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </Card>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-300"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {children}
    </p>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-yellow-600/30 bg-yellow-500/[0.06] px-4 py-3 text-xs leading-relaxed text-yellow-100">
      {children}
    </p>
  );
}

/**
 * Skeletons rather than spinners wherever the final height is known: the box
 * holds its space, so content below does not jump when data lands. A spinner
 * guarantees a layout shift.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.07] ${className}`} />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden />;
}

// --- Badges -----------------------------------------------------------------

type Tone = "gold" | "green" | "red" | "neutral" | "blue";

const TONES: Record<Tone, string> = {
  gold: "border-yellow-600/40 bg-yellow-500/10 text-yellow-300",
  green: "border-green-500/40 bg-green-500/10 text-green-300",
  red: "border-red-500/40 bg-red-500/10 text-red-300",
  blue: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
  neutral: "border-white/15 bg-white/5 text-gray-300",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

// --- Form fields ------------------------------------------------------------
// Exported as class strings rather than components so they compose with server
// forms, native validation and existing markup without rewriting call sites.

export const FIELD =
  "min-h-[44px] w-full rounded-lg border border-white/12 bg-white/[0.03] px-3.5 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-yellow-500/70 focus:bg-white/[0.05]";

export const LABEL =
  "mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-gray-400";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
        {optional && <span className="ml-1.5 text-gray-600">(optional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1.5 text-[11px] text-gray-600">{hint}</p>
      )}
      {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

// --- Tables -----------------------------------------------------------------
// Admin tables were each hand-rolled with slightly different padding and
// header casing. These keep them identical.

export const TABLE_WRAP = "overflow-x-auto rounded-xl border border-white/10";
export const TABLE = "w-full text-left text-sm";
export const THEAD =
  "bg-white/[0.03] text-[10px] uppercase tracking-widest text-gray-400";
export const TH = "px-4 py-3 font-medium";
export const TR = "border-t border-white/5 transition-colors hover:bg-white/[0.02]";
export const TD = "px-4 py-3 text-gray-300";
