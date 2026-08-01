"use client";

import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, MapPin, Truck } from "lucide-react";

import {
  fetchNgDestinations,
  fetchNgStates,
} from "@/app/checkout/nigeria-actions";
import {
  resolveStep,
  sortDestinations,
  sortStates,
  type NgDestination,
  type NgState,
} from "@/domain/shipping/nigeria";
import { formatMinor } from "@/domain/shared/display-price";
import { Field } from "@/components/ui";
import { SelectMenu } from "@/components/ui/SelectMenu";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Nigeria local delivery: state, then area, then the fee.
 *
 * Only the next required choice is ever on screen. Which choice that is comes
 * from `resolveStep` in the domain rather than a pile of conditionals here, so
 * the rule stays in one place and stays tested — including the awkward cases,
 * like an area that was withdrawn after the customer picked it.
 *
 * Fees are shown in naira because that is what they are: local delivery is
 * priced in naira regardless of the currency the shopper is browsing in, and
 * the order summary above shows the converted figure.
 */
export function NigeriaDelivery({
  countryCode,
  destinationId,
  onChange,
  onStateName,
  onAvailable,
}: {
  countryCode: string;
  destinationId: string | null;
  /** Reports the chosen area up so the quote and the order both carry it. */
  onChange: (destinationId: string | null) => void;
  /** Mirrors the state name into the address, which is stored as text. */
  onStateName: (name: string) => void;
  /**
   * Reports whether this picker actually has data. False before the migration
   * has been applied, or if the states read fails — checkout then keeps its
   * ordinary text field so a Nigerian customer is never left with no way to
   * enter a state at all.
   */
  onAvailable: (available: boolean) => void;
}) {
  const [states, setStates] = useState<NgState[]>([]);
  const [stateId, setStateId] = useState("");
  // Keyed by the state it belongs to, so the list is DERIVED rather than kept
  // in step by hand. Clearing it in an effect was both a lint error and a real
  // hazard: for one render Kano would show Lagos prices.
  const [fetched, setFetched] = useState<{
    stateId: string;
    rows: NgDestination[];
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const applicable = countryCode.trim().toUpperCase() === "NG";

  // States load once, when Nigeria is first selected.
  useEffect(() => {
    if (!applicable || states.length > 0) return;
    let live = true;
    fetchNgStates().then((rows) => {
      if (!live) return;
      setStates(sortStates(rows));
      onAvailable(rows.length > 0);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onAvailable is a fresh closure each render; including it would refetch forever
  }, [applicable, states.length]);

  // Areas load per state. Clearing the selection first matters: without it a
  // Lagos area stays attached while Kano's list arrives, and for that moment
  // the summary shows a fee for somewhere the customer is not shipping to.
  const loaded = fetched !== null && fetched.stateId === stateId;
  const destinations = loaded ? fetched.rows : [];

  useEffect(() => {
    if (!applicable || !stateId) return;
    let live = true;
    onChange(null);
    startTransition(async () => {
      const rows = await fetchNgDestinations(stateId);
      if (live) setFetched({ stateId, rows: sortDestinations(rows) });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onChange is a fresh closure each render; re-running on it would loop
  }, [applicable, stateId]);

  // Keep the stored address in step with the picker. The order holds the state
  // as text, so a Lagos order must read "Lagos" whether it was typed or chosen.
  const selectedStateName = states.find((s) => s.id === stateId)?.name ?? "";
  useEffect(() => {
    if (applicable && selectedStateName) onStateName(selectedStateName);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onStateName is a fresh closure each render
  }, [applicable, selectedStateName]);

  if (!applicable || states.length === 0) return null;

  const step = resolveStep({
    countryCode,
    stateId,
    destinationId,
    destinations,
    loaded,
  });

  const stateName = selectedStateName;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="rounded-xl border border-yellow-600/25 bg-white/[0.02] p-4 sm:p-5"
    >
      <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-yellow-500">
        <Truck className="h-3.5 w-3.5" /> Delivery within Nigeria
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="State" htmlFor="ng-state">
          <SelectMenu
            id="ng-state"
            value={stateId}
            onChange={setStateId}
            ariaLabel="Delivery state"
            placeholder="Select your state…"
            options={states.map((s) => ({ value: s.id, label: s.name }))}
          />
        </Field>

        {/* The area selector only exists once a state is chosen — an empty
            second dropdown is a question the customer cannot answer yet. */}
        <AnimatePresence initial={false} mode="wait">
          {stateId && (
            <motion.div
              key="area"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              <Field label="Delivery area" htmlFor="ng-destination">
                <div className="relative">
                  <SelectMenu
                    id="ng-destination"
                    value={destinationId ?? ""}
                    onChange={(v) => onChange(v || null)}
                    disabled={!loaded || destinations.length === 0}
                    ariaLabel="Delivery area"
                    placeholder={loaded ? "Select your area…" : "Loading areas…"}
                    /* The fee rides alongside the name rather than being glued
                       into the label, so it stays right-aligned and legible
                       even at 320px. */
                    options={destinations.map((d) => ({
                      value: d.id,
                      label: d.name,
                      hint: formatMinor(d.priceKobo, "NGN"),
                    }))}
                  />
                  {pending && (
                    <Loader2 className="pointer-events-none absolute right-10 top-[26px] h-3.5 w-3.5 -translate-y-1/2 animate-spin text-gray-500" />
                  )}
                </div>
              </Field>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false} mode="wait">
        {step.step === "no-destinations" && (
          <motion.p
            key="none"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="mt-4 overflow-hidden rounded-lg border border-amber-500/40 bg-amber-500/[0.06] px-3.5 py-3 text-[11px] leading-relaxed text-amber-200"
          >
            We have not published fixed rates for {stateName} yet. Your delivery
            is being quoted by weight instead — the figure in your order summary
            is the one you will pay.
          </motion.p>
        )}

        {step.step === "resolved" && (
          <motion.dl
            key="resolved"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="mt-4 overflow-hidden"
          >
            <div className="space-y-2 rounded-lg border border-green-500/30 bg-green-500/[0.05] px-3.5 py-3 text-xs">
              <Row label="State" value={stateName} />
              <Row label="Destination" value={step.destination.name} />
              <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-2">
                <dt className="flex items-center gap-1.5 text-gray-300">
                  <MapPin className="h-3 w-3 text-green-400" /> Delivery fee
                </dt>
                <dd className="font-semibold tabular-nums text-green-300">
                  {formatMinor(step.destination.priceKobo, "NGN")}
                </dd>
              </div>
              <p className="flex items-center gap-1.5 pt-0.5 text-[10px] text-gray-500">
                <Check className="h-3 w-3 text-green-400" />
                Applied to your order summary.
              </p>
            </div>
          </motion.dl>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-400">{label}</dt>
      <dd className="truncate text-right text-gray-100">{value}</dd>
    </div>
  );
}
