import "server-only";

import { asc, eq } from "drizzle-orm";

import type { Category } from "@/domain/entities/category";
import type { CategoryRepository } from "@/domain/repositories/category-repository";
import type { Database } from "../client";
import { categories } from "../schema";
import { toCategory } from "../mappers";

/**
 * Drizzle-backed CategoryRepository. Categories are world-readable (the old RLS
 * policy was `for select using (true)`), so nothing here is scoped.
 */
export function createCategoryRepository(db: Database): CategoryRepository {
  return {
    async listAll(): Promise<Category[]> {
      const rows = await db
        .select()
        .from(categories)
        .orderBy(asc(categories.sortOrder));
      return rows.map(toCategory);
    },

    async findBySlug(slug: string): Promise<Category | null> {
      const [row] = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);
      return row ? toCategory(row) : null;
    },
  };
}
