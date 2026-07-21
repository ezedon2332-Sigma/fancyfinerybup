import Link from "next/link";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Tags,
  Truck,
  Users,
} from "lucide-react";

import { requireAdmin } from "@/infrastructure/supabase/auth";

/**
 * Authoritative admin gate. Proxy does an optimistic signed-in check, but this
 * is where the ROLE is actually enforced (server-side, every request).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  const groups: {
    heading: string;
    links: { href: string; icon: React.ReactNode; label: string }[];
  }[] = [
    {
      heading: "Overview",
      links: [
        { href: "/admin", icon: <LayoutDashboard className="h-4 w-4" />, label: "Dashboard" },
        { href: "/admin/analytics", icon: <BarChart3 className="h-4 w-4" />, label: "Analytics" },
      ],
    },
    {
      heading: "Catalog",
      links: [
        { href: "/admin/products", icon: <Package className="h-4 w-4" />, label: "Products" },
        { href: "/admin/categories", icon: <Tags className="h-4 w-4" />, label: "Categories" },
        { href: "/admin/inventory", icon: <Boxes className="h-4 w-4" />, label: "Inventory" },
      ],
    },
    {
      heading: "Sales",
      links: [
        { href: "/admin/orders", icon: <ShoppingCart className="h-4 w-4" />, label: "Orders" },
        { href: "/admin/shipping", icon: <Truck className="h-4 w-4" />, label: "Shipping" },
      ],
    },
    {
      heading: "People",
      links: [
        { href: "/admin/customers", icon: <Users className="h-4 w-4" />, label: "Customers" },
      ],
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10 lg:flex-row lg:px-10">
      <aside className="lg:w-56 lg:shrink-0">
        <p className="text-xs uppercase tracking-[4px] text-yellow-500">Admin</p>
        <nav className="mt-4 flex flex-col gap-5">
          {groups.map((g) => (
            <div key={g.heading}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                {g.heading}
              </p>
              <div className="flex gap-2 overflow-x-auto lg:flex-col">
                {g.links.map((l) => (
                  <AdminLink key={l.href} href={l.href} icon={l.icon} label={l.label} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function AdminLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-yellow-400"
    >
      {icon}
      {label}
    </Link>
  );
}
