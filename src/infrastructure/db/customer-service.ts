import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import type { OrderStatus } from "@/domain/entities/order";
import type { UserRole } from "@/domain/entities/profile";
import type {
  CustomerDetail,
  CustomerRow,
} from "@/domain/entities/customer-views";
import { requireAdmin } from "@/infrastructure/auth/session";
import { db } from "./client";
import { orders, profiles, user } from "./schema";

/**
 * Admin customer views.
 *
 * The Supabase version could not do this in one query: identities lived in the
 * managed `auth.users` table, reachable only through the Admin API, so
 * `listCustomers` paged through `auth.admin.listUsers({ perPage: 200 })` up to
 * twenty times, pulled every profile and EVERY order row, and joined the three
 * in JavaScript. Identities are now an ordinary table in our own database, so
 * this is a join with aggregates, and the order totals are summed by Postgres
 * instead of by streaming the whole orders table into Node.
 *
 * `requireAdmin()` is kept inside these functions, exactly as before — they are
 * called straight from admin pages and the check travelling with the query is
 * what makes that safe.
 */

export async function listCustomers(): Promise<CustomerRow[]> {
  await requireAdmin();

  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      fullName: profiles.fullName,
      role: profiles.role,
      createdAt: user.createdAt,
      orderCount: sql<number>`count(${orders.id})::int`,
      // Cancelled orders count toward the order tally but not toward spend.
      totalSpent: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} <> 'cancelled'), 0)::int`,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.id, user.id))
    .leftJoin(orders, eq(orders.userId, user.id))
    .groupBy(user.id, profiles.fullName, profiles.role)
    .orderBy(desc(user.createdAt));

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    fullName: r.fullName,
    role: (r.role ?? "customer") as UserRole,
    createdAt: r.createdAt.toISOString(),
    orderCount: r.orderCount,
    totalSpent: r.totalSpent,
  }));
}

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  await requireAdmin();

  const [row] = await db
    .select({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      role: profiles.role,
      fullName: profiles.fullName,
      phone: profiles.phone,
      address: profiles.address,
      city: profiles.city,
      state: profiles.state,
      country: profiles.country,
      lat: profiles.lat,
      lng: profiles.lng,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.id, user.id))
    .where(eq(user.id, id))
    .limit(1);

  if (!row) return null;

  const orderRows = await db
    .select({
      id: orders.id,
      status: orders.status,
      total: orders.total,
      currency: orders.currency,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.userId, id))
    .orderBy(desc(orders.createdAt));

  return {
    id: row.id,
    email: row.email,
    role: (row.role ?? "customer") as UserRole,
    fullName: row.fullName,
    phone: row.phone,
    address: row.address,
    city: row.city,
    state: row.state,
    country: row.country,
    lat: row.lat,
    lng: row.lng,
    createdAt: row.createdAt.toISOString(),
    orders: orderRows.map((o) => ({
      id: o.id,
      status: o.status as OrderStatus,
      total: o.total,
      currency: o.currency,
      createdAt: o.createdAt,
    })),
  };
}
