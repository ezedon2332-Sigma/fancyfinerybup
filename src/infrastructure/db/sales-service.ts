import "server-only";

import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";

import { db } from "./client";
import { orderItems, orders, products } from "./schema";

/**
 * Sales-derived product rankings for the storefront.
 *
 * The homepage previously faked both of these: "Best Sellers" sorted the
 * catalogue by price descending (the most expensive products, presented as the
 * most popular) and "Trending Now" rotated the newest list by four positions.
 * Neither consulted a single order. There has been order data all along.
 *
 * Both queries only count orders that were actually PAID and not cancelled —
 * an abandoned or refunded basket is not evidence that anything sold.
 * Both are filtered to published products, so an archived or draft item can
 * never surface on the storefront through a sales ranking.
 */

/** Shared: only paid, non-cancelled orders count as a sale. */
const SETTLED = and(
  eq(orders.paymentStatus, "paid"),
  ne(orders.status, "cancelled"),
);

async function rankByUnitsSold(
  limit: number,
  since?: Date,
): Promise<string[]> {
  const filters = [SETTLED, eq(products.status, "published")];
  if (since) filters.push(gte(orders.createdAt, since.toISOString()));

  const rows = await db
    .select({
      productId: orderItems.productId,
      units: sql<number>`sum(${orderItems.qty})::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(and(...filters))
    .groupBy(orderItems.productId)
    .orderBy(desc(sql`sum(${orderItems.qty})`))
    .limit(limit);

  return rows
    .map((r) => r.productId)
    .filter((id): id is string => Boolean(id));
}

/** Most units sold, all time. Empty on a store that has not sold anything. */
export async function listBestSellerProductIds(limit = 8): Promise<string[]> {
  try {
    return await rankByUnitsSold(limit);
  } catch {
    // A ranking outage must not take the homepage down; the caller falls back
    // to newest, which is honest rather than wrong.
    return [];
  }
}

/** Most units sold within the window. Defaults to the last 30 days. */
export async function listTrendingProductIds(
  limit = 8,
  windowDays = 30,
): Promise<string[]> {
  try {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    return await rankByUnitsSold(limit, since);
  } catch {
    return [];
  }
}

/** Units sold per product, for the admin catalogue. */
export async function unitsSoldByProduct(
  productIds: string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  try {
    const rows = await db
      .select({
        productId: orderItems.productId,
        units: sql<number>`sum(${orderItems.qty})::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(SETTLED, inArray(orderItems.productId, productIds)))
      .groupBy(orderItems.productId);

    return new Map(
      rows
        .filter((r) => r.productId)
        .map((r) => [r.productId as string, r.units]),
    );
  } catch {
    return new Map();
  }
}
