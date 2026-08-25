"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/infrastructure/auth/session";
import {
  addFavorite,
  listFavoriteProducts,
  mergeFavorites,
  removeFavorite,
  type FavoriteProduct,
} from "@/infrastructure/db/favorites-service";
import { resolveMediaUrl } from "@/lib/media-url";

export interface FavoriteResult {
  ok: boolean;
  /** Whether the product is favourited AFTER this call. */
  favorited?: boolean;
  error?: string;
}

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Toggle a favourite for the signed-in customer.
 *
 * Signed-out visitors are not an error: the heart still works for them, backed
 * by localStorage, and `syncFavorites` folds that list in when they sign in.
 * Returning `ok: false` here would make the UI show a failure for something
 * that visibly worked.
 */
export async function toggleFavorite(
  productId: string,
  favorited: boolean,
): Promise<FavoriteResult> {
  if (!UUID.test(productId)) return { ok: false, error: "Invalid product." };

  const user = await getCurrentUser();
  // Not signed in — the browser keeps the list; nothing to persist.
  if (!user) return { ok: true, favorited };

  try {
    if (favorited) {
      await addFavorite(user.id, productId);
    } else {
      await removeFavorite(user.id, productId);
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/wishlist");
  return { ok: true, favorited };
}

/** What the wishlist card needs. Image is a resolved URL, ready to render. */
export interface SyncedFavorite extends Omit<FavoriteProduct, "image"> {
  image: string;
}

/**
 * Reconcile the browser's list with the account's on sign-in.
 *
 * Returns FULL items, not ids. Returning ids alone made the client adopt
 * `{ productId }` placeholders with no name, price or image, and the wishlist
 * rendered blank tiles at ₦0 — a saved item has to arrive whole or the page
 * cannot draw it.
 *
 * On failure it returns nothing to adopt rather than an empty list, so a sync
 * error can never look like "your wishlist is empty".
 */
export async function syncFavorites(
  localProductIds: string[],
): Promise<{ ok: boolean; items: SyncedFavorite[] }> {
  const user = await getCurrentUser();
  if (!user) return { ok: true, items: [] };

  try {
    if (Array.isArray(localProductIds) && localProductIds.length > 0) {
      await mergeFavorites(user.id, localProductIds.slice(0, 200));
    }
    const rows = await listFavoriteProducts(user.id);
    return {
      ok: true,
      items: rows.map((r) => ({
        ...r,
        // Resolved server-side so the client never needs the storage layout.
        image: r.image ? resolveMediaUrl(r.image) : "",
      })),
    };
  } catch {
    return { ok: false, items: [] };
  }
}
