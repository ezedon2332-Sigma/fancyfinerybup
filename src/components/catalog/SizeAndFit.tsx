"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Ruler, Sparkles } from "lucide-react";

import {
  HEIGHT_OPTIONS_CM,
  WEIGHT_OPTIONS_KG,
  cmToFeetInches,
  fitLabel,
  fitNote,
  kgToLb,
  recommendSize,
  type SizeChart,
} from "@/domain/sizing";

/** Loaded only when the guide is opened. The table and measuring copy are
 *  dead weight for the many visitors who never open it. */
const SizeGuideModal = dynamic(() => import("./SizeGuideModal"), { ssr: false });

export interface SizeOption {
  /** Variant id to select when this size is chosen. */
  id: string;
  size: string;
  colour: string | null;
  stockQty: number;
}

/**
 * Size & fit. Owns size selection, so the parent gets a variant id back and
 * keeps its existing add-to-bag validation — nothing can be added without a
 * size because the parent still refuses a null variant.
 */
export function SizeAndFit({
  options,
  chart,
  selectedId,
  onSelect,
  fitType,
  model,
}: {
  options: SizeOption[];
  chart: SizeChart;
  selectedId: string | null;
  onSelect: (variantId: string) => void;
  fitType?: string | null;
  model?: { heightCm: number; weightKg: number; size: string } | null;
}) {
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [unit, setUnit] = useState<"metric" | "imperial">("metric");
  const [guideOpen, setGuideOpen] = useState(false);

  // Sizes this product actually stocks, in chart order rather than insertion
  // order, so the row reads XS -> 5XL however the variants were created.
  const sizes = useMemo(() => {
    const order = chart.rows.map((r) => r.size);
    const seen = new Map<string, SizeOption>();
    for (const o of options) {
      // Prefer an in-stock variant when a size appears more than once.
      const prev = seen.get(o.size);
      if (!prev || (prev.stockQty <= 0 && o.stockQty > 0)) seen.set(o.size, o);
    }
    return [...seen.values()].sort(
      (a, b) => order.indexOf(a.size) - order.indexOf(b.size),
    );
  }, [options, chart]);

  const stockedSizes = useMemo(
    () => sizes.filter((s) => s.stockQty > 0).map((s) => s.size),
    [sizes],
  );

  const recommendation = useMemo(() => {
    if (heightCm === null || weightKg === null) return null;
    return recommendSize(chart, heightCm, weightKg, stockedSizes);
  }, [chart, heightCm, weightKg, stockedSizes]);

  const selected = sizes.find((s) => s.id === selectedId) ?? null;
  const note = fitType ? fitNote(fitType) : null;

  return (
    <section className="mt-8" aria-labelledby="size-fit-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="size-fit-heading"
          className="text-xs uppercase tracking-widest text-gray-400"
        >
          Size &amp; Fit
          <span aria-hidden className="ml-1 text-yellow-500">
            *
          </span>
        </h2>
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-yellow-500 underline decoration-yellow-600/40 underline-offset-4 transition-colors hover:text-yellow-300"
        >
          <Ruler className="h-3.5 w-3.5" /> Size Guide
        </button>
      </div>

      {fitType && (
        <p className="mt-2 text-xs text-gray-400">
          <span className="text-gray-200">{fitLabel(fitType)}</span>
          {note && <span className="text-gray-500"> — {note}</span>}
        </p>
      )}

      {/* Size row */}
      {sizes.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Select a size">
          {sizes.map((s) => {
            const out = s.stockQty <= 0;
            const isSel = s.id === selectedId;
            const isRec = recommendation?.size === s.size && !isSel;
            return (
              <button
                key={s.id}
                type="button"
                disabled={out}
                onClick={() => onSelect(s.id)}
                aria-pressed={isSel}
                aria-label={`Size ${s.size}${out ? ", out of stock" : ""}`}
                className={`relative flex min-h-[44px] min-w-[52px] items-center justify-center rounded-lg border px-4 text-sm transition-all duration-200 ${
                  isSel
                    ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
                    : isRec
                      ? "border-yellow-600/60 text-gray-100"
                      : "border-white/20 text-gray-200 hover:border-yellow-500/70"
                } ${out ? "cursor-not-allowed text-gray-600 line-through opacity-50" : ""}`}
              >
                {s.size}
                {isRec && (
                  <span
                    aria-hidden
                    className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-yellow-400"
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">
          This piece is one size. Add it to your bag below.
        </p>
      )}

      {selected?.colour && (
        <p className="mt-2 text-[11px] text-gray-500">Colour: {selected.colour}</p>
      )}

      {/* Find-my-size */}
      {sizes.length > 0 && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500">
              Find my size
            </p>
            <div className="flex overflow-hidden rounded-full border border-white/15 text-[9px]">
              {(
                [
                  ["metric", "cm / kg"],
                  ["imperial", "ft / lb"],
                ] as const
              ).map(([u, label]) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  aria-pressed={unit === u}
                  className={`px-2.5 py-1.5 uppercase tracking-widest transition-colors ${
                    unit === u ? "bg-yellow-500 text-black" : "text-gray-400 hover:text-yellow-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-gray-500">
                Height
              </span>
              <select
                value={heightCm ?? ""}
                onChange={(e) =>
                  setHeightCm(e.target.value ? Number(e.target.value) : null)
                }
                className={SELECT}
              >
                <option value="" className="bg-neutral-950">
                  Select height
                </option>
                {HEIGHT_OPTIONS_CM.map((cm) => (
                  <option key={cm} value={cm} className="bg-neutral-950">
                    {unit === "metric"
                      ? `${cm} cm${cm === 200 ? "+" : ""}`
                      : `${cmToFeetInches(cm)}${cm === 200 ? "+" : ""}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-gray-500">
                Weight
              </span>
              <select
                value={weightKg ?? ""}
                onChange={(e) =>
                  setWeightKg(e.target.value ? Number(e.target.value) : null)
                }
                className={SELECT}
              >
                <option value="" className="bg-neutral-950">
                  Select weight
                </option>
                {WEIGHT_OPTIONS_KG.map((kg) => (
                  <option key={kg} value={kg} className="bg-neutral-950">
                    {unit === "metric"
                      ? `${kg} kg${kg === 180 ? "+" : ""}`
                      : `${kgToLb(kg)} lb${kg === 180 ? "+" : ""}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <AnimatePresence mode="wait">
            {recommendation && (
              <motion.div
                key={recommendation.size + recommendation.basis}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
                className="mt-4 rounded-lg border border-yellow-600/40 bg-yellow-500/[0.07] p-3.5"
                role="status"
                aria-live="polite"
              >
                <p className="flex items-center gap-2 text-sm text-yellow-100">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
                  Recommended size:{" "}
                  <strong className="font-semibold text-yellow-300">
                    {recommendation.size}
                  </strong>
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
                  {recommendation.reason}
                </p>
                {selected?.size !== recommendation.size && (
                  <button
                    type="button"
                    onClick={() => {
                      const match = sizes.find(
                        (s) => s.size === recommendation.size && s.stockQty > 0,
                      );
                      if (match) onSelect(match.id);
                    }}
                    className="mt-2.5 inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-yellow-500/60 px-3 text-[10px] uppercase tracking-[0.16em] text-yellow-400 transition-colors hover:bg-yellow-500/10"
                  >
                    <Check className="h-3 w-3" /> Select {recommendation.size}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-3 text-[10px] leading-relaxed text-gray-600">
            A guide, not a guarantee — bodies differ. Check the size guide if you
            are between sizes.
          </p>
        </div>
      )}

      {model && (
        <p className="mt-4 text-[11px] italic leading-relaxed text-gray-500">
          Model is {model.heightCm} cm tall, weighs {model.weightKg} kg, and is
          wearing size {model.size}.
        </p>
      )}

      <AnimatePresence>
        {guideOpen && (
          <SizeGuideModal
            chart={chart}
            highlight={recommendation?.size ?? selected?.size ?? null}
            onClose={() => setGuideOpen(false)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

const SELECT =
  "min-h-[44px] w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 text-sm text-white outline-none transition-colors focus:border-yellow-500/70";
