"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { fromGrams, toGrams } from "@/domain/entities/product";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Film,
  GripVertical,
  Loader2,
  Plus,
  Star,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import { resolveImageUrl } from "@/infrastructure/supabase/image-url";
import {
  uploadMediaWithProgress,
  validateMediaFile,
} from "@/lib/upload-media";
import { productSchema } from "@/lib/validation";
import { saveProduct } from "@/app/admin/products/actions";
import type { AdminProductDetail } from "@/infrastructure/supabase/admin-service";

const MAX_MEDIA = 100;

interface CategoryOption {
  id: string;
  name: string;
}
interface MediaItem {
  storagePath: string;
  mediaType: "image" | "video";
  alt: string;
}
interface UploadTask {
  id: string;
  name: string;
  progress: number;
  error: string | null;
  abort: () => void;
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
  const dragIndex = useRef<number | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priceNaira, setPriceNaira] = useState(initial?.priceNaira ?? 0);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  // Shown in whichever unit it was saved in; converted to grams on submit.
  const [weightUnit, setWeightUnit] = useState<"g" | "kg">(
    initial?.weightUnit ?? "g",
  );
  const [weight, setWeight] = useState<number>(
    fromGrams(initial?.weightGrams ?? 0, initial?.weightUnit ?? "g"),
  );
  const [media, setMedia] = useState<MediaItem[]>(
    (initial?.media ?? []).map((m) => ({
      storagePath: m.storagePath,
      mediaType: m.mediaType,
      alt: m.alt ?? "",
    })),
  );
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [variants, setVariants] = useState<VariantRow[]>(
    initial?.variants.map((v) => ({
      size: v.size ?? "",
      color: v.color ?? "",
      sku: v.sku ?? "",
      stockQty: v.stockQty,
    })) ?? [],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploading = tasks.some((t) => t.error === null);

  // --- Media upload ---------------------------------------------------------
  function addFiles(fileList: FileList | File[]) {
    setError(null);
    const files = Array.from(fileList);
    const slotsLeft = MAX_MEDIA - media.length - tasks.length;
    if (slotsLeft <= 0) {
      setError(`You can add at most ${MAX_MEDIA} media items.`);
      return;
    }
    const toUpload = files.slice(0, slotsLeft);
    if (files.length > toUpload.length) {
      setError(`Only ${MAX_MEDIA} media items allowed — some files were skipped.`);
    }

    for (const file of toUpload) {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const invalid = validateMediaFile(file);
      if (invalid) {
        setTasks((t) => [
          ...t,
          { id, name: file.name, progress: 0, error: invalid, abort: () => {} },
        ]);
        continue;
      }
      const handle = uploadMediaWithProgress(file, (pct) =>
        setTasks((t) => t.map((x) => (x.id === id ? { ...x, progress: pct } : x))),
      );
      setTasks((t) => [
        ...t,
        { id, name: file.name, progress: 0, error: null, abort: handle.abort },
      ]);
      handle.promise
        .then((res) => {
          setMedia((m) => [
            ...m,
            { storagePath: res.path, mediaType: res.mediaType, alt: name || "" },
          ]);
          setTasks((t) => t.filter((x) => x.id !== id));
        })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : "Upload failed.";
          setTasks((t) => t.map((x) => (x.id === id ? { ...x, error: msg } : x)));
        });
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function cancelTask(id: string) {
    setTasks((t) => {
      t.find((x) => x.id === id)?.abort();
      return t.filter((x) => x.id !== id);
    });
  }

  function moveMedia(from: number, to: number) {
    if (to < 0 || to >= media.length) return;
    setMedia((m) => {
      const copy = [...m];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }
  function removeMedia(i: number) {
    setMedia((m) => m.filter((_, idx) => idx !== i));
  }
  function setAlt(i: number, alt: string) {
    setMedia((m) => m.map((row, idx) => (idx === i ? { ...row, alt } : row)));
  }

  // --- Variants -------------------------------------------------------------
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
      weight: Number(weight) || 0,
      weightUnit,
      media: media.map((m) => ({
        storagePath: m.storagePath,
        mediaType: m.mediaType,
        alt: m.alt.trim() || null,
      })),
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
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-gray-400">
            Shipping weight
          </span>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              step={weightUnit === "kg" ? 0.01 : 1}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className={field}
              placeholder="0"
            />
            <select
              value={weightUnit}
              onChange={(e) => {
                // Keep the physical weight the same when the unit changes, so
                // switching g -> kg reads 0.5 rather than silently becoming 500 kg.
                const next = e.target.value as "g" | "kg";
                setWeight(fromGrams(toGrams(Number(weight) || 0, weightUnit), next));
                setWeightUnit(next);
              }}
              aria-label="Weight unit"
              className={`${field} w-20 shrink-0`}
            >
              <option value="g">g</option>
              <option value="kg">kg</option>
            </select>
          </div>
          <span className="mt-1 block text-[11px] text-gray-500">
            Used to pick the shipping weight bracket. Leave 0 to fall back to
            the default parcel weight in Shipping settings.
          </span>
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
            Media (images &amp; videos)
          </span>
          <span className="text-xs text-gray-500">
            {media.length}/{MAX_MEDIA}
          </span>
        </div>

        {/* Drag & drop zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
            dragActive
              ? "border-yellow-500 bg-yellow-500/10"
              : "border-white/20 hover:border-yellow-500/50 hover:bg-white/5"
          }`}
        >
          <UploadCloud className="h-6 w-6 text-yellow-400" />
          <p className="text-sm text-gray-300">
            <span className="font-medium text-yellow-400">Click to upload</span> or drag &amp; drop
          </p>
          <p className="text-xs text-gray-500">Images (≤25MB) or videos (≤50MB) · first image is the thumbnail</p>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
        </div>

        {/* In-flight uploads */}
        {tasks.length > 0 && (
          <ul className="mt-3 space-y-2">
            {tasks.map((t) => (
              <li key={t.id} className="rounded-md border border-white/10 bg-black/40 px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  {t.error ? (
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  ) : (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-yellow-400" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-gray-300">{t.name}</span>
                  <span className={t.error ? "text-red-400" : "text-gray-400"}>
                    {t.error ? "Failed" : `${t.progress}%`}
                  </span>
                  <button
                    type="button"
                    onClick={() => cancelTask(t.id)}
                    className="text-gray-500 hover:text-red-400"
                    aria-label={t.error ? "Dismiss" : "Cancel upload"}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {t.error ? (
                  <p className="mt-1 pl-6 text-xs text-red-400">{t.error}</p>
                ) : (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-yellow-500 transition-all"
                      style={{ width: `${t.progress}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Media grid */}
        {media.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No media yet.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {media.map((m, i) => (
              <div
                key={m.storagePath}
                draggable
                onDragStart={() => (dragIndex.current = i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex.current !== null && dragIndex.current !== i) {
                    moveMedia(dragIndex.current, i);
                  }
                  dragIndex.current = null;
                }}
                className="group rounded-lg border border-white/10 bg-neutral-900 p-2"
              >
                <div className="relative aspect-square overflow-hidden rounded-md bg-black">
                  {m.mediaType === "video" ? (
                    <>
                      <video src={resolveImageUrl(m.storagePath)} muted className="h-full w-full object-cover" />
                      <Film className="absolute left-1.5 top-1.5 h-4 w-4 text-white/80" />
                    </>
                  ) : (
                    <Image src={resolveImageUrl(m.storagePath)} alt={m.alt || ""} fill sizes="200px" className="object-cover" />
                  )}

                  {/* Drag affordance */}
                  <span className="absolute right-1.5 top-1.5 cursor-grab rounded bg-black/60 p-0.5 text-white/70 opacity-0 transition-opacity group-hover:opacity-100">
                    <GripVertical className="h-3.5 w-3.5" />
                  </span>

                  {i === 0 && (
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-yellow-500 px-1.5 text-[10px] font-bold text-black">
                      Thumbnail
                    </span>
                  )}
                </div>

                {/* Controls */}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => moveMedia(i, i - 1)} disabled={i === 0} className="rounded p-1 text-gray-400 hover:text-yellow-400 disabled:opacity-30" aria-label="Move left">
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => moveMedia(i, i + 1)} disabled={i === media.length - 1} className="rounded p-1 text-gray-400 hover:text-yellow-400 disabled:opacity-30" aria-label="Move right">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => moveMedia(i, 0)} disabled={i === 0} className="rounded p-1 text-gray-400 hover:text-yellow-400 disabled:opacity-30" aria-label="Set as thumbnail" title="Set as thumbnail">
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button type="button" onClick={() => removeMedia(i)} className="rounded p-1 text-gray-500 hover:text-red-400" aria-label="Remove">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <input
                  className="mt-1 w-full rounded-sm border border-white/10 bg-black/40 px-2 py-1 text-xs text-gray-200 outline-none focus:border-yellow-500"
                  placeholder="Alt text (for SEO / accessibility)"
                  value={m.alt}
                  onChange={(e) => setAlt(i, e.target.value)}
                />
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
          {uploading ? "Uploading…" : initial ? "Save changes" : "Create product"}
        </button>
        <button type="button" onClick={() => router.push("/admin/products")} className="rounded-sm border border-white/20 px-6 py-3 text-sm hover:border-white/40">
          Cancel
        </button>
      </div>
    </form>
  );
}
