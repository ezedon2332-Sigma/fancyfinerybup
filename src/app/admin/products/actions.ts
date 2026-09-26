"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/infrastructure/auth/session";
import { deleteMedia } from "@/infrastructure/storage/media-storage";
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
  // Objects the save leaves unreferenced. Filled inside the transaction, acted
  // on only once it has committed.
  let orphaned: string[] = [];
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
      //
      // Note which objects this drops. Deleting the ROWS used to be the whole
      // of it, so every replaced photo and every removed video stayed in the
      // bucket forever with nothing left pointing at it — invisible, and up to
      // 200MB a time. The paths are collected here and the objects removed
      // after the transaction commits, never before: a rollback must not take
      // live media with it.
      const previous = await tx
        .select({ storagePath: productImages.storagePath })
        .from(productImages)
        .where(eq(productImages.productId, id));
      const kept = new Set(input.media.map((m) => m.storagePath));
      orphaned = previous
        .map((r) => r.storagePath)
        .filter((path) => !kept.has(path));

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

  // The product is saved; these objects are now unreferenced. A failure here
  // leaves a file nobody can see rather than losing a save the admin made, so
  // it is logged and swallowed.
  await Promise.all(
    orphaned.map((path) =>
      deleteMedia(path).catch((e) =>
        console.error("[products] could not remove orphaned media", path, e),
      ),
    ),
  );

  revalidatePath("/admin/products");
  revalidatePath("/collections");
  revalidatePath("/");
  if (slug) revalidatePath(`/products/${slug}`);
  return { ok: true, id: productId };
}

export async function deleteProduct(id: string): Promise<SaveResult> {
  await requireAdmin();
  let orphaned: string[] = [];
  try {
    // product_images cascades on the foreign key, so the rows go with the
    // product and their storage paths become unrecoverable the moment it is
    // deleted. Read them first or the objects are stranded in the bucket with
    // nothing left in the database naming them.
    orphaned = (
      await db
        .select({ storagePath: productImages.storagePath })
        .from(productImages)
        .where(eq(productImages.productId, id))
    ).map((r) => r.storagePath);

    await db.delete(products).where(eq(products.id, id));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Only after the delete succeeded — otherwise a failed delete would still
  // have destroyed the media of a product that is still on sale.
  await Promise.all(
    orphaned.map((path) =>
      deleteMedia(path).catch((e) =>
        console.error("[products] could not remove media of deleted product", path, e),
      ),
    ),
  );
  revalidatePath("/admin/products");
  revalidatePath("/collections");
  revalidatePath("/");
  return { ok: true };
}
