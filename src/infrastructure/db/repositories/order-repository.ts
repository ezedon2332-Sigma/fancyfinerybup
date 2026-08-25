import "server-only";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import type { Order, OrderWithItems } from "@/domain/entities/order";
import {
  OutOfStockError,
  type NewOrder,
  type OrderRepository,
} from "@/domain/repositories/order-repository";
import type { Database } from "../client";
import { orderItems, orders, productVariants } from "../schema";
import { toOrder, toOrderWithItems } from "../mappers";

/**
 * Drizzle-backed OrderRepository.
 *
 * Two things the Supabase adapter did that are deliberately gone:
 *
 *  1. **The "unknown column" retry.** It caught PGRST204/42703 and re-inserted
 *     without tax/discount/total_weight_grams, to survive a deploy landing
 *     ahead of a migration. Schema and code now ship together and migrations
 *     run before boot, so a missing column is a bug to surface, not to paper
 *     over — silently dropping the itemised breakdown from a real sale is
 *     worse than failing loudly.
 *
 *  2. **Two separate inserts.** Order and items are now written in one
 *     transaction. Previously an items insert that failed left an orphaned
 *     order row behind, which the customer had already been charged against.
 */
export function createOrderRepository(db: Database): OrderRepository {
  return {
    async create(input: NewOrder): Promise<string> {
      return db.transaction(async (tx) => {
        const [order] = await tx
          .insert(orders)
          .values({
            userId: input.userId,
            status: "processing",
            subtotal: input.subtotal,
            shippingCost: input.shippingCost,
            tax: input.tax,
            discount: input.discount,
            totalWeightGrams: input.totalWeightGrams,
            total: input.total,
            currency: input.currency,
            shippingMethod: input.shippingMethod,
            shippingName: input.shipping.name,
            shippingEmail: input.shipping.email,
            shippingPhone: input.shipping.phone,
            shippingAddress: input.shipping.address,
            shippingApartment: input.shipping.apartment,
            shippingCity: input.shipping.city,
            shippingState: input.shipping.state,
            shippingCountry: input.shipping.country,
            shippingCountryCode: input.shipping.countryCode,
            shippingPostal: input.shipping.postal,
            shippingLat: input.shipping.lat,
            shippingLng: input.shipping.lng,
          })
          .returning({ id: orders.id });

        if (!order) throw new Error("Order insert returned no row.");

        if (input.items.length > 0) {
          await tx.insert(orderItems).values(
            input.items.map((it) => ({
              orderId: order.id,
              productId: it.productId,
              variantId: it.variantId,
              nameSnapshot: it.nameSnapshot,
              unitPrice: it.unitPrice,
              qty: it.qty,
            })),
          );
        }

        // Claim the stock.
        //
        // `stock_qty >= qty` in the WHERE clause is what makes this safe under
        // concurrency: Postgres takes a row lock for the UPDATE, so two
        // customers buying the last dress are serialised, and the second one
        // re-evaluates the predicate against the ALREADY DECREMENTED value and
        // matches no rows. Throwing then rolls back the whole transaction —
        // order, items and any earlier decrements — so a partly-filled basket
        // never becomes a partly-filled order.
        //
        // Read-then-write cannot achieve this at any isolation level below
        // SERIALIZABLE: both readers would see the same stale count.
        for (const it of input.items) {
          if (!it.variantId) continue; // product has no variants: nothing tracked

          const claimed = await tx
            .update(productVariants)
            .set({ stockQty: sql`${productVariants.stockQty} - ${it.qty}` })
            .where(
              and(
                eq(productVariants.id, it.variantId),
                gte(productVariants.stockQty, it.qty),
              ),
            )
            .returning({ id: productVariants.id });

          if (claimed.length === 0) {
            throw new OutOfStockError(
              `${it.nameSnapshot || "An item in your bag"} just sold out.`,
            );
          }
        }

        return order.id;
      });
    },

    async restoreStock(orderId: string): Promise<void> {
      // Only ever for a cancelled order, and only once. The status check makes
      // this idempotent: a second call finds the order already cancelled but
      // the guard below stops the credit repeating, so a retried cancellation
      // cannot invent inventory.
      await db.transaction(async (tx) => {
        const order = await tx.query.orders.findFirst({
          where: and(eq(orders.id, orderId), eq(orders.status, "cancelled")),
          columns: { id: true, stockRestoredAt: true },
          with: { orderItems: true },
        });
        if (!order || order.stockRestoredAt) return;

        for (const it of order.orderItems) {
          if (!it.variantId) continue;
          await tx
            .update(productVariants)
            .set({ stockQty: sql`${productVariants.stockQty} + ${it.qty}` })
            .where(eq(productVariants.id, it.variantId));
        }

        await tx
          .update(orders)
          .set({ stockRestoredAt: new Date().toISOString() })
          .where(eq(orders.id, orderId));
      });
    },

    async listByUser(userId: string): Promise<Order[]> {
      const rows = await db
        .select()
        .from(orders)
        .where(eq(orders.userId, userId))
        .orderBy(desc(orders.createdAt));
      return rows.map(toOrder);
    },

    async findByIdForUser(
      id: string,
      userId: string,
    ): Promise<OrderWithItems | null> {
      // The `userId` predicate is the replacement for the RLS policy
      // `orders_select_own_or_admin`. Without it this is an IDOR: any signed-in
      // customer could read any order by guessing its id.
      const row = await db.query.orders.findFirst({
        where: and(eq(orders.id, id), eq(orders.userId, userId)),
        with: { orderItems: true },
      });
      return row ? toOrderWithItems(row) : null;
    },

    async cancelUnpaidForUser(id: string, userId: string): Promise<boolean> {
      // Every condition lives in the WHERE clause:
      //   id + userId  — ownership, the replacement for the old RLS policy
      //   paymentStatus unpaid/failed — never cancel something paid or refunded
      //   status processing — once packed or shipped it is out of the
      //                       customer's hands and needs the team involved
      const updated = await db
        .update(orders)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(orders.id, id),
            eq(orders.userId, userId),
            inArray(orders.paymentStatus, ["unpaid", "failed"]),
            eq(orders.status, "processing"),
          ),
        )
        .returning({ id: orders.id });

      return updated.length > 0;
    },

    async findByIdAsAdmin(id: string): Promise<OrderWithItems | null> {
      const row = await db.query.orders.findFirst({
        where: eq(orders.id, id),
        with: { orderItems: true },
      });
      return row ? toOrderWithItems(row) : null;
    },
  };
}
