"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Loader2, Plus, Trash2, UploadCloud, X } from "lucide-react";

import { resolveImageUrl } from "@/infrastructure/supabase/image-url";
import { productSchema } from "@/lib/validation";
import { saveProduct, uploadMedia } from "@/app/admin/products/actions";
import type { AdminProductDetail } from "@/infrastructure/supabase/admin-service";

interface CategoryOption {
  id: string;
  name: string;
}
interface MediaItem {
  storagePath: string;
  mediaType: "image" | "video";
  alt: string | null;
}
interface VariantRow {
  size: string;
  color: string;
  sku: string;
  stockQty: number;
}

export function ProductForm({
  categories,
  initial,
}: {
  categories: CategoryOption[];
  initial: AdminProductDetail | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priceNaira, setPriceNaira] = useState(initial?.priceNaira ?? 0);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [media, setMedia] = useState<MediaItem[]>(initial?.media ?? []);
  const [variants, setVariants] = useState<VariantRow[]>(
    initial?.variants.map((v) => ({
      size: v.size ?? "",
      color: v.color ?? "",
      sku: v.sku ?? "",
      stockQty: v.stockQty,
    })) ?? [],
  );

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadMedia(fd);
      if (res.ok && res.path && res.mediaType) {
        setMedia((m) => [
          ...m,
          { storagePath: res.path!, mediaType: res.mediaType!, alt: name || null },
        ]);
      } else {
        setError(res.error ?? "Upload failed.");
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeMedia(i: number) {
    setMedia((m) => m.filter((_, idx) => idx !== i));
  }

  function addVariant() {
    setVariants((v) => [...v, { size: "", color: "", sku: "", stockQty: 0 }]);
  }
  function updateVariant(i: number, patch: Partial<VariantRow>) {
    setVariants((v) => v.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removeVariant(i: number) {
    setVariants((v) => v.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = {
      ...(initial ? { id: initial.id } : {}),
      name,
      slug: slug || undefined,
      description: description || null,
      priceNaira: Number(priceNaira),
      categoryId: categoryId || null,
      status,
      featured,
      media,
      variants: variants.map((v) => ({
        size: v.size || null,
        color: v.color || null,
        sku: v.sku || null,
        stockQty: Number(v.stockQty),
      })),
    };

    const parsed = productSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setSaving(true);
    const res = await saveProduct(parsed.data);
    if (res.ok) {
      router.push("/admin/products");
      router.refresh();
    } else {
      setSaving(false);
      setError(res.error ?? "Could not save.");
    }
  }

  const field =
    "w-full rounded-sm border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-yellow-500";

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs uppercase tracking-widest text-gray-400">Name</span>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-gray-400">Slug (optional)</span>
          <input className={field} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto from name" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-gray-400">Price (₦)</span>
          <input type="number" min={0} step="0.01" className={field} value={priceNaira} onChange={(e) => setPriceNaira(Number(e.target.value))} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs uppercase tracking-widest text-gray-400">Description</span>
          <textarea className={`${field} h-28`} value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-gray-400">Collection</span>
          <select className={field} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-gray-400">Status</span>
          <select className={field} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 accent-yellow-500" />
          <span className="text-sm text-gray-200">Featured on home page</span>
        </label>
      </div>

      {/* Media */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-widest text-gray-300">
            Media (images & videos)
          </span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-sm border border-yellow-500/40 px-4 py-2 text-xs font-medium text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Upload
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={onFiles} />
        </div>
        {media.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No media yet. Upload images or videos — the first image is the thumbnail.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {media.map((m, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-lg bg-neutral-900">
                {m.mediaType === "video" ? (
                  <video src={resolveImageUrl(m.storagePath)} muted className="h-full w-full object-cover" />
                ) : (
                  <Image src={resolveImageUrl(m.storagePath)} alt="" fill className="object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removeMedia(i)}
                  className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-red-500"
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 rounded bg-yellow-500 px-1.5 text-[10px] font-bold text-black">
                    Thumb
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Variants */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-widest text-gray-300">
            Variants (size / colour / stock)
          </span>
          <button type="button" onClick={addVariant} className="inline-flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        {variants.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No variants — add at least one so it can be purchased.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {variants.map((v, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_80px_auto] gap-2">
                <input className={field} placeholder="Size" value={v.size} onChange={(e) => updateVariant(i, { size: e.target.value })} />
                <input className={field} placeholder="Colour" value={v.color} onChange={(e) => updateVariant(i, { color: e.target.value })} />
                <input className={field} placeholder="SKU" value={v.sku} onChange={(e) => updateVariant(i, { sku: e.target.value })} />
                <input type="number" min={0} className={field} placeholder="Qty" value={v.stockQty} onChange={(e) => updateVariant(i, { stockQty: Number(e.target.value) })} />
                <button type="button" onClick={() => removeVariant(i)} className="px-2 text-gray-500 hover:text-red-400" aria-label="Remove variant">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving || uploading} className="inline-flex items-center gap-2 rounded-sm bg-yellow-500 px-6 py-3 font-semibold text-black hover:bg-yellow-600 disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? "Save changes" : "Create product"}
        </button>
        <button type="button" onClick={() => router.push("/admin/products")} className="rounded-sm border border-white/20 px-6 py-3 text-sm hover:border-white/40">
          Cancel
        </button>
      </div>
    </form>
  );
}
