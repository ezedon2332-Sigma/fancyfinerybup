import type { Metadata } from "next";

import { CategoryManager } from "@/components/admin/CategoryManager";
import { listAdminCategories } from "@/infrastructure/supabase/admin-service";

export const metadata: Metadata = { title: "Admin · Collections" };

export default async function AdminCategoriesPage() {
  const categories = await listAdminCategories();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Collections</h1>
      <CategoryManager categories={categories} />
    </div>
  );
}
