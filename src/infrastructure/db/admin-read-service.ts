import "server-only";

import { asc, count, desc, eq, sql } from "drizzle-orm";

import type { OrderStatus } from "@/domain/entities/order";
import { db } from "./client";
import {
  aiConversations,
  aiFaqs,
  aiMessages,
  categories,
  colorRequests,
  orderItems,
  orders,
  products,
  shippingZones,
  taxRules,
} from "./schema";

/**
 * Read models for admin screens that had their queries written inline.
 *
 * Those pages imported `db` and the Drizzle schema directly, which put table
 * shapes in the delivery layer — the exact coupling this migration set out to
 * remove, reintroduced by me while converting them. The ESLint layer rule
 * caught all ten on its first run; this module is where their queries belong.
 *
 * Every function here is UNSCOPED by design: callers reach them only through
 * the /admin layout, which runs `requireAdmin()` before any child renders.
 */

// --- Dashboard -------------------------------------------------------------

export interface AdminCounts {
  products: number;
  published: number;
  categories: number;
  orders: number;
}

export async function loadAdminCounts(): Promise<AdminCounts> {
  const [row] = await db
    .select({
      products: count(),
      published: db.$count(products, eq(products.status, "published")),
      categories: db.$count(categories),
      orders: db.$count(orders),
    })
    .from(products);

  return {
    products: row?.products ?? 0,
    published: row?.published ?? 0,
    categories: row?.categories ?? 0,
    orders: row?.orders ?? 0,
  };
}

// --- Analytics -------------------------------------------------------------

export interface AnalyticsOrder {
  id: string;
  total: number;
  currency: string;
  status: string;
  created_at: string;
  shipping_name: string | null;
}

export interface AnalyticsItem {
  name_snapshot: string;
  unit_price: number;
  qty: number;
  product_id: string | null;
}

export async function loadAnalyticsData(): Promise<{
  orders: AnalyticsOrder[];
  items: AnalyticsItem[];
}> {
  const [orderRows, itemRows] = await Promise.all([
    db
      .select({
        id: orders.id,
        total: orders.total,
        currency: orders.currency,
        status: orders.status,
        created_at: orders.createdAt,
        shipping_name: orders.shippingName,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt)),
    db
      .select({
        name_snapshot: orderItems.nameSnapshot,
        unit_price: orderItems.unitPrice,
        qty: orderItems.qty,
        product_id: orderItems.productId,
      })
      .from(orderItems),
  ]);

  return { orders: orderRows, items: itemRows };
}

// --- Inventory -------------------------------------------------------------

export interface InventoryProduct {
  id: string;
  name: string;
  slug: string;
  variants: {
    size: string | null;
    color: string | null;
    sku: string | null;
    stockQty: number;
  }[];
}

export async function loadInventory(): Promise<InventoryProduct[]> {
  const rows = await db.query.products.findMany({
    columns: { id: true, name: true, slug: true },
    with: { productVariants: true },
    orderBy: [asc(products.name)],
  });

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    variants: p.productVariants.map((v) => ({
      size: v.size,
      color: v.color,
      sku: v.sku,
      stockQty: v.stockQty,
    })),
  }));
}

// --- Tax -------------------------------------------------------------------

export interface AdminTaxRule {
  id: string;
  scope: "global" | "zone" | "country";
  countryCode: string | null;
  zoneId: string | null;
  rateBps: number;
  label: string;
  appliesToShipping: boolean;
  enabled: boolean;
}

export async function loadTaxAdminData(): Promise<{
  rules: AdminTaxRule[];
  zones: { id: string; name: string }[];
}> {
  const [ruleRows, zones] = await Promise.all([
    db.select().from(taxRules),
    db
      .select({ id: shippingZones.id, name: shippingZones.name })
      .from(shippingZones)
      .orderBy(asc(shippingZones.sortOrder)),
  ]);

  return {
    rules: ruleRows.map((r) => ({
      id: r.id,
      scope: r.scope as AdminTaxRule["scope"],
      countryCode: r.countryCode,
      zoneId: r.zoneId,
      rateBps: r.rateBps,
      label: r.label,
      appliesToShipping: r.appliesToShipping,
      enabled: r.enabled,
    })),
    zones,
  };
}

// --- Colour requests -------------------------------------------------------

export async function loadColorRequests() {
  try {
    return await db
      .select()
      .from(colorRequests)
      .orderBy(desc(colorRequests.createdAt));
  } catch {
    // A colour-requests outage must not take the admin dashboard down.
    return [];
  }
}

// --- AI concierge ----------------------------------------------------------

export async function loadAiFaqs() {
  return db
    .select({ id: aiFaqs.id, question: aiFaqs.question, answer: aiFaqs.answer })
    .from(aiFaqs)
    .orderBy(asc(aiFaqs.sortOrder));
}

export async function loadConversations(limit = 100) {
  return db
    .select({
      id: aiConversations.id,
      status: aiConversations.status,
      contact_email: aiConversations.contactEmail,
      last_message_at: aiConversations.lastMessageAt,
    })
    .from(aiConversations)
    .orderBy(desc(aiConversations.lastMessageAt))
    .limit(limit);
}

export async function loadConversationDetail(id: string) {
  const [conversation] = await db
    .select({
      id: aiConversations.id,
      status: aiConversations.status,
      contact_email: aiConversations.contactEmail,
      created_at: aiConversations.createdAt,
    })
    .from(aiConversations)
    .where(eq(aiConversations.id, id))
    .limit(1);

  if (!conversation) return null;

  const messages = await db
    .select({
      id: aiMessages.id,
      role: aiMessages.role,
      content: aiMessages.content,
      created_at: aiMessages.createdAt,
    })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, id))
    .orderBy(asc(aiMessages.createdAt));

  return { conversation, messages };
}

// --- Storefront: active colour options -------------------------------------

/**
 * Not admin — the product page's colour picker. It lives here rather than in
 * the page for the same reason as everything above.
 */
export async function loadActiveColors(): Promise<
  { name: string; code: string | null }[]
> {
  const { colors } = await import("./schema");
  return db
    .select({ name: colors.colorName, code: colors.colorCode })
    .from(colors)
    .where(eq(colors.active, true))
    .orderBy(asc(colors.colorName));
}

/** Order-status counts, used by the dashboard badges. */
export async function orderStatusCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: orders.status, n: count() })
    .from(orders)
    .groupBy(orders.status);
  return Object.fromEntries(
    rows.map((r) => [r.status as OrderStatus, r.n]),
  ) as Record<string, number>;
}

/** Total units sold, used where a headline figure is wanted. */
export async function totalUnitsSold(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${orderItems.qty}), 0)::int` })
    .from(orderItems);
  return row?.n ?? 0;
}
