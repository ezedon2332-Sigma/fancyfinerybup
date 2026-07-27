"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Ruler, X } from "lucide-react";

import {
  MEASURE_STEPS,
  cmToFeetInches,
  type SizeChart,
} from "@/domain/sizing";

/**
 * Size guide. Loaded on demand by SizeAndFit via next/dynamic — the table and
 * measuring copy are dead weight for the majority of visitors who never open
 * it, and it is not needed for first paint.
 *
 * Default-exported because that is what next/dynamic resolves.
 */
export default function SizeGuideModal({
  chart,
  onClose,
  highlight,
}: {
  chart: SizeChart;
  onClose: () => void;
  /** Recommended size, so the shopper can find their row immediately. */
  highlight?: string | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  const [unit, setUnit] = useState<"cm" | "in">("cm");

  useEffect(() => {
    restore.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const f = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restore.current?.focus?.();
    };
  }, [onClose]);

  /** Centimetres, or inches to one decimal. */
  const v = (cm: number) => (unit === "cm" ? cm : Math.round((cm / 2.54) * 10) / 10);
  const range = (r?: [number, number]) => (r ? `${v(r[0])}–${v(r[1])}` : "—");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="size-guide-title"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-yellow-600/30 bg-[#0a0a0a] sm:rounded-2xl"
      >
        <header className="sticky top-0 flex items-start justify-between gap-4 border-b border-white/10 bg-[#0a0a0a] px-5 py-4 sm:px-7">
          <div>
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-yellow-500">
              <Ruler className="h-3 w-3" /> Size Guide
            </p>
            <h2 id="size-guide-title" className="mt-1.5 font-display text-xl text-white sm:text-2xl">
              {chart.name}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-full border border-white/15 text-[10px]">
              {(["cm", "in"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  aria-pressed={unit === u}
                  className={`px-3 py-1.5 uppercase tracking-widest transition-colors ${
                    unit === u ? "bg-yellow-500 text-black" : "text-gray-400 hover:text-yellow-400"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close size guide"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/5 hover:text-yellow-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="px-5 py-5 sm:px-7">
          {/* Garment measurements. Scrolls inside its own container so the
              modal body never scrolls sideways. */}
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[520px] text-left text-sm">
              <caption className="sr-only">
                Body measurements by size, in {unit === "cm" ? "centimetres" : "inches"}
              </caption>
              <thead className="bg-white/[0.03] text-[9px] uppercase tracking-[0.16em] text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Size</th>
                  <th scope="col" className="px-3 py-3">Chest</th>
                  <th scope="col" className="px-3 py-3">Waist</th>
                  <th scope="col" className="px-3 py-3">Hip</th>
                  <th scope="col" className="px-3 py-3">Sleeve</th>
                  <th scope="col" className="px-3 py-3">Inseam</th>
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((r) => {
                  const on = highlight === r.size;
                  return (
                    <tr
                      key={r.size}
                      className={`border-t border-white/[0.06] ${
                        on ? "bg-yellow-500/10" : ""
                      }`}
                    >
                      <th
                        scope="row"
                        className={`px-4 py-2.5 text-sm font-semibold ${
                          on ? "text-yellow-300" : "text-gray-200"
                        }`}
                      >
                        {r.size}
                        {on && (
                          <span className="ml-2 rounded-full border border-yellow-500/50 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-yellow-400">
                            You
                          </span>
                        )}
                      </th>
                      <td className="px-3 py-2.5 tabular-nums text-gray-400">{range(r.chestCm)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-gray-400">{range(r.waistCm)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-gray-400">{range(r.hipCm)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-gray-400">
                        {r.sleeveCm ? v(r.sleeveCm) : "—"}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-gray-400">
                        {r.inseamCm ? v(r.inseamCm) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] text-gray-500">
            Measurements are of the body, not the garment. Fit allowance is
            already drafted in.
          </p>

          {/* How to measure. Text instructions rather than illustrations —
              see the note in the commit; diagrams need artwork we do not have. */}
          <h3 className="mt-8 text-[10px] uppercase tracking-[0.28em] text-yellow-500">
            How to measure
          </h3>
          <dl className="mt-4 space-y-3.5">
            {MEASURE_STEPS.map((s) => (
              <div key={s.part} className="flex gap-3">
                <dt className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-300">
                  {s.part}
                </dt>
                <dd className="flex-1 text-xs leading-relaxed text-gray-400">{s.how}</dd>
              </div>
            ))}
          </dl>

          <h3 className="mt-8 text-[10px] uppercase tracking-[0.28em] text-yellow-500">
            Height reference
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {chart.rows.map((r) => (
              <span
                key={r.size}
                className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-gray-400"
              >
                <strong className="text-gray-200">{r.size}</strong>{" "}
                {r.heightCm[0]}–{r.heightCm[1]} cm
                <span className="ml-1 text-gray-600">
                  ({cmToFeetInches(r.heightCm[0])}–{cmToFeetInches(r.heightCm[1])})
                </span>
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
