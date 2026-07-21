"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Globe } from "lucide-react";

import { useLanguage, LANGUAGES } from "@/components/providers/LanguageProvider";

/**
 * Language selector for the header. (Currency now lives in the always-visible
 * <CurrencySwitcher/> in the main nav, so this is language-only.)
 */
export function CurrencyLanguageMenu() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const langLabel =
    LANGUAGES.find((l) => l.code === language)?.label ?? "English";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent | MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-200 transition-colors hover:text-yellow-400"
      >
        <Globe className="h-3.5 w-3.5" />
        {langLabel}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-1 min-w-[9rem] overflow-hidden rounded-lg border border-yellow-600/30 bg-neutral-950 py-1 shadow-xl"
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="option"
              aria-selected={l.code === language}
              onClick={() => {
                setLanguage(l.code);
                setOpen(false);
              }}
              className={`block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-white/5 ${
                l.code === language ? "text-yellow-400" : "text-gray-200"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
