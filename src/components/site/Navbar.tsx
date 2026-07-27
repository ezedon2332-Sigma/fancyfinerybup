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
      {/* The rate ticker used to sit here as a full-width strip. It now lives
          inside the brand column below, so the branding leads the header. */}

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

      {/* Main nav — permanent brand identity left, links optically centred
          (equal 1fr side tracks), actions right. */}
      {/* Inline links appear at xl, not lg. At 1024px a mark this size plus
          seven links plus the action icons needs ~1100px of a 944px row; the
          menu button covers 1024–1280 so the branding can breathe. */}
      <nav className="mx-auto flex h-[116px] max-w-7xl items-center justify-between gap-3 px-4 sm:h-[140px] sm:px-6 lg:h-[164px] lg:px-10 xl:grid xl:grid-cols-[auto_1fr_auto] xl:gap-6">
        {/* Branding column: lockup, then the live rate directly beneath it. */}
        <div className="flex min-w-0 shrink-0 flex-col items-start gap-2.5 py-2 xl:col-start-1 xl:row-start-1">
          <Link
            href="/"
            aria-label="Fancy Finery — home"
            className="brand-lockup flex shrink-0 items-center gap-3 rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-yellow-500/70 sm:gap-4 xl:gap-5"
          >
            <Image
              src="/logo.png"
              alt="Fancy Finery"
              width={256}
              height={256}
              priority
              className="brand-mark h-16 w-16 object-contain sm:h-[88px] sm:w-[88px] lg:h-[100px] lg:w-[100px] xl:h-[108px] xl:w-[108px]"
            />
            {/* The mark already carries the name, so on phones it stands alone
                rather than repeating it in half-legible type. */}
            <span className="hidden flex-col justify-center leading-none sm:flex">
              <span className="brand-wordmark whitespace-nowrap text-[30px] leading-none tracking-[0.17em] lg:text-[34px] xl:text-[40px]">
                FANCY FINERY
              </span>
              <span className="brand-tagline mt-3 flex items-center gap-2 text-[9px] uppercase leading-none tracking-[0.4em] text-gray-400 lg:text-[10px] lg:tracking-[0.44em]">
                <span
                  aria-hidden
                  className="h-px min-w-2 flex-1 bg-gradient-to-r from-transparent to-yellow-600/60"
                />
                Luxury Fashion House
                <span
                  aria-hidden
                  className="h-px min-w-2 flex-1 bg-gradient-to-l from-transparent to-yellow-600/60"
                />
              </span>
            </span>
          </Link>

          <LiveRateTicker variant="card" />
        </div>

        {/* Desktop links — centre track */}
        <div className="hidden items-center justify-center gap-4 text-[10px] font-medium uppercase tracking-[0.14em] xl:col-start-2 xl:row-start-1 xl:flex xl:gap-5 xl:tracking-[0.15em] 2xl:gap-7 2xl:text-[11px] 2xl:tracking-[0.16em]">
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
        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2 xl:col-start-3 xl:row-start-1">
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
            className="rounded-full p-2 text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400 xl:hidden"
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
            className="overflow-hidden border-t border-yellow-600/20 xl:hidden"
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
