"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Palette, Search, Sparkles, X } from "lucide-react";

import { POPULAR_COLORS, colorHex } from "@/domain/colors";
import { colorRequestSchema } from "@/lib/validation";
import { submitColorRequestAction } from "@/app/products/color-request-actions";

const CUSTOM = "Custom Color";

export interface ColorOption {
  name: string;
  code: string | null;
}

export function RequestColorSection({
  productId,
  productName,
  productSku,
  sizes,
  colors,
}: {
  productId: string;
  productName: string;
  productSku: string | null;
  sizes: string[];
  colors?: ColorOption[];
}) {
  const [open, setOpen] = useState(false);
  // Load from the DB colours; fall back to the built-in popular list.
  const palette: ColorOption[] =
    colors && colors.length > 0
      ? colors
      : POPULAR_COLORS.map((c) => ({ name: c, code: null }));
  return (
    <div className="mt-6 rounded-2xl border border-yellow-600/30 bg-neutral-950/50 p-5">
      <p className="text-sm font-semibold text-gray-200">Looking for another colour?</p>
      <p className="mt-1 text-sm text-gray-400">
        Don&apos;t see the shade you want? Request it and we&apos;ll confirm
        availability.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-yellow-500 px-6 py-2.5 text-sm font-semibold text-yellow-400 transition-colors hover:bg-yellow-500 hover:text-black"
      >
        <Palette className="h-4 w-4" /> Request a Colour
      </button>

      <AnimatePresence>
        {open && (
          <RequestColorModal
            productId={productId}
            productName={productName}
            productSku={productSku}
            sizes={sizes}
            palette={palette}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RequestColorModal({
  productId,
  productName,
  productSku,
  sizes,
  palette,
  onClose,
}: {
  productId: string;
  productName: string;
  productSku: string | null;
  sizes: string[];
  palette: ColorOption[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [color, setColor] = useState("");
  const [customName, setCustomName] = useState("");
  const [customHex, setCustomHex] = useState("#c9a227");
  const [size, setSize] = useState(sizes[0] ?? "");
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isCustom = color === CUSTOM;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const swatches: ColorOption[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? palette.filter((c) => c.name.toLowerCase().includes(q))
      : palette;
    return [...list, { name: CUSTOM, code: null }];
  }, [query, palette]);

  async function submit() {
    setError(null);
    const requestedColor = isCustom ? customName.trim() : color;
    const payload = {
      productId,
      productName,
      productSku: productSku ?? null,
      requestedColor,
      requestedSize: size || null,
      quantity: Number(qty),
      customerName: name,
      customerEmail: email,
      customerPhone: phone || null,
      note: note || null,
    };
    const parsed = colorRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please complete the form.");
      return;
    }
    setSubmitting(true);
    const res = await submitColorRequestAction(parsed.data);
    setSubmitting(false);
    if (res.ok) setDone(true);
    else setError(res.error ?? "Could not submit your request.");
  }

  const field =
    "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-yellow-500";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-yellow-600/30 bg-neutral-950 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-yellow-500">
              Request Your Preferred Colour
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Can&apos;t find the colour you want? Select it below and we&apos;ll
              confirm availability.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="py-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yellow-500/15">
              <Check className="h-7 w-7 text-yellow-400" />
            </span>
            <h3 className="mt-4 text-lg font-semibold">Request received</h3>
            <p className="mt-1 text-sm text-gray-400">
              Thank you — we&apos;ll email you once your colour is confirmed.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-full bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-black hover:bg-yellow-400"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {/* Searchable colour selector */}
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-gray-400">
                Colour
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search colours…"
                  className={`${field} pl-9`}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {swatches.map((sw) => {
                  const selected = color === sw.name;
                  const isCustomSwatch = sw.name === CUSTOM;
                  return (
                    <button
                      key={sw.name}
                      type="button"
                      onClick={() => setColor(sw.name)}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                        selected
                          ? "border-yellow-500 bg-yellow-500/10 text-yellow-300"
                          : "border-white/10 text-gray-300 hover:border-white/30"
                      }`}
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-white/20"
                        style={
                          isCustomSwatch
                            ? {
                                background:
                                  "conic-gradient(from 0deg, #ef4444, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)",
                              }
                            : { background: sw.code ?? colorHex(sw.name) }
                        }
                      />
                      <span className="truncate">{sw.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom colour inputs */}
            {isCustom && (
              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-widest text-gray-400">
                    Colour name
                  </label>
                  <input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Champagne Gold"
                    className={field}
                  />
                </div>
                <input
                  type="color"
                  aria-label="Pick a colour"
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  className="h-11 w-14 cursor-pointer rounded-lg border border-white/15 bg-black/40"
                />
              </div>
            )}

            {/* Size + quantity */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-gray-400">
                  Size
                </label>
                {sizes.length > 0 ? (
                  <select value={size} onChange={(e) => setSize(e.target.value)} className={field}>
                    {sizes.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. M" className={field} />
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-gray-400">
                  Quantity
                </label>
                <input type="number" min={1} max={99} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={field} />
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-gray-400">Full name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={field} autoComplete="name" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-gray-400">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} autoComplete="email" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-gray-400">Phone (optional)</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} autoComplete="tel" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-gray-400">Note (optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. I need this dress in Emerald Green."
                  className={`${field} h-20`}
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-gray-200 transition-colors hover:border-white/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-yellow-500 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-yellow-400 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Submit Request
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
