"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface RecentItem {
  productId: string;
  slug: string;
  name: string;
  price: number; // NGN minor units
  image: string;
}

interface RecentContextValue {
  items: RecentItem[];
  track: (item: RecentItem) => void;
}

const RecentContext = createContext<RecentContextValue | null>(null);
const STORAGE_KEY = "ff.recent.v1";
const MAX = 12;

export function RecentlyViewedProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<RecentItem[]>([]);
  const hydrated = useRef(false);

  // Rehydrate after mount — localStorage is unavailable on the server, so
  // reading it during render would desync SSR markup.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount hydration from an external store
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    hydrated.current = true;
  }, []);

  // Sign-out clears this key (src/lib/personal-storage.ts). React state would
  // otherwise survive the client-side navigation and re-persist the old items.
  useEffect(() => {
    const reset = () => setItems([]);
    window.addEventListener("ff:clear-personal-state", reset);
    return () => window.removeEventListener("ff:clear-personal-state", reset);
  }, []);

  const track = useCallback((item: RecentItem) => {
    setItems((cur) => {
      const next = [item, ...cur.filter((i) => i.productId !== item.productId)].slice(
        0,
        MAX,
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ items, track }), [items, track]);

  return (
    <RecentContext.Provider value={value}>{children}</RecentContext.Provider>
  );
}

export function useRecentlyViewed(): RecentContextValue {
  const ctx = useContext(RecentContext);
  if (!ctx)
    throw new Error("useRecentlyViewed must be used within RecentlyViewedProvider");
  return ctx;
}
