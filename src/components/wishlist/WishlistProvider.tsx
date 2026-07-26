"use client";

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
    setItems((cur) =>
      cur.some((i) => i.productId === item.productId)
        ? cur.filter((i) => i.productId !== item.productId)
        : [item, ...cur],
    );
  }, []);

  const remove = useCallback((productId: string) => {
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
