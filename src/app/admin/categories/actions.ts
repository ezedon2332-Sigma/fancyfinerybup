"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/infrastructure/auth/session";
import { eq } from "drizzle-orm";

import { db } from "@/infrastructure/db/client";
import { categories } from "@/infrastructure/db/schema";
import { categorySchema, slugify } from "@/lib/validation";

export interface CategoryResult {
  ok: boolean;
  error?: string;
}

export async function saveCategory(payload: unknown): Promise<CategoryResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  const input = parsed.data;
  const slug = input.slug && input.slug.length > 0 ? input.slug : slugify(input.name);
  const row = {
    name: input.name,
    slug,
    description: input.description ?? null,
    sortOrder: input.sortOrder,
  };

  try {
    if (input.id) {
      await db.update(categories).set(row).where(eq(categories.id, input.id));
    } else {
      await db.insert(categories).values(row);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: /duplicate|unique/i.test(message)
        ? "That slug is already in use."
        : message,
    };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/collections");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<CategoryResult> {
  await requireAdmin();
  try {
    await db.delete(categories).where(eq(categories.id, id));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/admin/categories");
  revalidatePath("/collections");
  return { ok: true };
}
