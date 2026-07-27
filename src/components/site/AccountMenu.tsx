"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Heart,
  LogIn,
  LogOut,
  Package,
  User,
  UserPlus,
} from "lucide-react";

import { signOut } from "@/app/account/actions";

/**
 * Account icon that opens a menu, rather than a "Sign In" button competing for
 * width in the bar. At 320px the action row already overflowed by 53px; a text
 * button would have made that worse, and an icon carries the same affordance.
 *
 * Every row is 44px tall. The trigger is 44x44 on touch, easing to 40 from lg
 * where there is a pointer.
 */
export function AccountMenu({
  user,
  wishCount,
}: {
  user: { email: string | null } | null;
  wishCount: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside press or Escape. `pointerdown` rather than `click` so the
  // menu closes before a tap lands on whatever is underneath it.
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

  const row =
    "flex min-h-[44px] items-center gap-3 px-4 text-sm transition-colors hover:bg-white/5 active:bg-white/10";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user ? "Account menu" : "Sign in"}
        className="flex h-11 w-11 items-center justify-center rounded-full text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400 lg:h-10 lg:w-10"
      >
        <User className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Account"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-yellow-600/30 bg-neutral-950 shadow-[0_20px_50px_-20px_rgba(0,0,0,1)]"
          >
            {user ? (
              <>
                <div className="border-b border-white/8 px-4 py-3">
                  <p className="text-[9px] uppercase tracking-[0.24em] text-yellow-500">
                    Signed in
                  </p>
                  <p className="mt-1 truncate text-xs text-gray-400">
                    {user.email}
                  </p>
                </div>
                <Link href="/account" role="menuitem" onClick={() => setOpen(false)} className={`${row} text-gray-200`}>
                  <User className="h-4 w-4 shrink-0 text-yellow-600" /> Profile
                </Link>
                <Link href="/account/orders" role="menuitem" onClick={() => setOpen(false)} className={`${row} text-gray-200`}>
                  <Package className="h-4 w-4 shrink-0 text-yellow-600" /> My Orders
                </Link>
                <Link href="/wishlist" role="menuitem" onClick={() => setOpen(false)} className={`${row} text-gray-200`}>
                  <Heart className="h-4 w-4 shrink-0 text-yellow-600" />
                  <span className="flex-1">Wishlist</span>
                  {wishCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-500 px-1.5 text-[10px] font-bold text-black">
                      {wishCount}
                    </span>
                  )}
                </Link>
                {/* A form post, not a link — signing out changes state and must
                    not be triggered by a prefetch or a crawler. */}
                <form action={signOut} className="border-t border-white/8">
                  <button type="submit" role="menuitem" className={`${row} w-full text-left text-gray-400`}>
                    <LogOut className="h-4 w-4 shrink-0" /> Sign Out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" role="menuitem" onClick={() => setOpen(false)} className={`${row} text-gray-200`}>
                  <LogIn className="h-4 w-4 shrink-0 text-yellow-600" /> Sign In
                </Link>
                <Link href="/login" role="menuitem" onClick={() => setOpen(false)} className={`${row} text-gray-200`}>
                  <UserPlus className="h-4 w-4 shrink-0 text-yellow-600" /> Create Account
                </Link>
                <Link href="/wishlist" role="menuitem" onClick={() => setOpen(false)} className={`${row} border-t border-white/8 text-gray-200`}>
                  <Heart className="h-4 w-4 shrink-0 text-yellow-600" />
                  <span className="flex-1">Wishlist</span>
                  {wishCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-500 px-1.5 text-[10px] font-bold text-black">
                      {wishCount}
                    </span>
                  )}
                </Link>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
