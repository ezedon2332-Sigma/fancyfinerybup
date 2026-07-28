"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ExternalLink,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react";

import { NAV, navCounts, type NavItem } from "@/app/admin/nav";

/**
 * Admin shell: sidebar, top bar, mobile drawer.
 *
 * One layout for every admin page, so a new section inherits navigation,
 * search and responsive behaviour by existing rather than by re-implementing
 * them. Pages render only their own content.
 *
 * The sidebar collapses to icons on desktop and its state persists, because an
 * admin working through a wide table wants the width back and should not have
 * to reclaim it on every navigation.
 */
export function AdminShell({
  who,
  children,
}: {
  /** Display name for the signed-in admin. */
  who: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const counts = navCounts();

  // Restore the collapsed preference after mount — localStorage does not exist
  // on the server, so reading it during render would desync the markup.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount hydration from an external store
      setCollapsed(localStorage.getItem("ff.admin.collapsed") === "1");
    } catch {
      /* private browsing — default to expanded */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      try {
        localStorage.setItem("ff.admin.collapsed", v ? "0" : "1");
      } catch {
        /* non-critical */
      }
      return !v;
    });
  };

  // Close the drawer on navigation, or it stays open over the new page.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a route change, not to render state
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const filtered = query.trim()
    ? NAV.map((g) => ({
        ...g,
        items: g.items.filter((i) =>
          i.label.toLowerCase().includes(query.trim().toLowerCase()),
        ),
      })).filter((g) => g.items.length > 0)
    : NAV;

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#050505]/95 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open admin menu"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-white/5 hover:text-yellow-400 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-yellow-400 lg:flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>

          <Link href="/admin" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt=""
              width={64}
              height={64}
              className="h-8 w-8 object-contain"
              style={{ mixBlendMode: "screen" }}
            />
            <span className="hidden text-[11px] uppercase tracking-[0.24em] text-yellow-500 sm:inline">
              Fancy Finery
            </span>
          </Link>

          {/* Section search — filters the sidebar rather than pretending to be
              a global data search it cannot yet perform. */}
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a section…"
              aria-label="Find an admin section"
              className="min-h-[40px] w-full rounded-lg border border-white/10 bg-white/[0.03] pl-9 pr-3 text-xs text-white outline-none transition-colors placeholder:text-gray-600 focus:border-yellow-500/60"
            />
          </div>

          <Link
            href="/"
            title="View storefront"
            className="hidden h-10 items-center gap-1.5 rounded-lg border border-white/12 px-3 text-[10px] uppercase tracking-widest text-gray-300 transition-colors hover:border-yellow-500/50 hover:text-yellow-400 sm:flex"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Store
          </Link>

          {who && (
            <span
              className="hidden max-w-[180px] truncate text-[11px] text-gray-500 xl:inline"
              title={who}
            >
              {who}
            </span>
          )}
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside
          className={`sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 overflow-y-auto border-r border-white/8 py-5 transition-[width] duration-300 lg:block ${
            collapsed ? "w-[68px] px-2" : "w-60 px-3"
          }`}
        >
          <SidebarNav groups={filtered} pathname={pathname} search={search.toString()} collapsed={collapsed} />
          {!collapsed && (
            <p className="mt-6 px-3 text-[10px] leading-relaxed text-gray-700">
              {counts.ready} sections live · {counts.planned} planned. Planned
              entries are shown for shape and are not clickable.
            </p>
          )}
        </aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm lg:hidden"
            >
              <motion.aside
                role="dialog"
                aria-modal="true"
                aria-label="Admin menu"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-y-0 left-0 w-[86%] max-w-xs overflow-y-auto border-r border-yellow-600/25 bg-[#0a0a0a] px-3 py-4"
              >
                <div className="mb-3 flex items-center justify-between px-2">
                  <span className="text-[10px] uppercase tracking-[0.28em] text-yellow-500">
                    Admin
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close admin menu"
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-yellow-400"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <SidebarNav groups={filtered} pathname={pathname} search={search.toString()} collapsed={false} />
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarNav({
  groups,
  pathname,
  search,
  collapsed,
}: {
  groups: typeof NAV;
  pathname: string;
  search: string;
  collapsed: boolean;
}) {
  return (
    <nav className="space-y-5" aria-label="Admin sections">
      {groups.map((group) => (
        <div key={group.heading}>
          {!collapsed && (
            <p className="mb-1 px-3 text-[9px] font-semibold uppercase tracking-[0.22em] text-gray-600">
              {group.heading}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <NavRow
                key={`${group.heading}-${item.label}`}
                item={item}
                pathname={pathname}
                search={search}
                collapsed={collapsed}
              />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavRow({
  item,
  pathname,
  search,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  search: string;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const base = item.href.split("?")[0];
  const active = base !== "#" && (pathname === base || pathname.startsWith(`${base}/`));
  const [open, setOpen] = useState(active);

  // Planned sections are deliberately not links: a nav entry to nothing gives
  // a 404 and no way to tell a bug from an unbuilt feature.
  if (item.status === "planned") {
    return (
      <li>
        <span
          title={`${item.label} — not built yet`}
          aria-disabled="true"
          className={`flex min-h-[40px] cursor-not-allowed items-center gap-2.5 rounded-lg px-3 text-sm text-gray-700 ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{item.label}</span>
              <span className="shrink-0 rounded border border-white/8 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-gray-700">
                Soon
              </span>
            </>
          )}
        </span>
      </li>
    );
  }

  const readyChildren = item.children?.filter((c) => c.status === "ready") ?? [];
  const plannedChildren = item.children?.filter((c) => c.status === "planned") ?? [];

  return (
    <li>
      <div className="flex items-center">
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          title={collapsed ? item.label : undefined}
          className={`flex min-h-[40px] flex-1 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors ${
            active
              ? "bg-yellow-500/10 text-yellow-400"
              : "text-gray-300 hover:bg-white/5 hover:text-yellow-400"
          } ${collapsed ? "justify-center px-0" : ""}`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        </Link>

        {!collapsed && item.children && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${item.label} sub-sections`}
            className="flex h-10 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:text-yellow-400"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>

      {!collapsed && item.children && open && (
        <ul className="mt-0.5 space-y-0.5 border-l border-white/8 pb-1 pl-3 ml-4">
          {readyChildren.map((c) => {
            const current = search ? pathname + "?" + search : pathname;
            const childActive = current === c.href;
            return (
              <li key={c.label}>
                <Link
                  href={c.href}
                  className={`flex min-h-[36px] items-center rounded-md px-2.5 text-[12px] transition-colors ${
                    childActive
                      ? "text-yellow-400"
                      : "text-gray-400 hover:bg-white/5 hover:text-yellow-400"
                  }`}
                >
                  {c.label}
                </Link>
              </li>
            );
          })}
          {plannedChildren.length > 0 && (
            <li className="px-2.5 pt-1.5">
              <p className="text-[9px] leading-relaxed text-gray-700">
                {plannedChildren.length} more planned:{" "}
                {plannedChildren.map((c) => c.label).join(", ")}
              </p>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}
