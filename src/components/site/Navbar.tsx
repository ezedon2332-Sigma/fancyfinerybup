"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  Globe,
  Heart,
  Menu,
  RefreshCw,
  Search,
  ShoppingBag,
  User,
  X,
} from "lucide-react";

import { useCart } from "@/components/cart/CartProvider";
import { useWishlist } from "@/components/wishlist/WishlistProvider";
import { CurrencyLanguageMenu } from "./CurrencyLanguageMenu";
import { CurrencySwitcher } from "./CurrencySwitcher";
import { LiveRateTicker } from "./LiveRateTicker";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/collections?category=men", label: "Men" },
  { href: "/collections?category=women", label: "Women" },
  { href: "/collections?category=children", label: "Children" },
  { href: "/collections", label: "Collections" },
  { href: "/lookbook", label: "Lookbook" },
  { href: "/contact", label: "Contact" },
];

export function Navbar({ user }: { user: { email: string | null } | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { count, openCart } = useCart();
  const { count: wishCount } = useWishlist();

  const isActive = (href: string) => {
    const base = href.split("?")[0];
    if (base === "/") return pathname === "/";
    return pathname === base && !href.includes("?");
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-yellow-600/40 bg-black/85 backdrop-blur-md">
      {/* Live exchange-rate ticker (top of everything) */}
      <LiveRateTicker />

      {/* Top utility bar */}
      <div className="hidden border-b border-white/5 lg:block">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-6 text-[11px] text-gray-300 lg:px-10">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-yellow-500" />
              <strong className="font-semibold text-gray-200">WORLDWIDE SHIPPING</strong>
              <span className="text-gray-500">Delivery to 200+ countries</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-yellow-500" />
              <strong className="font-semibold text-gray-200">PREMIUM QUALITY</strong>
              <span className="text-gray-500">Finest fabrics &amp; craftsmanship</span>
            </span>
            <span className="flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-yellow-500" />
              <strong className="font-semibold text-gray-200">EASY RETURNS</strong>
              <span className="text-gray-500">30-day return policy</span>
            </span>
          </div>
          <CurrencyLanguageMenu />
        </div>
      </div>

      {/* Main nav */}
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
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
            <span className="text-base font-bold tracking-[3px] text-yellow-600 sm:text-lg">
              FANCY FINERY
            </span>
            <span className="hidden text-[10px] uppercase tracking-[5px] text-gray-400 sm:block">
              Luxury Fashion House
            </span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-7 text-xs font-medium uppercase tracking-widest lg:flex">
          {LINKS.map((link) => {
            const active = isActive(link.href);
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
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Always-visible currency selector */}
          <CurrencySwitcher />
          <Link
            href="/collections"
            aria-label="Search"
            className="hidden rounded-full p-2 text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400 sm:inline-flex"
          >
            <Search className="h-5 w-5" />
          </Link>
          <Link
            href="/wishlist"
            aria-label="Wishlist"
            className="relative hidden rounded-full p-2 text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400 sm:inline-flex"
          >
            <Heart className="h-5 w-5" />
            {wishCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-500 px-1 text-[10px] font-bold text-black">
                {wishCount}
              </span>
            )}
          </Link>
          <button
            type="button"
            aria-label="Bag"
            onClick={openCart}
            className="relative rounded-full p-2 text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-500 px-1 text-[10px] font-bold text-black">
                {count}
              </span>
            )}
          </button>
          <Link
            href={user ? "/account" : "/login"}
            aria-label={user ? "Account" : "Sign in"}
            className="rounded-full p-2 text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400"
          >
            <User className="h-5 w-5" />
          </Link>

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
                  className="rounded-md px-3 py-3 text-sm uppercase tracking-widest text-gray-200 transition-colors hover:bg-white/5"
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
              <div className="mt-2 border-t border-white/5 px-3 pt-3">
                <CurrencyLanguageMenu />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
