"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import { flagEmoji } from "@/domain/shipping/countries";

export interface CountryOption {
  code: string;
  name: string;
}

/** Searchable, flag-decorated country dropdown. Countries arrive alphabetical.
 *  Stays open until the user selects, clicks outside, or presses Escape. */
export function CountrySelect({
  countries,
  value,
  onChange,
  id,
}: {
  countries: CountryOption[];
  value: string;
  onChange: (code: string, name: string) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = countries.find((c) => c.code === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
    );
  }, [countries, query]);

  // Close only on a genuine outside interaction or Escape — never on focus loss
  // (the search box's autofocus must not slam the menu shut). Works for touch.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent | MouseEvent) => {
      const el = containerRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(c: CountryOption) {
    onChange(c.code, c.name);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-sm border border-white/20 bg-black/40 px-4 py-3 text-left text-white outline-none transition-colors focus:border-yellow-500"
      >
        <span className={selected ? "" : "text-gray-500"}>
          {selected ? (
            <>
              <span className="mr-2">{flagEmoji(selected.code)}</span>
              {selected.name}
            </>
          ) : (
            "Select country"
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-lg border border-yellow-600/30 bg-neutral-950 shadow-xl">
          <div className="relative border-b border-white/10">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries…"
              className="w-full bg-transparent py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-gray-500"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-500">No matches.</li>
            ) : (
              filtered.map((c) => (
                <li key={c.code} role="option" aria-selected={c.code === value}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-white/5 ${
                      c.code === value ? "text-yellow-400" : "text-gray-200"
                    }`}
                  >
                    <span className="text-base">{flagEmoji(c.code)}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    {c.code === value && <Check className="h-4 w-4" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
