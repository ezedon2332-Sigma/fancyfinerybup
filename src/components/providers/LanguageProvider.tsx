"use client";

import { createContext, useCallback, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_LABELS,
  type Locale,
} from "@/i18n/config";

/**
 * Language selection.
 *
 * The previous version of this file stored a code in localStorage, set
 * `document.documentElement.lang`, and did nothing else — no string in the app
 * ever consulted it, so the switcher moved a label and changed no words. It is
 * now backed by next-intl: the choice is written to a cookie, the server reads
 * it on the next render (src/i18n/request.ts) and returns that locale's
 * messages.
 *
 * A cookie rather than localStorage because the decision has to be available to
 * SERVER components. localStorage is not, which is the structural reason the
 * old approach could never have worked for a Server-Component-first app.
 *
 * `router.refresh()` re-renders the server tree with the new cookie in place.
 * Without it the cookie changes and the page keeps its old text until the next
 * navigation.
 */

export const LANGUAGES = LOCALES.map((code) => ({
  code,
  label: LOCALE_LABELS[code],
}));

export type LanguageCode = Locale;

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (c: LanguageCode) => void;
  /** True while the server tree is re-rendering in the new language. */
  isSwitching: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useLocale() as LanguageCode;
  const router = useRouter();
  const [isSwitching, startTransition] = useTransition();

  const setLanguage = useCallback(
    (next: LanguageCode) => {
      // A year, so the choice survives. Lax is enough: this is a display
      // preference, and it must still apply when arriving from an external
      // link (an email, a shared product URL).
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      startTransition(() => router.refresh());
    },
    [router],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isSwitching }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within <LanguageProvider>");
  }
  return ctx;
}
