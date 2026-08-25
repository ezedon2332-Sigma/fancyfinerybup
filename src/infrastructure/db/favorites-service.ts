import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "./client";
import { productFavorites, products } from "./schema";

/**
 * Favourites — the heart icon, made real.
 *
 * It previously wrote only to localStorage, which meant a favourite was a
 * property of a BROWSER rather than a person: lost on a new device, inherited
 * by whoever used the machine next, and invisible to the shop. Persisting it
 * per user turns it into a signal the catalogue and the admin can both read.
 *
 * Every write is scoped by `userId` in the statement itself — the same rule as
 * orders. There is no "check then write": the composite primary key makes a
 * repeat add a no-op, and a delete that matches nothing simply affects no rows.
 */

/** Add a favourite. Idempotent — a second tap changes nothing. */
export async function addFavorite(
  userId: string,
  productId: string,
): Promise<void> {
  await db
    .insert(productFavorites)
    .values({ userId, productId })
    .onConflictDoNothing();
}

/** Remove a favourite. Scoped, so one customer cannot clear another's. */
export async function removeFavorite(
  userId: string,
  productId: string,
): Promise<void> {
  await db
    .delete(productFavorites)
    .where(
      and(
        eq(productFavorites.userId, userId),
        eq(productFavorites.productId, productId),
      ),
    );
}

/** Product ids this customer has favourited. */
export async function listFavoriteIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ productId: productFavorites.productId })
    .from(productFavorites)
    .where(eq(productFavorites.userId, userId));
  return rows.map((r) => r.productId);
}

export interface FavoriteProduct {
  productId: string;
  slug: string;
  name: string;
  /** NGN minor units (kobo). */
  price: number;
  /** storage_path — the caller resolves it to a URL. */
  image: string;
}

/**
 * Favourites with everything the wishlist card renders.
 *
 * Ids alone are not enough, and that is not a theoretical point: returning only
 * ids meant the client adopted `{ productId }` objects with no name, price or
 * image, and the wishlist rendered two blank tiles at ₦0. A saved item has to
 * arrive whole.
 *
 * Unpublished products are excluded — a customer should not be shown, or be
 * able to reach, something that has been withdrawn from sale.
 */
export async function listFavoriteProducts(
  userId: string,
): Promise<FavoriteProduct[]> {
  const rows = await db
    .select({
      productId: products.id,
      slug: products.slug,
      name: products.name,
      price: products.price,
      image: sql<string>`coalesce((
        select pi.storage_path from product_images pi
        where pi.product_id = ${products.id} and pi.media_type = 'image'
        order by pi.sort_order asc limit 1
      ), '')`,
    })
    .from(productFavorites)
    .innerJoin(products, eq(products.id, productFavorites.productId))
    .where(
      and(
        eq(productFavorites.userId, userId),
        eq(products.status, "published"),
      ),
    )
    .orderBy(desc(productFavorites.createdAt));

  return rows;
}

/**
 * Fold a signed-out visitor's localStorage list into their account on sign-in.
 *
 * Without this, a shopper who hearts three pieces and then signs in to buy them
 * watches the hearts empty — the account list replaces the browser list. The
 * union is the only defensible merge: neither side is stale, and a favourite is
 * cheap to keep and annoying to lose.
 */
export async function mergeFavorites(
  userId: string,
  productIds: string[],
): Promise<void> {
  const ids = productIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (ids.length === 0) return;

  // Only ids that are real products — the list comes from a client and a stale
  // or forged entry would otherwise fail the whole insert on the foreign key.
  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(inArray(products.id, ids));

  if (existing.length === 0) return;

  await db
    .insert(productFavorites)
    .values(existing.map((p) => ({ userId, productId: p.id })))
    .onConflictDoNothing();
}

/** How many customers have favourited each of these products. */
export async function favoriteCounts(
  productIds: string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const rows = await db
    .select({
      productId: productFavorites.productId,
      n: sql<number>`count(*)::int`,
    })
    .from(productFavorites)
    .where(inArray(productFavorites.productId, productIds))
    .groupBy(productFavorites.productId);
  return new Map(rows.map((r) => [r.productId, r.n]));
}

/**
 * Published products ordered by how many customers favourited them.
 *
 * Only products with at least one favourite are returned — a zero-favourite
 * product is not "least loved", it is unrated, and padding the row with them
 * would present arbitrary order as a ranking. Callers fall back to another
 * ordering when this comes back short.
 */
export async function listMostFavoritedProductIds(limit = 8): Promise<string[]> {
  try {
    const rows = await db
      .select({
        productId: productFavorites.productId,
        n: sql<number>`count(*)::int`,
      })
      .from(productFavorites)
      .innerJoin(products, eq(products.id, productFavorites.productId))
      .where(eq(products.status, "published"))
      .groupBy(productFavorites.productId)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
    return rows.map((r) => r.productId);
  } catch {
    return [];
  }
}

export interface AdminFavoriteRow {
  productId: string;
  name: string;
  slug: string;
  favorites: number;
}

/** The admin view: what customers want, most-wanted first. */
export async function listFavoritesForAdmin(
  limit = 100,
): Promise<AdminFavoriteRow[]> {
  return db
    .select({
      productId: products.id,
      name: products.name,
      slug: products.slug,
      favorites: sql<number>`count(${productFavorites.userId})::int`,
    })
    .from(products)
    .innerJoin(
      productFavorites,
      eq(productFavorites.productId, products.id),
    )
    .groupBy(products.id)
    .orderBy(desc(sql`count(${productFavorites.userId})`))
    .limit(limit);
}
