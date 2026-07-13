import type { SupabaseClient } from "@supabase/supabase-js";

import type { Category } from "@/domain/entities/category";
import type { CategoryRepository } from "@/domain/repositories/category-repository";
import type { Database } from "../database.types";
import { toCategory } from "../mappers";

export function createCategoryRepository(
  client: SupabaseClient<Database>,
): CategoryRepository {
  return {
    async listAll(): Promise<Category[]> {
      const { data, error } = await client
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(toCategory);
    },

    async findBySlug(slug: string): Promise<Category | null> {
      const { data, error } = await client
        .from("categories")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data ? toCategory(data) : null;
    },
  };
}
