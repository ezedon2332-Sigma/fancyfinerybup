"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
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
  const supabase = await createSupabaseServerClient();

  const row = {
    name: input.name,
    slug,
    description: input.description ?? null,
    sort_order: input.sortOrder,
  };

  const { error } = input.id
    ? await supabase.from("categories").update(row).eq("id", input.id)
    : await supabase.from("categories").insert(row);

  if (error) {
    return {
      ok: false,
      error: /duplicate|unique/i.test(error.message)
        ? "That slug is already in use."
        : error.message,
    };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/collections");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<CategoryResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/categories");
  revalidatePath("/collections");
  return { ok: true };
}
