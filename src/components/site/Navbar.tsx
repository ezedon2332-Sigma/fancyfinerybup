"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
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
import { MobileNav } from "./MobileNav";

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
    <>
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
      {/* Two blocks, pushed apart: branding hard left, navigation and actions
          hard right. The links used to sit in a centre grid column, which is
          what let them collide with the wordmark as the branding grew — a
          centre column has no way to yield. With space-between the two blocks
          can only move away from each other. */}
      <nav className="mx-auto flex h-[148px] max-w-7xl items-center justify-between gap-6 px-4 sm:h-[132px] sm:px-6 lg:gap-10 lg:px-10 xl:h-[156px]">
        {/* Branding: lockup, then the live rate directly beneath it. */}
        <div className="flex min-w-0 shrink-0 flex-col items-start gap-2.5 py-2">
          {/* Stacks on phones: side by side, the mark plus the name at its
              desktop size needs ~463px of a 343px row. Vertical keeps the
              name visible and the lockup hard left. */}
          <Link
            href="/"
            aria-label="Fancy Finery — home"
            className="brand-lockup flex shrink-0 flex-col items-start gap-1.5 rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-yellow-500/70 sm:flex-row sm:items-center sm:gap-4 xl:gap-5"
          >
            <Image
              src="/logo.png"
              alt="Fancy Finery"
              width={256}
              height={256}
              priority
              className="brand-mark h-16 w-16 object-contain sm:h-[76px] sm:w-[76px] xl:h-[100px] xl:w-[100px]"
            />
            <span className="flex flex-col justify-center leading-none">
              <span className="brand-wordmark whitespace-nowrap text-[19px] leading-none tracking-[0.14em] sm:text-[26px] sm:tracking-[0.17em] xl:text-[32px]">
                FANCY FINERY
              </span>
              {/* Tagline stays off on phones — a third line would push the
                  header taller than the content it introduces. */}
              <span className="brand-tagline mt-3 hidden items-center gap-2 text-[9px] uppercase leading-none tracking-[0.4em] text-gray-400 sm:flex lg:text-[10px] lg:tracking-[0.44em]">
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

        {/* Right-hand block: navigation, then the action icons. Grouping them
            means the whole thing is pushed right as one unit and the gap to
            the branding is whatever space is left over — never negative. */}
        <div className="flex shrink-0 items-center gap-5 lg:gap-8 xl:gap-10">
        {/* Navigation — hard right, hamburger below lg */}
        <div className="hidden items-center gap-2.5 text-[9px] font-medium uppercase tracking-[0.14em] lg:flex xl:gap-5 xl:text-[11px] xl:tracking-[0.15em] 2xl:gap-7 2xl:tracking-[0.16em]">
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
        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
          {/* Always-visible currency selector */}
          <CurrencySwitcher />
          <Link
            href="/collections"
            aria-label="Search"
            className="hidden flex h-11 w-11 items-center justify-center rounded-full text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400 lg:h-10 lg:w-10 sm:inline-flex"
          >
            <Search className="h-5 w-5" />
          </Link>
          <Link
            href="/wishlist"
            aria-label="Wishlist"
            className="relative hidden flex h-11 w-11 items-center justify-center rounded-full text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400 lg:h-10 lg:w-10 sm:inline-flex"
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
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400 lg:h-10 lg:w-10"
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
            className="flex h-11 w-11 items-center justify-center rounded-full text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400 lg:h-10 lg:w-10"
          >
            <User className="h-5 w-5" />
          </Link>

          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400 lg:h-10 lg:w-10 lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          </div>
        </div>
      </nav>

      {/* Secondary nav row, below lg only.
          Seven links cannot share a row with the branding and the action icons
          at tablet width or under — that needs ~966px of a 720px row at 768px.
          Given their own full-width row they all stay visible; on a narrow
          phone the row scrolls sideways rather than any link being dropped.
          The scroll is contained here, so the page itself never scrolls.
          The hamburger remains for Search, Wishlist, Bag and Account. */}
      <div className="border-t border-white/8 lg:hidden">
        <div className="nav-strip mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-2 sm:px-4">
          {LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] shrink-0 snap-start items-center whitespace-nowrap rounded-md px-3 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors ${
                  active
                    ? "text-yellow-400"
                    : "text-gray-300 hover:text-yellow-400"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      </header>

      {/* Rendered OUTSIDE <header> on purpose, and this is load-bearing.
          The header carries `backdrop-blur-md`, and a non-none backdrop-filter
          makes an element a containing block for position:fixed descendants.
          Nested inside, the drawer's `fixed inset-0` resolved against the
          header's box — a ~192px sliver — instead of the viewport, so it
          opened invisibly. That was the bug: the menu existed and worked, it
          was just being clipped to the header. */}
      <MobileNav
        open={open}
        onClose={() => setOpen(false)}
        links={LINKS}
        isActive={isActive}
        user={user}
        cartCount={count}
        wishCount={wishCount}
        onOpenCart={openCart}
      />
    </>
  );
}
