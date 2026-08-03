import "server-only";

import type { OrderStatus } from "@/domain/entities/order";
import type { ProductStatus } from "@/domain/entities/product";
import { createSupabaseServerClient } from "./server-client";
import { resolveImageUrl } from "./image-url";

/** Admin views. All reads run through the RLS-scoped server client; the admin
 *  role (is_admin()) grants access to drafts/all orders. */

export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  featured: boolean;
  price: number;
  currency: string;
  categoryName: string | null;
  thumbnail: string | null;
  mediaCount: number;
}

export async function listAdminProducts(): Promise<AdminProductRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, categories(name), product_images(storage_path, sort_order, media_type)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((p) => {
    const media = [...(p.product_images ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    const image = media.find((m) => m.media_type === "image") ?? media[0];
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      status: p.status,
      featured: p.featured,
      price: p.price,
      currency: p.currency,
      categoryName: (p.categories as { name: string } | null)?.name ?? null,
      thumbnail: image ? resolveImageUrl(image.storage_path) : null,
      mediaCount: media.length,
    };
  });
}

export interface AdminProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceNaira: number;
  categoryId: string | null;
  status: ProductStatus;
  featured: boolean;
  weightGrams: number;
  weightUnit: "g" | "kg";
  media: { storagePath: string; mediaType: "image" | "video"; alt: string | null }[];
  variants: {
    id: string;
    size: string | null;
    color: string | null;
    sku: string | null;
    stockQty: number;
  }[];
}

export async function getAdminProduct(
  id: string,
): Promise<AdminProductDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_images(*), product_variants(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: data.description,
    priceNaira: data.price / 100,
    categoryId: data.category_id,
    status: data.status,
    featured: data.featured,
    weightGrams: data.weight_grams ?? 0,
    weightUnit: (data.weight_unit ?? "g") === "kg" ? "kg" : "g",
    media: [...(data.product_images ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({
        storagePath: m.storage_path,
        mediaType: m.media_type,
        alt: m.alt,
      })),
    variants: (data.product_variants ?? []).map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      sku: v.sku,
      stockQty: v.stock_qty,
    })),
  };
}

export interface AdminCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  productCount: number;
}

export async function listAdminCategories(): Promise<AdminCategoryRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*, products(id)")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    sortOrder: c.sort_order,
    productCount: (c.products as { id: string }[] | null)?.length ?? 0,
  }));
}

export interface AdminOrderRow {
  id: string;
  status: OrderStatus;
  paymentStatus: string;
  total: number;
  currency: string;
  customerName: string | null;
  customerEmail: string | null;
  createdAt: string;
  itemCount: number;
}

export async function listAdminOrders(): Promise<AdminOrderRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((o) => ({
    id: o.id,
    status: o.status,
    paymentStatus: o.payment_status ?? "unpaid",
    total: o.total,
    currency: o.currency,
    customerName: o.shipping_name,
    customerEmail: o.shipping_email,
    createdAt: o.created_at,
    itemCount: (o.order_items as { id: string }[] | null)?.length ?? 0,
  }));
}
