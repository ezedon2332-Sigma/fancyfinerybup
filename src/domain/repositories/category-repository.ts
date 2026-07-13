import type { Category } from "../entities/category";

/** Port: how the application reads/writes categories, independent of Supabase. */
export interface CategoryRepository {
  listAll(): Promise<Category[]>;
  findBySlug(slug: string): Promise<Category | null>;
}
