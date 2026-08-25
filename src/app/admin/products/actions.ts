"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/infrastructure/auth/session";
import { eq } from "drizzle-orm";

import { db } from "@/infrastructure/db/client";
import { productImages, productVariants, products } from "@/infrastructure/db/schema";
import { productSchema, slugify } from "@/lib/validation";
import { toGrams } from "@/domain/entities/product";

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
  const row = {
    name: input.name,
    slug,
    description: input.description ?? null,
    price: Math.round(input.priceNaira * 100),
    currency: "NGN",
    categoryId: input.categoryId ?? null,
    status: input.status,
    featured: input.featured,
    lookbook: input.lookbook,
    // Stored canonically in grams; weightUnit only records how it was typed.
    weightGrams: toGrams(input.weight, input.weightUnit),
    weightUnit: input.weightUnit,
  };

  let productId = input.id;
  try {
    // One transaction for the product, its media and its variants.
    //
    // The Supabase version issued five separate statements and, when a later
    // one failed after creating a NEW product, deleted the orphan by hand so
    // the next attempt would not collide on the unique slug. That cleanup was
    // itself best-effort — if it failed, the slug stayed taken. A transaction
    // makes the whole save atomic, so there is no orphan to chase.
    productId = await db.transaction(async (tx) => {
      let id = productId;
      if (id) {
        await tx.update(products).set(row).where(eq(products.id, id));
      } else {
        const [created] = await tx
          .insert(products)
          .values(row)
          .returning({ id: products.id });
        if (!created) throw new Error("Product insert returned no row.");
        id = created.id;
      }

      // Replace media + variants wholesale (simple + predictable).
      await tx.delete(productImages).where(eq(productImages.productId, id));
      if (input.media.length > 0) {
        await tx.insert(productImages).values(
          input.media.map((m, i) => ({
            productId: id!,
            storagePath: m.storagePath,
            mediaType: m.mediaType,
            alt: m.alt ?? input.name,
            sortOrder: i,
          })),
        );
      }

      await tx.delete(productVariants).where(eq(productVariants.productId, id));
      if (input.variants.length > 0) {
        await tx.insert(productVariants).values(
          input.variants.map((v) => ({
            productId: id!,
            size: v.size || null,
            color: v.color || null,
            sku: v.sku || null,
            stockQty: v.stockQty,
          })),
        );
      }

      return id;
    });
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "Could not save product.";

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
  try {
    await db.delete(products).where(eq(products.id, id));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/admin/products");
  revalidatePath("/collections");
  revalidatePath("/");
  return { ok: true };
}
