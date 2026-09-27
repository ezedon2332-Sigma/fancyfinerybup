import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

/**
 * Shared frame for the legal pages, so Privacy and Terms cannot drift apart
 * visually or from the rest of the site. Mirrors the shipping page's header
 * treatment — same wordmark, eyebrow pill and prose measure.
 */
export function PolicyPage({
  kicker,
  title,
  intro,
  updated,
  children,
}: {
  kicker: string;
  title: string;
  intro: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 lg:px-10 lg:py-24">
      <header className="mx-auto max-w-2xl text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-yellow-600/40 px-4 py-1.5 text-[10px] uppercase tracking-[0.3em] text-yellow-500">
          <ShieldCheck className="h-3 w-3" /> {kicker}
        </p>
        <h1 className="brand-wordmark mt-7 text-3xl leading-tight tracking-[0.04em] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-gray-300 sm:text-base">
          {intro}
        </p>
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-gray-500">
          Last updated {updated}
        </p>
      </header>
      <div className="mt-14 space-y-10">{children}</div>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg uppercase tracking-[0.2em] text-yellow-500 sm:text-xl">
        {heading}
      </h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-gray-300">
        {children}
      </div>
    </section>
  );
}
