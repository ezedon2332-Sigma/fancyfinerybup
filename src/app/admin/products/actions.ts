"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
import { productSchema, slugify } from "@/lib/validation";
import { toGrams } from "@/domain/shipping/engine";

const BUCKET = "product-images";
const MAX_BYTES = 50 * 1024 * 1024; // 50MB (covers short videos)

export interface UploadResult {
  ok: boolean;
  path?: string;
  mediaType?: "image" | "video";
  error?: string;
}

export async function uploadMedia(formData: FormData): Promise<UploadResult> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file provided." };
  if (file.size > MAX_BYTES) return { ok: false, error: "File is too large (max 50MB)." };

  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) {
    return { ok: false, error: "Only image or video files are allowed." };
  }

  const ext = (file.name.split(".").pop() || (isVideo ? "mp4" : "jpg"))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const path = `products/${crypto.randomUUID()}.${ext}`;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: error.message };

  return { ok: true, path, mediaType: isVideo ? "video" : "image" };
}

export interface SaveResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function saveProduct(payload: unknown): Promise<SaveResult> {
  await requireAdmin();

  const parsed = productSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid product." };
  }
  const input = parsed.data;
  const slug = input.slug && input.slug.length > 0 ? input.slug : slugify(input.name);
  const supabase = await createSupabaseServerClient();

  const row = {
    name: input.name,
    slug,
    description: input.description ?? null,
    price: Math.round(input.priceNaira * 100),
    currency: "NGN",
    category_id: input.categoryId ?? null,
    status: input.status,
    featured: input.featured,
    // Stored canonically in grams; weight_unit only records how it was typed.
    weight_grams: toGrams(input.weight, input.weightUnit),
    weight_unit: input.weightUnit,
    // Dimensions are entered in cm and stored in mm, so integer maths holds.
    length_mm: Math.round(input.lengthCm * 10),
    width_mm: Math.round(input.widthCm * 10),
    height_mm: Math.round(input.heightCm * 10),
    shipping_class: input.shippingClass,
    is_fragile: input.isFragile,
    is_oversized: input.isOversized,
    ships_separately: input.shipsSeparately,
    free_shipping_eligible: input.freeShippingEligible,
    warehouse_location: input.warehouseLocation || null,
    country_of_origin: input.countryOfOrigin || null,
  };

  // The shipping attributes arrive with the shipping-module migration. If the
  // deploy lands first, drop them and save the rest rather than refusing to
  // save the product at all.
  const isUnknownColumn = (e: { code?: string; message?: string }) =>
    e.code === "PGRST204" ||
    e.code === "42703" ||
    /column .* does not exist/i.test(e.message ?? "");

  const SHIPPING_COLUMNS = [
    "length_mm", "width_mm", "height_mm", "shipping_class", "is_fragile",
    "is_oversized", "ships_separately", "free_shipping_eligible",
    "warehouse_location", "country_of_origin",
  ];
  const withoutShipping = () =>
    Object.fromEntries(
      Object.entries(row).filter(([k]) => !SHIPPING_COLUMNS.includes(k)),
    ) as typeof row;

  let productId = input.id;
  try {
    if (productId) {
      let { error } = await supabase.from("products").update(row).eq("id", productId);
      if (error && isUnknownColumn(error)) {
        ({ error } = await supabase
          .from("products")
          .update(withoutShipping())
          .eq("id", productId));
      }
      if (error) throw error;
    } else {
      let { data, error } = await supabase
        .from("products")
        .insert(row)
        .select("id")
        .single();
      if (error && isUnknownColumn(error)) {
        ({ data, error } = await supabase
          .from("products")
          .insert(withoutShipping())
          .select("id")
          .single());
      }
      if (error) throw error;
      if (!data) throw new Error("Product insert returned no row.");
      productId = data.id;
    }

    // Replace media + variants wholesale (simple + predictable).
    await supabase.from("product_images").delete().eq("product_id", productId);
    if (input.media.length > 0) {
      const { error } = await supabase.from("product_images").insert(
        input.media.map((m, i) => ({
          product_id: productId!,
          storage_path: m.storagePath,
          media_type: m.mediaType,
          alt: m.alt ?? input.name,
          sort_order: i,
        })),
      );
      if (error) throw error;
    }

    await supabase.from("product_variants").delete().eq("product_id", productId);
    if (input.variants.length > 0) {
      const { error } = await supabase.from("product_variants").insert(
        input.variants.map((v) => ({
          product_id: productId!,
          size: v.size || null,
          color: v.color || null,
          sku: v.sku || null,
          stock_qty: v.stockQty,
        })),
      );
      if (error) throw error;
    }
  } catch (e) {
    // Supabase/Postgrest errors are plain objects, not Error instances — pull
    // the real message out instead of masking it as a generic failure.
    const msg =
      e instanceof Error
        ? e.message
        : e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "Could not save product.";

    // If we just created a NEW product but a later step failed, remove the
    // orphan row so the next attempt doesn't collide on the (unique) slug.
    if (!input.id && productId) {
      await supabase
        .from("products")
        .delete()
        .eq("id", productId)
        .then(
          () => undefined,
          () => undefined,
        );
    }

    if (/duplicate key|already exists|unique/i.test(msg)) {
      return {
        ok: false,
        error: "That product name/slug or a SKU is already in use — try a different name.",
      };
    }
    return { ok: false, error: msg || "Could not save product." };
  }

  revalidatePath("/admin/products");
  revalidatePath("/collections");
  revalidatePath("/");
  if (slug) revalidatePath(`/products/${slug}`);
  return { ok: true, id: productId };
}

export async function deleteProduct(id: string): Promise<SaveResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/products");
  revalidatePath("/collections");
  revalidatePath("/");
  return { ok: true };
}
