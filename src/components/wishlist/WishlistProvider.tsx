"use client";

import { syncFavorites, toggleFavorite } from "@/app/wishlist/actions";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface WishlistItem {
  productId: string;
  slug: string;
  name: string;
  price: number; // NGN minor units (kobo)
  image: string;
}

/**
 * Favourites are persisted per USER when signed in, and per browser otherwise.
 *
 * The optimistic pattern here is deliberate: the heart flips immediately in
 * React state, and the server call follows. A wishlist toggle is not money —
 * making the customer wait on a round trip to see a heart fill would be worse
 * than the rare case where the write fails and the next page load corrects it.
 */
interface WishlistContextValue {
  items: WishlistItem[];
  count: number;
  has: (productId: string) => boolean;
  toggle: (item: WishlistItem) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);
const STORAGE_KEY = "ff.wishlist.v1";

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Rehydrate after mount, never during render: localStorage does not exist on
  // the server, so reading it in render would desync SSR markup from the client.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount hydration from an external store
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
  }, []);

  // On mount, reconcile the browser list with the account's. For a signed-out
  // visitor this returns the local list unchanged, so it costs one cheap call
  // and keeps a single code path.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void (async () => {
      const res = await syncFavorites(items.map((i) => i.productId));
      if (cancelled || !res.ok || res.items.length === 0) return;
      // Merge, and REPAIR. Adding only unknown ids is not enough: an earlier
      // build stored entries with just a productId, and those are already in
      // localStorage on real browsers. They would stay blank forever, because
      // their id is "known". Any local entry missing a name is replaced by the
      // server's complete one.
      setItems((cur) => {
        const fromServer = new Map(res.items.map((i) => [i.productId, i]));
        const merged = cur.map((local) => {
          const complete = fromServer.get(local.productId);
          return complete && !local.name ? complete : local;
        });
        const known = new Set(merged.map((i) => i.productId));
        const added = res.items.filter((i) => !known.has(i.productId));
        return added.length > 0 ? [...merged, ...added] : merged;
      });
    })();
    return () => {
      cancelled = true;
    };
    // Runs once after hydration; `items` is read, not tracked, on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Sign-out clears this key (src/lib/personal-storage.ts). React state would
  // otherwise survive the client-side navigation and re-persist the old items.
  useEffect(() => {
    const reset = () => setItems([]);
    window.addEventListener("ff:clear-personal-state", reset);
    return () => window.removeEventListener("ff:clear-personal-state", reset);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota errors */
    }
  }, [items, hydrated]);

  const has = useCallback(
    (productId: string) => items.some((i) => i.productId === productId),
    [items],
  );

  const toggle = useCallback((item: WishlistItem) => {
    setItems((cur) => {
      const had = cur.some((i) => i.productId === item.productId);
      // Fire and forget: signed-out users are a no-op server-side.
      void toggleFavorite(item.productId, !had);
      return had
        ? cur.filter((i) => i.productId !== item.productId)
        : [item, ...cur];
    });
  }, []);

  const remove = useCallback((productId: string) => {
    void toggleFavorite(productId, false);
    setItems((cur) => cur.filter((i) => i.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, count: items.length, has, toggle, remove, clear }),
    [items, has, toggle, remove, clear],
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
