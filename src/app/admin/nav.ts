import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgePercent,
  BarChart3,
  Bell,
  Boxes,
  CreditCard,
  FileText,
  Gift,
  LayoutDashboard,
  Layers,
  Mail,
  Megaphone,
  MessageSquare,
  Package,
  Palette,
  Plug,
  Settings,
  ShoppingCart,
  Sparkles,
  Tags,
  Truck,
  UserCog,
  Users,
} from "lucide-react";

/**
 * Admin information architecture, as data.
 *
 * Every section the dashboard should eventually have is listed, but each one
 * declares whether it exists. `ready` items link; `planned` items render as
 * disabled with a marker.
 *
 * That distinction is the whole point. Wiring a nav entry to a route that does
 * not exist gives an admin a 404 and no way to tell a broken link from an
 * unbuilt feature. Showing the shape of the product while being honest about
 * what is finished is more useful than either hiding the roadmap or faking it.
 *
 * Promoting a section is a one-word edit here once its page lands.
 */

export type NavStatus = "ready" | "planned";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  status: NavStatus;
  /** Sub-navigation, used by Shipping. */
  children?: { label: string; href: string; status: NavStatus }[];
}

export interface NavGroup {
  heading: string;
  items: NavItem[];
}

/**
 * Shipping sub-navigation.
 *
 * The existing shipping page is tabbed, so the entries that are ready deep-link
 * into a tab rather than pretending to be separate routes — same destination,
 * fewer page loads, and no duplicated data fetching.
 */
const SHIPPING_CHILDREN: NonNullable<NavItem["children"]> = [
  { label: "Overview", href: "/admin/shipping", status: "ready" },
  { label: "Nigeria Shipping", href: "/admin/shipping/nigeria", status: "ready" },
  { label: "Rates", href: "/admin/shipping?tab=rates", status: "ready" },
  { label: "Zones & Countries", href: "/admin/shipping?tab=zones", status: "ready" },
  { label: "Weight Bands", href: "/admin/shipping?tab=bands", status: "ready" },
  { label: "Couriers", href: "/admin/shipping?tab=couriers", status: "ready" },
  { label: "Tracking Numbers", href: "/admin/orders", status: "ready" },
  { label: "Public Rate Card", href: "/shipping", status: "ready" },
  // Everything below needs schema or a carrier account that does not exist yet.
  { label: "Shipping Orders", href: "#", status: "planned" },
  { label: "Dimension Rules", href: "#", status: "planned" },
  { label: "Pickup Locations", href: "#", status: "planned" },
  { label: "Packaging & Handling", href: "#", status: "planned" },
  { label: "Free Shipping Rules", href: "#", status: "planned" },
  { label: "Customs & Duties", href: "#", status: "planned" },
  { label: "Delivery Notifications", href: "#", status: "planned" },
  { label: "Return & Exchange", href: "#", status: "planned" },
  { label: "Carrier Integrations", href: "#", status: "planned" },
  { label: "Shipping Analytics", href: "#", status: "planned" },
];

export const NAV: NavGroup[] = [
  {
    heading: "Overview",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard, status: "ready" },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3, status: "ready" },
      { label: "Reports", href: "#", icon: FileText, status: "planned" },
    ],
  },
  {
    heading: "Catalogue",
    items: [
      { label: "Products", href: "/admin/products", icon: Package, status: "ready" },
      { label: "Categories", href: "/admin/categories", icon: Tags, status: "ready" },
      { label: "Collections", href: "/admin/categories", icon: Layers, status: "ready" },
      { label: "Inventory", href: "/admin/inventory", icon: Boxes, status: "ready" },
      { label: "Colour Requests", href: "/admin/color-requests", icon: Palette, status: "ready" },
    ],
  },
  {
    heading: "Sales",
    items: [
      { label: "Orders", href: "/admin/orders", icon: ShoppingCart, status: "ready" },
      {
        label: "Shipping",
        href: "/admin/shipping",
        icon: Truck,
        status: "ready",
        children: SHIPPING_CHILDREN,
      },
      { label: "Tax", href: "/admin/tax", icon: BadgePercent, status: "ready" },
      { label: "Payments", href: "#", icon: CreditCard, status: "planned" },
      { label: "Discounts", href: "#", icon: BadgePercent, status: "planned" },
      { label: "Gift Cards", href: "#", icon: Gift, status: "planned" },
    ],
  },
  {
    heading: "Customers",
    items: [
      { label: "Customers", href: "/admin/customers", icon: Users, status: "ready" },
      { label: "Reviews", href: "/admin/reviews", icon: MessageSquare, status: "ready" },
      { label: "Newsletter", href: "/admin/newsletter", icon: Mail, status: "ready" },
      { label: "Marketing", href: "#", icon: Megaphone, status: "planned" },
      { label: "Notifications", href: "#", icon: Bell, status: "planned" },
    ],
  },
  {
    heading: "System",
    items: [
      { label: "AI Concierge", href: "/admin/ai", icon: Sparkles, status: "ready" },
      { label: "AI Conversations", href: "/admin/ai/conversations", icon: MessageSquare, status: "ready" },
      { label: "Staff & Roles", href: "#", icon: UserCog, status: "planned" },
      { label: "Activity Logs", href: "#", icon: Activity, status: "planned" },
      { label: "Integrations", href: "#", icon: Plug, status: "planned" },
      { label: "Settings", href: "#", icon: Settings, status: "planned" },
    ],
  },
];

/** Counts for the honesty line in the sidebar footer. */
export function navCounts(): { ready: number; planned: number } {
  let ready = 0;
  let planned = 0;
  for (const g of NAV) {
    for (const i of g.items) {
      if (i.status === "ready") ready++;
      else planned++;
      for (const c of i.children ?? []) {
        if (c.status === "ready") ready++;
        else planned++;
      }
    }
  }
  return { ready, planned };
}
