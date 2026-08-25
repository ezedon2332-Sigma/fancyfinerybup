"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

import { categorySchema } from "@/lib/validation";
import { deleteCategory, saveCategory } from "@/app/admin/categories/actions";
import type { AdminCategoryRow } from "@/domain/entities/admin-views";
import { toast } from "@/components/ui/Toast";

interface FormState {
  id?: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

const BLANK: FormState = { name: "", slug: "", description: "", sortOrder: 0 };

export function CategoryManager({
  categories,
}: {
  categories: AdminCategoryRow[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);

  const field =
    "w-full rounded-sm border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-yellow-500";

  function edit(c: AdminCategoryRow) {
    setForm({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? "",
      sortOrder: c.sortOrder,
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...(form.id ? { id: form.id } : {}),
      name: form.name,
      slug: form.slug || undefined,
      description: form.description || null,
      sortOrder: Number(form.sortOrder),
    };
    const parsed = categorySchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const res = await saveCategory(parsed.data);
    setSaving(false);
    if (res.ok) {
      setForm(BLANK);
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not save.");
    }
  }

  async function onDelete(c: AdminCategoryRow) {
    if (!confirm(`Delete "${c.name}"? Products keep existing but lose this collection.`)) return;
    const res = await deleteCategory(c.id);
    if (res.ok) router.refresh();
    else alert(res.error ?? "Could not delete.");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      {/* Form */}
      <form onSubmit={onSubmit} className="h-fit space-y-3 rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
            {form.id ? "Edit collection" : "New collection"}
          </h2>
          {form.id && (
            <button type="button" onClick={() => setForm(BLANK)} className="text-gray-500 hover:text-white" aria-label="Cancel edit">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <input className={field} placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <input className={field} placeholder="Slug (optional)" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
        <textarea className={`${field} h-20`} placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        <input type="number" min={0} className={field} placeholder="Sort order" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} />
        <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-yellow-500 py-2.5 font-semibold text-black hover:bg-yellow-600 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {form.id ? "Save" : "Add collection"}
        </button>
      </form>

      {/* List */}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-widest text-gray-400">
            <tr>
              <th className="px-4 py-3">Collection</th>
              <th className="px-4 py-3">Products</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-white/5">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{c.name}</p>
                  <p className="text-xs text-gray-500">/{c.slug}</p>
                </td>
                <td className="px-4 py-3 text-gray-300">{c.productCount}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <button type="button" onClick={() => edit(c)} className="text-gray-300 hover:text-yellow-400" aria-label={`Edit ${c.name}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => onDelete(c)} className="text-gray-400 hover:text-red-400" aria-label={`Delete ${c.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  No collections yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
