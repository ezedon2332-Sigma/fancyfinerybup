import type { Metadata } from "next";

import { ProductForm } from "@/components/admin/ProductForm";
import { listAdminCategories } from "@/infrastructure/supabase/admin-service";

export const metadata: Metadata = { title: "Admin · New product" };

export default async function NewProductPage() {
  const categories = await listAdminCategories();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">New product</h1>
      <ProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={null}
      />
    </div>
  );
}
