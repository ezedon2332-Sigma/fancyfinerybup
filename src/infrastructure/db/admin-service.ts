import "server-only";

import { asc, desc, eq, sql } from "drizzle-orm";

import type {
  AdminCategoryRow,
  AdminOrderRow,
  AdminProductDetail,
  AdminProductRow,
} from "@/domain/entities/admin-views";
import { resolveMediaUrl } from "@/lib/media-url";
import { toAdminOrderStatus } from "./mappers";
import { db } from "./client";
import { categories, orderItems, orders, products } from "./schema";

/**
 * Admin read models.
 *
 * Under Supabase these queries ran through the RLS-scoped client and relied on
 * `is_admin()` to widen what came back (drafts, every customer's orders). There
 * is no policy now, so **every caller must have passed `requireAdmin()` first** —
 * these functions return unfiltered data by design and enforce nothing
 * themselves. That check lives in the /admin layout and in each admin Server
 * Action, which is where the original design put the authoritative gate anyway
 * (see AGENTS.md: the proxy was never the security boundary).
 */

export async function listAdminProducts(): Promise<AdminProductRow[]> {
  const rows = await db.query.products.findMany({
    with: { productImages: true, category: true },
    orderBy: [desc(products.createdAt)],
  });

  return rows.map((p) => {
    const media = [...p.productImages].sort((a, b) => a.sortOrder - b.sortOrder);
    const image = media.find((m) => m.mediaType === "image") ?? media[0];
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      status: p.status,
      featured: p.featured,
      price: p.price,
      currency: p.currency,
      categoryName: p.category?.name ?? null,
      thumbnail: image ? resolveMediaUrl(image.storagePath) : null,
      mediaCount: media.length,
    };
  });
}

export async function getAdminProduct(
  id: string,
): Promise<AdminProductDetail | null> {
  const p = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: { productImages: true, productVariants: true },
  });
  if (!p) return null;

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    priceNaira: p.price / 100,
    categoryId: p.categoryId,
    status: p.status,
    featured: p.featured,
    lookbook: p.lookbook,
    weightGrams: p.weightGrams ?? 0,
    weightUnit: (p.weightUnit ?? "g") === "kg" ? "kg" : "g",
    media: [...p.productImages]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({
        storagePath: m.storagePath,
        mediaType: m.mediaType as "image" | "video",
        alt: m.alt,
      })),
    variants: p.productVariants.map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      sku: v.sku,
      stockQty: v.stockQty,
    })),
  };
}

export async function listAdminCategories(): Promise<AdminCategoryRow[]> {
  // Counted in SQL rather than by fetching every product id and taking
  // `.length`, which is what the PostgREST embed (`categories(*, products(id))`)
  // forced. Same output, without dragging the whole catalogue over the wire to
  // render four numbers.
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      sortOrder: categories.sortOrder,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder));

  return rows;
}

export async function listAdminOrders(): Promise<AdminOrderRow[]> {
  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      total: orders.total,
      currency: orders.currency,
      customerName: orders.shippingName,
      customerEmail: orders.shippingEmail,
      createdAt: orders.createdAt,
      itemCount: sql<number>`count(${orderItems.id})::int`,
    })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .groupBy(orders.id)
    .orderBy(desc(orders.createdAt));

  return rows.map((o) => ({
    ...o,
    status: toAdminOrderStatus(o.status),
    paymentStatus: o.paymentStatus ?? "unpaid",
  }));
}
