"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  Heart,
  LogIn,
  Search,
  ShoppingBag,
  User,
  X,
} from "lucide-react";

import { CurrencyLanguageMenu } from "./CurrencyLanguageMenu";

export interface MobileNavLink {
  href: string;
  label: string;
}

/** Every row is at least 44px tall — the minimum comfortable tap target. */
const ROW =
  "flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left transition-colors hover:bg-white/5 active:bg-white/10";

/**
 * Slide-out navigation for phones and tablets.
 *
 * It carries everything the desktop header offers, which the old dropdown did
 * not: Search and Wishlist were `hidden sm:inline-flex` in the bar and absent
 * from the menu, so on any phone they were unreachable. Cart was reachable
 * only via the icon.
 *
 * Rendered as a fixed overlay rather than an expanding block inside the
 * header, so opening it cannot push page content down or grow the sticky
 * header — no layout shift either way.
 */
export function MobileNav({
  open,
  onClose,
  links,
  isActive,
  user,
  cartCount,
  wishCount,
  onOpenCart,
}: {
  open: boolean;
  onClose: () => void;
  links: readonly MobileNavLink[];
  isActive: (href: string) => boolean;
  user: { email: string | null } | null;
  cartCount: number;
  wishCount: number;
  onOpenCart: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const close = useCallback(() => onClose(), [onClose]);

  // Escape to dismiss, and keep Tab inside the panel while it is open.
  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),select,input,[tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    // Lock the page behind the overlay, preserving whatever overflow was set.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restoreFocus.current?.focus?.();
    };
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={close}
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm lg:hidden"
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col overflow-y-auto overscroll-contain border-l border-yellow-600/30 bg-[#0a0a0a] shadow-[-20px_0_60px_-20px_rgba(0,0,0,1)]"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <span className="text-[10px] uppercase tracking-[0.3em] text-yellow-500">
                Menu
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-white/5 hover:text-yellow-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-0.5 p-3" aria-label="Pages">
              {links.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className={`${ROW} text-sm uppercase tracking-widest ${
                      active ? "bg-yellow-500/10 text-yellow-400" : "text-gray-200"
                    }`}
                  >
                    <span className="flex-1">{link.label}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-600" />
                  </Link>
                );
              })}
            </nav>

            <Section title="Shop">
              <Link href="/collections" onClick={close} className={`${ROW} text-sm text-gray-200`}>
                <Search className="h-4 w-4 shrink-0 text-yellow-600" />
                <span className="flex-1">Search</span>
              </Link>

              <Link href="/wishlist" onClick={close} className={`${ROW} text-sm text-gray-200`}>
                <Heart className="h-4 w-4 shrink-0 text-yellow-600" />
                <span className="flex-1">Wishlist</span>
                {wishCount > 0 && <Badge>{wishCount}</Badge>}
              </Link>

              {/* Cart is a drawer, not a route — close this first so the two
                  overlays never stack. */}
              <button
                type="button"
                onClick={() => {
                  close();
                  onOpenCart();
                }}
                className={`${ROW} text-sm text-gray-200`}
              >
                <ShoppingBag className="h-4 w-4 shrink-0 text-yellow-600" />
                <span className="flex-1">Shopping Bag</span>
                {cartCount > 0 && <Badge>{cartCount}</Badge>}
              </button>
            </Section>

            <Section title="Account">
              <Link
                href={user ? "/account" : "/login"}
                onClick={close}
                className={`${ROW} text-sm text-gray-200`}
              >
                {user ? (
                  <User className="h-4 w-4 shrink-0 text-yellow-600" />
                ) : (
                  <LogIn className="h-4 w-4 shrink-0 text-yellow-600" />
                )}
                <span className="min-w-0 flex-1">
                  {user ? "My Account" : "Sign In"}
                  {user?.email && (
                    <span className="block truncate text-[11px] text-gray-500">
                      {user.email}
                    </span>
                  )}
                </span>
              </Link>
              <Link href="/shipping" onClick={close} className={`${ROW} text-sm text-gray-200`}>
                <span className="flex-1">Shipping Rates</span>
              </Link>
            </Section>

            <Section title="Preferences">
              <div className="px-3 pb-2">
                <CurrencyLanguageMenu />
              </div>
            </Section>

            <p className="mt-auto px-4 pb-6 pt-4 text-center text-[10px] uppercase tracking-[0.28em] text-gray-600">
              Fancy Finery
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-white/8 p-3">
      <p className="px-3 pb-1.5 text-[9px] uppercase tracking-[0.28em] text-gray-500">
        {title}
      </p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-yellow-500 px-1.5 text-[10px] font-bold text-black">
      {children}
    </span>
  );
}
