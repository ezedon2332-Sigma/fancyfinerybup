"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { CartDrawer } from "./CartDrawer";

export interface CartItem {
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  price: number; // minor units (kobo)
  /** Optional: carts stored before weights were tracked simply omit it. */
  weightGrams?: number;
  currency: string;
  image: string;
  size: string | null;
  color: string | null;
  qty: number;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantId: string | null) => void;
  updateQty: (productId: string, variantId: string | null, qty: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "ff.cart.v1";

const keyOf = (productId: string, variantId: string | null) =>
  `${productId}::${variantId ?? ""}`;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load once on mount — never during render, since localStorage does not
  // exist on the server and reading it there would desync SSR markup.
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

  // Persist on change (after hydration to avoid clobbering).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota errors */
    }
  }, [items, hydrated]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const k = keyOf(item.productId, item.variantId);
      const existing = prev.find((i) => keyOf(i.productId, i.variantId) === k);
      if (existing) {
        return prev.map((i) =>
          keyOf(i.productId, i.variantId) === k
            ? { ...i, qty: i.qty + item.qty }
            : i,
        );
      }
      return [...prev, item];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback(
    (productId: string, variantId: string | null) => {
      const k = keyOf(productId, variantId);
      setItems((prev) => prev.filter((i) => keyOf(i.productId, i.variantId) !== k));
    },
    [],
  );

  const updateQty = useCallback(
    (productId: string, variantId: string | null, qty: number) => {
      const k = keyOf(productId, variantId);
      setItems((prev) =>
        prev
          .map((i) =>
            keyOf(i.productId, i.variantId) === k
              ? { ...i, qty: Math.max(1, qty) }
              : i,
          )
          .filter((i) => i.qty > 0),
      );
    },
    [],
  );

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((n, i) => n + i.qty, 0);
    const subtotal = items.reduce((n, i) => n + i.price * i.qty, 0);
    return {
      items,
      count,
      subtotal,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addItem,
      removeItem,
      updateQty,
      clear,
    };
  }, [items, isOpen, addItem, removeItem, updateQty, clear]);

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartDrawer />
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
