import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Pencil, Plus } from "lucide-react";

import { listAdminProducts } from "@/infrastructure/db/admin-service";
import { formatMoney } from "@/domain/shared/money";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";

export const metadata: Metadata = { title: "Admin · Products" };

const STATUS_STYLES: Record<string, string> = {
  published: "bg-green-500/15 text-green-400",
  draft: "bg-white/10 text-gray-300",
  archived: "bg-red-500/15 text-red-400",
};

export default async function AdminProductsPage() {
  const products = await listAdminProducts();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 rounded-sm bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-600"
        >
          <Plus className="h-4 w-4" /> New product
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="mt-10 text-gray-400">No products yet. Create your first.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-widest text-gray-400">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Collection</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded bg-neutral-900">
                        {p.thumbnail && (
                          <Image
                            src={p.thumbnail}
                            alt=""
                            fill
                            // Fixed 40px row thumbnail. Without sizes, `fill`
                            // implies 100vw — a full-width variant per product
                            // for every row of the admin list.
                            sizes="40px"
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">{p.name}</p>
                        <p className="text-xs text-gray-500">
                          {p.mediaCount} media{p.featured ? " · featured" : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{p.categoryName ?? "—"}</td>
                  <td className="px-4 py-3 text-yellow-400">
                    {formatMoney(p.price, p.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="inline-flex items-center gap-1 text-gray-300 hover:text-yellow-400"
                        aria-label={`Edit ${p.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <DeleteProductButton id={p.id} name={p.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
