/**
 * Locale configuration, shared by server and client.
 *
 * **Cookie-based, not path-based.** next-intl's documented default puts the
 * locale in the URL (`/fr/products/...`), which would mean moving all ~40
 * routes under `app/[locale]/` and rewriting every internal <Link>. A cookie
 * keeps the existing URLs — a real consideration for a storefront whose product
 * links are already shared and indexed. The trade-off is that a page cannot be
 * linked in a specific language; if that becomes a requirement, path routing is
 * the migration to make.
 */
export const LOCALES = ["en", "fr", "es"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie the switcher writes and the server reads on the next request. */
export const LOCALE_COOKIE = "ff.locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
