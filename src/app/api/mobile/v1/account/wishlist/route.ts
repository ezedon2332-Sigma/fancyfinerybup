import {
  addFavorite,
  listFavoriteProducts,
  mergeFavorites,
  removeFavorite,
} from "@/infrastructure/db/favorites-service";
import { loadExchangeRates } from "@/infrastructure/db/exchange-rate-service";

import { jsonBody, requestCurrency, requireUser } from "../../../_lib/context";
import { mediaUrl, money } from "../../../_lib/dto";
import { fail, handler, ok } from "../../../_lib/respond";

/**
 * GET /api/mobile/v1/account/wishlist
 *
 * Saved pieces, whole — name, price and image, not just ids. Returning ids
 * alone is a mistake this codebase has already made once: the wishlist rendered
 * blank tiles at ₦0 because the client had nothing to draw.
 *
 * Withdrawn products are filtered out by the service, so a customer is never
 * shown something they cannot buy.
 */
export const GET = handler(async () => {
  const user = await requireUser();

  const [items, currency, rates] = await Promise.all([
    listFavoriteProducts(user.id),
    requestCurrency(),
    loadExchangeRates(),
  ]);

  return ok({
    items: items.map((item) => ({
      productId: item.productId,
      slug: item.slug,
      name: item.name,
      price: money(item.price, currency, rates),
      imageUrl: item.image ? mediaUrl(item.image) : null,
    })),
  });
});

/**
 * POST /api/mobile/v1/account/wishlist
 *
 * Body is either `{ productId }` to save one piece, or `{ productIds: [...] }`
 * to fold a signed-out device's local list into the account at sign-in.
 *
 * The merge is a union, never a replace. A shopper who hearts three pieces
 * before signing in should not watch the hearts empty the moment they do — and
 * the account's own list is no more stale than the device's.
 *
 * Adding is idempotent, so a retried request on a flaky connection is harmless.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();

  const body = await jsonBody(req);
  if (body === null || typeof body !== "object") {
    return fail("invalid_request", "Expected a JSON body.");
  }

  const { productId, productIds } = body as {
    productId?: unknown;
    productIds?: unknown;
  };

  if (Array.isArray(productIds)) {
    const ids = productIds.filter((v): v is string => typeof v === "string");
    await mergeFavorites(user.id, ids);
    return ok({ merged: ids.length });
  }

  if (typeof productId !== "string" || productId.length === 0) {
    return fail("invalid_request", "A productId is required.", "productId");
  }

  await addFavorite(user.id, productId);
  return ok({ saved: true });
});

/**
 * DELETE /api/mobile/v1/account/wishlist?productId=…
 *
 * Scoped to the caller inside the service, so one customer cannot clear
 * another's list. A delete that matches nothing affects no rows and still
 * reports success — removing something already removed is not an error.
 */
export const DELETE = handler(async (req: Request) => {
  const user = await requireUser();

  const productId = new URL(req.url).searchParams.get("productId");
  if (!productId) {
    return fail("invalid_request", "A productId is required.", "productId");
  }

  await removeFavorite(user.id, productId);
  return ok({ removed: true });
});
