"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";

import {
  adminDeleteDestination,
  adminDeleteState,
  adminListDestinations,
  adminSaveDestination,
  adminSaveState,
  adminToggleDestination,
} from "@/app/admin/shipping/nigeria/actions";
import { matchesQuery, type NgDestination } from "@/domain/shipping/nigeria";
import type { AdminNgState } from "@/domain/entities/shipping-views";
import { formatMinor } from "@/domain/shared/display-price";
import { Card, EmptyState, FIELD, Spinner } from "@/components/ui";
import { toast } from "@/components/ui/Toast";

const EASE = [0.22, 1, 0.36, 1] as const;

type Draft = {
  id?: string;
  name: string;
  priceNaira: string;
  enabled: boolean;
};

const BLANK: Draft = { name: "", priceNaira: "", enabled: true };

/**
 * Nigeria shipping management.
 *
 * Two panes: states on the left, the selected state's areas on the right. The
 * areas for one state are fetched when it is opened rather than everything up
 * front — the table is meant to hold thousands of rows, and a management screen
 * that degrades as the data grows is the thing this replaces.
 */
export function NigeriaShippingPanel({ states }: { states: AdminNgState[] }) {
  const [selected, setSelected] = useState<AdminNgState | null>(
    states.find((s) => s.destinationCount > 0) ?? states[0] ?? null,
  );
  // Keyed by state, so the visible list is derived rather than synced — the
  // same reason as on the checkout side.
  const [fetched, setFetched] = useState<{
    stateId: string;
    rows: NgDestination[];
  } | null>(null);
  const [stateQuery, setStateQuery] = useState("");
  const [areaQuery, setAreaQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();

  const stateId = selected?.id ?? null;

  const loading = stateId !== null && fetched?.stateId !== stateId;
  // Memoised so the empty-array branch does not mint a new reference on every
  // render and re-run every filter downstream.
  const destinations = useMemo(
    () => (fetched?.stateId === stateId ? fetched.rows : []),
    [fetched, stateId],
  );

  useEffect(() => {
    if (!stateId) return;
    let live = true;
    adminListDestinations(stateId).then((rows) => {
      if (live) setFetched({ stateId, rows });
    });
    return () => {
      live = false;
    };
  }, [stateId]);

  const refresh = () => {
    if (!stateId) return;
    adminListDestinations(stateId).then((rows) => setFetched({ stateId, rows }));
  };

  const visibleStates = useMemo(
    () => states.filter((s) => matchesQuery(s.name, stateQuery)),
    [states, stateQuery],
  );
  const visibleAreas = useMemo(
    () => destinations.filter((d) => matchesQuery(d.name, areaQuery)),
    [destinations, areaQuery],
  );

  function save() {
    if (!draft || !stateId) return;
    startTransition(async () => {
      const res = await adminSaveDestination({
        id: draft.id,
        stateId,
        name: draft.name,
        priceNaira: Number(draft.priceNaira),
        enabled: draft.enabled,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not save.");
        return;
      }
      setDraft(null);
      refresh();
    });
  }

  function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Customers can no longer choose it.`)) return;
    startTransition(async () => {
      const res = await adminDeleteDestination(id);
      if (!res.ok) toast.error(res.error ?? "Could not delete.");
      else refresh();
    });
  }

  function toggle(d: NgDestination) {
    // Optimistic: the row flips immediately and is corrected by the refetch if
    // the write fails, because a checkbox that waits on a round trip feels
    // broken when you are working through thirty of them.
    setFetched((prev) =>
      prev && prev.stateId === stateId
        ? {
            ...prev,
            rows: prev.rows.map((r) =>
              r.id === d.id ? { ...r, enabled: !r.enabled } : r,
            ),
          }
        : prev,
    );
    startTransition(async () => {
      const res = await adminToggleDestination(d.id, !d.enabled);
      if (!res.ok) toast.error(res.error ?? "Could not update.");
      refresh();
    });
  }

  async function addState() {
    const name = prompt("New state name");
    if (!name) return;
    const res = await adminSaveState({ name, code: null, enabled: true });
    if (!res.ok) toast.error(res.error ?? "Could not add that state.");
  }

  async function removeState(s: AdminNgState) {
    if (
      !confirm(
        `Delete ${s.name} and its ${s.destinationCount} destination(s)? This cannot be undone.`,
      )
    ) {
      return;
    }
    const res = await adminDeleteState(s.id);
    if (!res.ok) toast.error(res.error ?? "Could not delete that state.");
  }

  return (
    <div className="mt-6">

      {/* Stacks on phones, two panes from lg — a master/detail split is
          unusable at 390px, where each pane would be under 200px wide. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        {/* States ------------------------------------------------------ */}
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-300">
              States
            </h2>
            <button
              type="button"
              onClick={addState}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-yellow-600/40 px-2.5 text-[11px] text-yellow-400 transition-colors hover:bg-yellow-500/10"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-600" />
            <input
              value={stateQuery}
              onChange={(e) => setStateQuery(e.target.value)}
              placeholder="Search states"
              aria-label="Search states"
              className={`${FIELD} pl-9`}
            />
          </div>

          <ul className="mt-3 max-h-[26rem] space-y-1 overflow-y-auto pr-1">
            {visibleStates.map((s) => {
              const active = s.id === stateId;
              return (
                <li key={s.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(s);
                      setDraft(null);
                      setAreaQuery("");
                    }}
                    className={`flex min-h-[44px] flex-1 items-center justify-between gap-2 rounded-lg px-3 text-left text-sm transition-colors ${
                      active
                        ? "bg-yellow-500/10 text-yellow-300"
                        : "text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    <span className="truncate">{s.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] tabular-nums ${
                        s.destinationCount > 0
                          ? "bg-white/8 text-gray-300"
                          : "text-gray-600"
                      }`}
                    >
                      {s.destinationCount}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeState(s)}
                    aria-label={`Delete ${s.name}`}
                    className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
            {visibleStates.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-gray-500">
                No state matches “{stateQuery}”.
              </li>
            )}
          </ul>
        </Card>

        {/* Destinations ------------------------------------------------ */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-300">
              {selected ? `${selected.name} destinations` : "Destinations"}
            </h2>
            <button
              type="button"
              disabled={!selected}
              onClick={() => setDraft({ ...BLANK })}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-yellow-600/40 px-2.5 text-[11px] text-yellow-400 transition-colors hover:bg-yellow-500/10 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Add destination
            </button>
          </div>

          {selected && destinations.length > 0 && (
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-600" />
              <input
                value={areaQuery}
                onChange={(e) => setAreaQuery(e.target.value)}
                placeholder={`Search ${selected.name} destinations`}
                aria-label="Search destinations"
                className={`${FIELD} pl-9`}
              />
            </div>
          )}

          <AnimatePresence initial={false}>
            {draft && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="mt-3 rounded-lg border border-yellow-600/30 bg-white/[0.02] p-3">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
                    <input
                      value={draft.name}
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
                      placeholder="Destination, e.g. Lekki"
                      aria-label="Destination name"
                      className={FIELD}
                    />
                    <input
                      value={draft.priceNaira}
                      onChange={(e) =>
                        setDraft({ ...draft, priceNaira: e.target.value })
                      }
                      inputMode="numeric"
                      placeholder="Fee ₦"
                      aria-label="Delivery fee in naira"
                      className={FIELD}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <label className="flex min-h-[36px] cursor-pointer items-center gap-2 text-xs text-gray-400">
                      <input
                        type="checkbox"
                        checked={draft.enabled}
                        onChange={(e) =>
                          setDraft({ ...draft, enabled: e.target.checked })
                        }
                        className="h-4 w-4 accent-yellow-500"
                      />
                      Available to customers
                    </label>
                    <div className="ml-auto flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDraft(null)}
                        className="inline-flex min-h-[36px] items-center rounded-lg border border-white/15 px-3 text-xs text-gray-300 hover:border-white/30"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={save}
                        disabled={pending}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-yellow-500/60 bg-yellow-500/15 px-3 text-xs font-semibold text-yellow-200 disabled:opacity-50"
                      >
                        {pending && <Spinner />} Save
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!selected ? (
            <div className="mt-4">
              <EmptyState title="Pick a state" body="Choose a state to manage its delivery areas." />
            </div>
          ) : loading ? (
            <p className="mt-6 flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
              destinations…
            </p>
          ) : destinations.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title={`No destinations in ${selected.name}`}
                body="Add one and customers shipping there will be quoted that flat fee. Until then this state is quoted by weight."
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-white/6">
              {visibleAreas.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
                >
                  <label className="flex min-h-[36px] cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={() => toggle(d)}
                      aria-label={`${d.enabled ? "Disable" : "Enable"} ${d.name}`}
                      className="h-4 w-4 accent-yellow-500"
                    />
                    <span
                      className={`text-sm ${d.enabled ? "text-gray-100" : "text-gray-600 line-through"}`}
                    >
                      {d.name}
                    </span>
                  </label>

                  <span className="ml-auto text-sm tabular-nums text-yellow-400">
                    {formatMinor(d.priceKobo, "NGN")}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        id: d.id,
                        name: d.name,
                        priceNaira: String(d.priceKobo / 100),
                        enabled: d.enabled,
                      })
                    }
                    aria-label={`Edit ${d.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:text-yellow-400"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(d.id, d.name)}
                    aria-label={`Delete ${d.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              {visibleAreas.length === 0 && (
                <li className="py-6 text-center text-xs text-gray-500">
                  Nothing matches “{areaQuery}”.
                </li>
              )}
            </ul>
          )}

          {selected && destinations.length > 0 && (
            <p className="mt-4 flex items-center gap-1.5 border-t border-white/8 pt-3 text-[11px] text-gray-500">
              <Check className="h-3 w-3 text-green-500" />
              {destinations.filter((d) => d.enabled).length} of{" "}
              {destinations.length} available to customers.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
