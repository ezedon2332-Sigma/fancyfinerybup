"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/** Supported UI languages. English ships now; the structure is ready for more. */
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (c: LanguageCode) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = "ff.language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  // Restore after mount — localStorage is unavailable on the server, so
  // reading it during render would desync SSR markup.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount hydration from an external store
      setLanguageState(saved as LanguageCode);
    }
  }, []);

  const setLanguage = useCallback((c: LanguageCode) => {
    setLanguageState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
      document.documentElement.lang = c;
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
