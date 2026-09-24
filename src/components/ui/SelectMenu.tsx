"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

export interface SelectOption {
  value: string;
  label: string;
  /** Secondary text on the right of the row — a price, a code. */
  hint?: string;
  disabled?: boolean;
}

/**
 * Accessible listbox.
 *
 * Replaces a native `<select>` where the dropdown itself needs to be styled.
 * A native popup is drawn by the operating system: it inherits the page's white
 * text but is painted on a light system background, which is why options were
 * invisible until hovered. `globals.css` now names both colours as a floor for
 * the selects still using the native control, but it can go no further —
 * highlighting the active row in brand gold, giving rows a comfortable height,
 * and opening upward near the bottom of the page are all impossible there.
 *
 * Follows the ARIA combobox/listbox pattern rather than a div soup: the trigger
 * is a combobox owning a listbox, each row is an option carrying its own
 * selected state, and the active row is tracked with aria-activedescendant so a
 * screen reader announces it as the arrow keys move. Keyboard support is the
 * full set a native select gives — arrows, Home/End, Enter, Escape, and
 * type-ahead — because replacing a native control means owing the user
 * everything it did.
 */
export function SelectMenu({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  ariaLabel,
  className = "",
  searchable = false,
  searchPlaceholder = "Type to filter…",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  /** Show a filter field inside the panel. Worth it past ~15 rows; below that
   *  the jump-to-letter type-ahead is quicker than moving to an input. */
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [dropUp, setDropUp] = useState(false);
  /** Measured at open and on every viewport change — see `measure`. */
  const [maxList, setMaxList] = useState(256);
  const [query, setQuery] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const searchRef = useRef<HTMLInputElement>(null);

  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? null;

  /**
   * Rows actually on screen. Every index below — `active`, arrow stepping,
   * `commit` — addresses THIS list, never `options`, or filtering would select
   * the row that happens to sit at the same position in the unfiltered array.
   *
   * Matches anywhere in the label, not just the start: Nigerian states include
   * "Akwa Ibom" and "Cross River", and a shopper who types "ibom" or "river"
   * means that state.
   */
  const shown = query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : options;

  const selectable = useCallback(
    (i: number) => i >= 0 && i < shown.length && !shown[i].disabled,
    [shown],
  );

  /**
   * Decide which way to hang the panel and how tall its list may be.
   *
   * Uses `visualViewport` rather than `innerHeight` because that is the only
   * one that shrinks when a phone's on-screen keyboard appears — and with a
   * filter field the keyboard appears every time the panel opens. Sizing
   * against `innerHeight` (or `vh`) leaves the bottom of the list underneath
   * the keyboard, unreachable however hard you scroll.
   *
   * The floor of 132px is deliberate: on a very short screen the list becomes
   * a small scrolling window rather than collapsing to nothing.
   */
  const measure = useCallback(() => {
    const box = triggerRef.current?.getBoundingClientRect();
    if (!box) return;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const viewTop = vv?.offsetTop ?? 0;
    const viewHeight = vv?.height ?? window.innerHeight;
    const GAP = 12;
    const below = viewTop + viewHeight - box.bottom - GAP;
    const above = box.top - viewTop - GAP;
    const up = below < 200 && above > below;
    setDropUp(up);
    // The filter field sits inside the panel, so it eats into the same budget.
    const chrome = searchable ? 60 : 0;
    setMaxList(Math.max(132, Math.min(256, (up ? above : below) - chrome)));
  }, [searchable]);

  /** Next selectable index in `dir`, skipping disabled rows. */
  const step = useCallback(
    (from: number, dir: 1 | -1) => {
      for (let i = from + dir; i >= 0 && i < shown.length; i += dir) {
        if (selectable(i)) return i;
      }
      return from;
    },
    [shown.length, selectable],
  );

  // Open with the current selection active, so arrowing starts from where the
  // customer actually is rather than the top of the list.
  function openList() {
    if (disabled) return;
    const start = shown.findIndex((o) => o.value === value);
    setActive(start >= 0 ? start : step(-1, 1));
    measure();
    setOpen(true);
  }

  /** Single close path, so the filter can never survive into the next open. */
  const closeList = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  function commit(i: number) {
    if (!selectable(i)) return;
    onChange(shown[i].value);
    closeList();
    triggerRef.current?.focus();
  }

  // Close on outside press or Escape. `pointerdown` rather than `click` so the
  // list closes before a tap lands on whatever was underneath it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent | MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closeList();
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, closeList]);

  // Re-measure while open. The keyboard sliding up, a rotation and a scroll
  // all change how much room the panel has, and none of them is a re-render.
  // The effect only registers listeners; the measuring happens in them.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  // Focus the filter field once the panel has painted. Effect rather than an
  // autoFocus prop, because the panel mounts inside an animating container.
  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  // Keep the active row in view as the arrows move past the fold.
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current
      ?.querySelector(`[data-i="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        closeList();
        triggerRef.current?.focus();
        return;
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => step(i, 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => step(i, -1));
        return;
      case "Home":
        e.preventDefault();
        setActive(step(-1, 1));
        return;
      case "End":
        e.preventDefault();
        setActive(step(shown.length, -1));
        return;
      case "Enter":
        e.preventDefault();
        commit(active);
        return;
      case " ":
        // With a filter field open, space belongs to the query — "Akwa Ibom"
        // is untypeable otherwise. Only the closed/unsearchable trigger treats
        // it as "choose this row".
        if (searchable) return;
        e.preventDefault();
        commit(active);
        return;
      case "Tab":
        closeList();
        return;
    }

    // Type-ahead, for the panels without a filter field. Keystrokes within a
    // second accumulate, so "kad" reaches Kaduna rather than cycling K, A, D.
    // A searchable panel filters instead, so this would double-handle.
    if (!searchable && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      typed.current.text =
        now - typed.current.at > 1000 ? e.key : typed.current.text + e.key;
      typed.current.at = now;
      const q = typed.current.text.toLowerCase();
      const hit = shown.findIndex(
        (o) => !o.disabled && o.label.toLowerCase().startsWith(q),
      );
      if (hit >= 0) setActive(hit);
    }
  }

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={
          open && active >= 0 ? `${listId}-${active}` : undefined
        }
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`flex min-h-[48px] w-full items-center justify-between gap-2 rounded-lg border px-3.5 text-left text-sm transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
          open
            ? "border-yellow-500/70 bg-white/[0.05]"
            : "border-white/12 bg-white/[0.03] hover:border-white/25"
        } focus-visible:border-yellow-500/70 focus-visible:ring-1 focus-visible:ring-yellow-500/40`}
      >
        {/* The selected label is plain white on the dark shell — the thing that
            was broken. min-w-0 + truncate so a long state name cannot push the
            chevron out of the control. */}
        <span
          className={`min-w-0 flex-1 truncate ${selected ? "text-white" : "text-gray-500"}`}
        >
          {selected ? selected.label : placeholder}
        </span>
        {selected?.hint && (
          <span className="shrink-0 text-xs tabular-nums text-yellow-400">
            {selected.hint}
          </span>
        )}
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.99 }}
            transition={{ duration: 0.15, ease: EASE }}
            /* z-50 clears the sticky header and the summary card. The panel is
               a sibling of the trigger inside a `relative` wrapper, so no
               ancestor with overflow can clip it. */
            className={`absolute inset-x-0 z-50 overflow-hidden rounded-xl border border-yellow-600/30 bg-neutral-950 shadow-2xl shadow-black/70 ${
              dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
            }`}
          >
            {searchable && (
              /* Inside the panel, not replacing the trigger: the trigger stays
                 a combobox showing the current choice, which is what a shopper
                 returning to a filled-in form needs to see. */
              <div className="border-b border-yellow-600/20 p-2">
                <div className="relative">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-yellow-500/70"
                  />
                  <input
                    ref={searchRef}
                    type="text"
                    role="searchbox"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      // Filtering renumbers the rows, so park the highlight on
                      // the first match instead of whatever index it held.
                      setActive(0);
                    }}
                    onKeyDown={onKeyDown}
                    placeholder={searchPlaceholder}
                    aria-label={`Filter ${ariaLabel ?? "options"}`}
                    aria-controls={listId}
                    autoComplete="off"
                    className="w-full rounded-lg border border-yellow-600/25 bg-neutral-900 py-2 pl-8 pr-3 text-sm text-gray-100 placeholder:text-gray-500 focus:border-yellow-500/60 focus:outline-none"
                  />
                </div>
              </div>
            )}
            <ul
              id={listId}
              ref={listRef}
              role="listbox"
              aria-label={ariaLabel}
              tabIndex={-1}
              /* Height is measured, not guessed: see `measure`. Touch scroll
                 is kept inside the list so flicking it never scrolls the page
                 behind, which on mobile reads as the panel jumping away. */
              style={{ maxHeight: maxList }}
              className="overflow-y-auto overscroll-contain py-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
            >
              {shown.length === 0 && (
                <li role="none">
                  <p className="px-3.5 py-3 text-sm text-gray-400">
                    No matches for “{query}”.
                  </p>
                </li>
              )}
              {shown.map((o, i) => {
                const isSelected = o.value === value;
                const isActive = i === active;
                return (
                  <li key={o.value || `blank-${i}`} role="none">
                    <button
                      id={`${listId}-${i}`}
                      data-i={i}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={o.disabled}
                      /* pointerdown, not click: the outside-press handler runs
                         on pointerdown and would otherwise close the list
                         before the click resolved. */
                      onPointerDown={(e) => {
                        e.preventDefault();
                        commit(i);
                      }}
                      onMouseEnter={() => !o.disabled && setActive(i)}
                      className={`flex min-h-[44px] w-full items-center gap-2.5 px-3.5 text-left text-sm transition-colors disabled:opacity-40 ${
                        isActive
                          ? "bg-yellow-500/15 text-yellow-100"
                          : isSelected
                            ? "text-yellow-300"
                            : "text-gray-100"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {o.hint && (
                        <span
                          className={`shrink-0 text-xs tabular-nums ${
                            isActive ? "text-yellow-200" : "text-yellow-400/80"
                          }`}
                        >
                          {o.hint}
                        </span>
                      )}
                      {isSelected && (
                        <Check aria-hidden className="h-3.5 w-3.5 shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
