"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Heart,
  LogIn,
  LogOut,
  MapPin,
  Package,
  Settings,
  User,
  UserPlus,
} from "lucide-react";

import { signOut } from "@/app/account/actions";

interface HeaderUser {
  email: string | null;
  firstName: string | null;
}

const ROW =
  "flex min-h-[46px] items-center gap-3 rounded-xl px-3 text-sm text-gray-200 transition-colors hover:bg-white/[0.06] hover:text-yellow-300 focus-visible:bg-white/[0.06] focus-visible:outline-none";

/**
 * The single account control in the header — a premium dropdown that adapts to
 * auth state. Signed out: Welcome + Sign In + Create Account. Signed in: the
 * shopper's name and their account menu. One control, both states, no separate
 * Sign In / Create Account buttons cluttering the bar.
 */
export function AccountMenu({ user }: { user: HeaderUser | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = user?.firstName?.trim() || "My Account";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user ? "Account menu" : "Account — sign in or create an account"}
        className="flex h-10 items-center gap-1.5 rounded-full px-2 text-gray-200 transition-colors hover:text-yellow-400 lg:h-9"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] lg:h-8 lg:w-8">
          {user ? (
            <span className="text-xs font-semibold uppercase text-yellow-400">
              {user.firstName?.trim()?.[0] ?? <User className="h-4 w-4" />}
            </span>
          ) : (
            <User className="h-4.5 w-4.5" />
          )}
        </span>
        {user && (
          <span className="hidden max-w-[9rem] truncate text-sm font-medium sm:inline">
            {name}
          </span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 opacity-70 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Account"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 z-50 mt-3 w-64 origin-top-right overflow-hidden rounded-2xl border border-yellow-600/25 bg-neutral-950/90 p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
          >
            {user ? (
              <>
                <div className="flex items-center gap-3 px-3 py-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 text-sm font-bold uppercase text-black">
                    {user.firstName?.trim()?.[0] ?? <User className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-yellow-500">
                      Welcome back
                    </p>
                    <p className="truncate text-sm font-medium text-white">{name}</p>
                    {user.email && (
                      <p className="truncate text-[11px] text-gray-500">{user.email}</p>
                    )}
                  </div>
                </div>
                <div className="my-1 h-px bg-white/8" />
                <Item href="/account" icon={Package} onClick={() => setOpen(false)}>My Orders</Item>
                <Item href="/wishlist" icon={Heart} onClick={() => setOpen(false)}>Wishlist</Item>
                <Item href="/account" icon={MapPin} onClick={() => setOpen(false)}>Address Book</Item>
                <Item href="/account" icon={Settings} onClick={() => setOpen(false)}>Account Settings</Item>
                <div className="my-1 h-px bg-white/8" />
                <form action={signOut}>
                  <button type="submit" role="menuitem" className={`${ROW} w-full text-left text-gray-400`}>
                    <LogOut className="h-4 w-4 shrink-0" /> Sign Out
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="px-3 py-2.5">
                  <p className="brand-wordmark text-lg leading-none">Welcome!</p>
                  <p className="mt-1 text-xs text-gray-400">
                    Sign in or create your account.
                  </p>
                </div>
                <div className="my-1 h-px bg-white/8" />
                <Link
                  href="/login"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="mt-1 flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-yellow-300 to-yellow-500 text-sm font-semibold text-black transition-all hover:from-yellow-200 hover:to-yellow-400"
                >
                  <LogIn className="h-4 w-4" /> Sign In
                </Link>
                <Link
                  href="/signup"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="mt-1.5 flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-medium text-gray-200 transition-colors hover:border-yellow-500/50 hover:text-yellow-300"
                >
                  <UserPlus className="h-4 w-4" /> Create Account
                </Link>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Item({
  href,
  icon: Icon,
  children,
  onClick,
}: {
  href: string;
  icon: typeof Package;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link href={href} role="menuitem" onClick={onClick} className={ROW}>
      <Icon className="h-4 w-4 shrink-0 text-yellow-600" /> {children}
    </Link>
  );
}
