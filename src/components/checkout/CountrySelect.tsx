"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import { flagEmoji } from "@/domain/shipping/countries";

export interface CountryOption {
  code: string;
  name: string;
}

/** Searchable, flag-decorated country dropdown. Countries arrive alphabetical. */
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
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = countries.find((c) => c.code === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
    );
  }, [countries, query]);

  return (
    <div className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
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
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
      </button>

      {open && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            if (blurTimer.current) clearTimeout(blurTimer.current);
          }}
          className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-yellow-600/30 bg-neutral-950 shadow-xl"
        >
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
                    onClick={() => {
                      onChange(c.code, c.name);
                      setQuery("");
                      setOpen(false);
                    }}
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
