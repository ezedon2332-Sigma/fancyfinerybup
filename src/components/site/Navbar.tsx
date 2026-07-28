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
import { MobileNav } from "./MobileNav";
import { AccountMenu } from "./AccountMenu";

/** One definition of an icon button: 44x44 on touch, 40 from lg. */
const ICON =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-200 transition-colors hover:bg-white/5 hover:text-yellow-400 active:scale-95 lg:h-10 lg:w-10";

const STRIP_ITEM =
  "flex min-h-[44px] shrink-0 snap-start items-center whitespace-nowrap rounded-md px-3 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/collections?category=men", label: "Men" },
  { href: "/collections?category=women", label: "Women" },
  { href: "/collections?category=children", label: "Children" },
  { href: "/collections", label: "Collections" },
  { href: "/lookbook", label: "Lookbook" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function StripCount({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-500 px-1 text-[10px] font-bold text-black">
      {children}
    </span>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-500 px-1 text-[10px] font-bold text-black">
      {children}
    </span>
  );
}

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
      <header className="sticky top-0 z-50 border-b border-yellow-600/40 bg-black/85 backdrop-blur-md">
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
      <nav className="mx-auto flex h-[116px] max-w-7xl items-center justify-between gap-2 px-4 sm:h-[104px] sm:gap-4 sm:px-6 lg:gap-6 lg:px-10 xl:h-[124px]">
        {/* Branding: the lockup, alone. */}
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
              <span className="brand-wordmark whitespace-nowrap text-[clamp(13px,3.9vw,19px)] leading-none tracking-[0.14em] sm:text-[26px] sm:tracking-[0.17em] xl:text-[32px]">
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
        </div>

        {/* Right-hand block: navigation, then the action icons. Grouping them
            means the whole thing is pushed right as one unit and the gap to
            the branding is whatever space is left over — never negative. */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-4 lg:gap-5 xl:gap-4 2xl:gap-8">
        {/* Navigation — hard right, hamburger below lg */}
        <div className="hidden items-center gap-2.5 text-[9px] font-medium uppercase tracking-[0.14em] xl:flex xl:gap-3 xl:text-[11px] xl:tracking-[0.09em] 2xl:gap-6 2xl:tracking-[0.16em]">
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

        {/* Actions.
            Currency is unconditional — it is a control a shopper needs before
            they can read a price, so it is never the thing that gets dropped
            to make room. The rest reveal progressively:

              all    Currency, Bag, Menu
              xl     + Search, Wishlist, Account  (Menu goes, links inline)

            Anything withheld here is in the drawer, so nothing is unreachable,
            only less prominent. Every control is a 44x44 target on touch,
            easing to 40 from lg where there is a pointer not a fingertip. */}
        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-1.5">
          <CurrencySwitcher />

          <Link href="/collections" aria-label="Search" className={`${ICON} hidden xl:flex`}>
            <Search className="h-5 w-5" />
          </Link>

          <Link href="/wishlist" aria-label="Wishlist" className={`${ICON} relative hidden xl:flex`}>
            <Heart className="h-5 w-5" />
            {wishCount > 0 && <Count>{wishCount}</Count>}
          </Link>

          <button type="button" aria-label="Bag" onClick={openCart} className={`${ICON} relative`}>
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && <Count>{count}</Count>}
          </button>

          <span className="hidden xl:inline-flex">
            <AccountMenu user={user} wishCount={wishCount} />
          </span>

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
            className={`${ICON} xl:hidden`}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        </div>
      </nav>

      {/* Secondary row, everything below xl.
          Pages and actions travel together in one scrollable row, so the set
          is identical at every width under xl — nothing appears or vanishes at
          a breakpoint. Previously this hid at lg while Search and Wishlist only
          appeared at xl, which left them reachable nowhere between 1024 and
          1280. It fits without scrolling from roughly 700px up and scrolls
          below that, contained here so the page itself never scrolls. */}
      <div className="border-t border-white/8 xl:hidden">
        <div className="nav-strip mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-2 sm:px-4">
          {LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`${STRIP_ITEM} ${
                  active ? "text-yellow-400" : "text-gray-300 hover:text-yellow-400"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-white/12" />

          {/* Labelled rather than icon-only: in a scrolling row an unlabelled
              glyph gives no clue what is further along. */}
          <Link href="/collections" className={`${STRIP_ITEM} text-gray-300 hover:text-yellow-400`}>
            <Search className="mr-1.5 h-3.5 w-3.5 text-yellow-600" />
            Search
          </Link>

          <Link href="/wishlist" className={`${STRIP_ITEM} text-gray-300 hover:text-yellow-400`}>
            <Heart className="mr-1.5 h-3.5 w-3.5 text-yellow-600" />
            Wishlist
            {wishCount > 0 && <StripCount>{wishCount}</StripCount>}
          </Link>

          <button
            type="button"
            onClick={openCart}
            className={`${STRIP_ITEM} text-gray-300 hover:text-yellow-400`}
          >
            <ShoppingBag className="mr-1.5 h-3.5 w-3.5 text-yellow-600" />
            Bag
            {count > 0 && <StripCount>{count}</StripCount>}
          </button>

          {/* A link, not the dropdown: a menu opening inside a horizontally
              scrolling container would be clipped by its overflow. */}
          <Link
            href={user ? "/account" : "/login"}
            className={`${STRIP_ITEM} text-gray-300 hover:text-yellow-400`}
          >
            <User className="mr-1.5 h-3.5 w-3.5 text-yellow-600" />
            {user ? "Account" : "Sign In"}
          </Link>
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
