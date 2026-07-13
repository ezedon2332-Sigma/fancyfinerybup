"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/collections", label: "Collections" },
  { href: "/contact", label: "Contact" },
];

export function Navbar({ user }: { user: { email: string | null } | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-yellow-600/40 bg-black/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Fancy Finery"
            width={40}
            height={40}
            priority
            className="h-9 w-9 object-contain"
          />
          <span className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-[3px] text-yellow-400 sm:text-lg">
              FANCY FINERY
            </span>
            <span className="hidden text-[10px] uppercase tracking-[5px] text-gray-400 sm:block">
              Luxury Fashion House
            </span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 text-xs font-medium uppercase tracking-widest lg:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative transition-colors hover:text-yellow-400 ${
                  active ? "text-yellow-400" : "text-gray-200"
                }`}
              >
                {link.label}
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute -bottom-1.5 left-0 h-px w-full bg-yellow-400"
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-3">
          <button
            type="button"
            aria-label="Search"
            className="hidden rounded-full p-2 text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400 sm:inline-flex"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Wishlist"
            className="hidden rounded-full p-2 text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400 sm:inline-flex"
          >
            <Heart className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Bag"
            className="rounded-full p-2 text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400"
          >
            <ShoppingBag className="h-5 w-5" />
          </button>
          <Link
            href={user ? "/account" : "/login"}
            aria-label={user ? "Account" : "Sign in"}
            className="rounded-full p-2 text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400"
          >
            <User className="h-5 w-5" />
          </Link>

          {/* Mobile toggle */}
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-full p-2 text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400 lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden border-t border-yellow-600/20 lg:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3 sm:px-6">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-md px-3 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-white/5 ${
                    pathname === link.href ? "text-yellow-400" : "text-gray-200"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href={user ? "/account" : "/login"}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm uppercase tracking-widest text-gray-200 transition-colors hover:bg-white/5"
              >
                {user ? "My Account" : "Sign In"}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
