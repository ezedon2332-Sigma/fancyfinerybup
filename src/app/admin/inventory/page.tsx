import type { Metadata } from "next";
import Link from "next/link";

import { loadInventory } from "@/infrastructure/db/admin-read-service";

export const metadata: Metadata = { title: "Admin · Inventory" };

const LOW_STOCK = 5;

interface Row {
  productId: string;
  productName: string;
  slug: string;
  label: string;
  sku: string | null;
  stock: number;
}

export default async function InventoryPage() {
  const catalogue = await loadInventory();

  const rows: Row[] = [];
  for (const p of catalogue) {
    const variants = p.variants;
    if (variants.length === 0) {
      rows.push({ productId: p.id, productName: p.name, slug: p.slug, label: "—", sku: null, stock: 0 });
      continue;
    }
    for (const v of variants) {
      rows.push({
        productId: p.id,
        productName: p.name,
        slug: p.slug,
        label: [v.size, v.color].filter(Boolean).join(" · ") || "One size",
        sku: v.sku,
        stock: v.stockQty,
      });
    }
  }

  const totalUnits = rows.reduce((n, r) => n + r.stock, 0);
  const outCount = rows.filter((r) => r.stock <= 0).length;
  const lowCount = rows.filter((r) => r.stock > 0 && r.stock <= LOW_STOCK).length;

  const badge = (stock: number) =>
    stock <= 0
      ? "bg-red-500/15 text-red-400"
      : stock <= LOW_STOCK
        ? "bg-yellow-500/15 text-yellow-400"
        : "bg-green-500/15 text-green-400";
  const label = (stock: number) =>
    stock <= 0 ? "Out of stock" : stock <= LOW_STOCK ? "Low" : "In stock";

  return (
    <div>
      <h1 className="text-2xl font-bold">Inventory</h1>
      <p className="mt-1 text-sm text-gray-400">
        Stock levels across every product variant. Edit a product to adjust stock.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-400">SKUs</p>
          <p className="mt-1 text-2xl font-bold text-yellow-400">{rows.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-400">Total units</p>
          <p className="mt-1 text-2xl font-bold text-yellow-400">{totalUnits}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-400">Low stock</p>
          <p className="mt-1 text-2xl font-bold text-yellow-400">{lowCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-400">Out of stock</p>
          <p className="mt-1 text-2xl font-bold text-red-400">{outCount}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 text-gray-400">No products yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-widest text-gray-400">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r, i) => (
                <tr key={`${r.productId}-${i}`} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${r.productId}`} className="text-white hover:text-yellow-400">
                      {r.productName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{r.label}</td>
                  <td className="px-4 py-3 text-gray-500">{r.sku ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold text-gray-200">{r.stock}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge(r.stock)}`}>
                      {label(r.stock)}
                    </span>
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
