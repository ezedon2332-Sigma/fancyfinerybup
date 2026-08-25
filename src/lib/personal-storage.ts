"use client";

/**
 * Browser-stored state that belongs to a PERSON, not to a device.
 *
 * The cart, wishlist and recently-viewed list are kept in localStorage so they
 * survive a refresh without a round trip. localStorage is scoped to the
 * browser, though — not to the signed-in user — so without an explicit clear
 * they outlive the session that created them. On a shared machine that means
 * the next person to use the browser sees the previous customer's cart and
 * wishlist, and can check out with items they never chose.
 *
 * Sign-out must therefore wipe these. Preferences that describe the DEVICE
 * rather than the person — display currency, language, admin sidebar state —
 * are deliberately NOT listed: clearing those would just be annoying, and they
 * reveal nothing about who was signed in.
 */
const PERSONAL_KEYS = [
  "ff.cart.v1",
  "ff.wishlist.v1",
  "ff.recent.v1",
] as const;

export function clearPersonalStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of PERSONAL_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Private-mode or quota errors must not block the sign-out itself.
    }
  }
  // Providers hold the same data in React state, which a client-side navigation
  // would not discard. Each personal provider listens for this and resets.
  window.dispatchEvent(new Event("ff:clear-personal-state"));
}
