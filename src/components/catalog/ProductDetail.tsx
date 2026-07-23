"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, LogIn, Play, ShoppingBag } from "lucide-react";

import type { ProductWithDetails } from "@/domain/entities/product";
import { resolveImageUrl } from "@/infrastructure/supabase/image-url";
import { useCart } from "@/components/cart/CartProvider";
import { useCurrency } from "@/components/providers/CurrencyProvider";

/** Best-effort colour-name → swatch colour (falls back to a neutral dot). */
const COLOR_HEX: Record<string, string> = {
  black: "#111111", white: "#f5f5f0", ivory: "#f4efe1", cream: "#f3ead3",
  gold: "#d4af37", amber: "#c98a2b", tangerine: "#f28500", orange: "#ea580c",
  red: "#b91c1c", wine: "#722f37", burgundy: "#5b1a1a", maroon: "#5b1a1a",
  pink: "#ec4899", rose: "#e11d48", beige: "#d8c3a5", tan: "#c19a6b",
  brown: "#6b4a2b", chocolate: "#3f2a1c", slate: "#475569", charcoal: "#36393f",
  grey: "#6b7280", gray: "#6b7280", silver: "#c0c0c0", navy: "#1e293b",
  blue: "#2563eb", teal: "#0d9488", green: "#166534", olive: "#556b2f",
  purple: "#7c3aed", lilac: "#b794f4", yellow: "#eab308",
};
function swatchColor(name: string): string {
  return COLOR_HEX[name.trim().toLowerCase()] ?? "#9ca3af";
}
/** Light swatches need a visible outline on the dark theme. */
function isLight(name: string): boolean {
  return ["white", "ivory", "cream", "beige", "silver", "gold", "yellow"].includes(
    name.trim().toLowerCase(),
  );
}

export function ProductDetail({
  product,
  isAuthenticated,
}: {
  product: ProductWithDetails;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const { format } = useCurrency();

  const media =
    product.images.length > 0
      ? product.images.map((img) => ({
          url: resolveImageUrl(img.storagePath),
          alt: img.alt ?? product.name,
          type: img.mediaType,
        }))
      : [{ url: "/image.jpeg", alt: product.name, type: "image" as const }];

  // Distinct colours / sizes from the existing variant system.
  const colours = useMemo(
    () => [...new Set(product.variants.map((v) => v.color).filter(Boolean))] as string[],
    [product.variants],
  );
  const sizes = useMemo(
    () => [...new Set(product.variants.map((v) => v.size).filter(Boolean))] as string[],
    [product.variants],
  );

  const [activeImage, setActiveImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(
    colours.length === 1 ? colours[0] : null,
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(
    sizes.length === 1 ? sizes[0] : null,
  );
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve the variant from the chosen colour + size.
  const resolvedVariant = useMemo(
    () =>
      product.variants.find(
        (v) =>
          (colours.length === 0 || v.color === selectedColor) &&
          (sizes.length === 0 || v.size === selectedSize),
      ) ?? null,
    [product.variants, colours.length, sizes.length, selectedColor, selectedSize],
  );
  const inStock = resolvedVariant ? resolvedVariant.stockQty > 0 : false;

  function selectColor(c: string) {
    setSelectedColor(c);
    setError(null);
    // Switch to a colour-matching image if one exists (matched by alt text).
    const idx = media.findIndex(
      (m) => m.type === "image" && (m.alt ?? "").toLowerCase().includes(c.toLowerCase()),
    );
    if (idx >= 0) setActiveImage(idx);
    // Drop an incompatible size selection.
    if (
      selectedSize &&
      !product.variants.some((v) => v.color === c && v.size === selectedSize)
    ) {
      setSelectedSize(sizes.length === 1 ? sizes[0] : null);
    }
  }

  const cartImage =
    media[activeImage]?.type === "image"
      ? media[activeImage].url
      : (media.find((m) => m.type === "image") ?? media[0]).url;

  function handleAdd() {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/products/${product.slug}`);
      return;
    }
    setError(null);
    if (colours.length > 0 && !selectedColor) {
      setError("Please select a colour.");
      return;
    }
    if (sizes.length > 0 && !selectedSize) {
      setError("Please select a size.");
      return;
    }
    if (!resolvedVariant || resolvedVariant.stockQty <= 0) {
      setError("That option is out of stock.");
      return;
    }
    addItem({
      productId: product.id,
      variantId: resolvedVariant.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      currency: product.currency,
      image: cartImage,
      size: resolvedVariant.size,
      color: resolvedVariant.color,
      qty: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
      {/* Gallery */}
      <div>
        <motion.div
          key={activeImage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-neutral-900"
        >
          {media[activeImage].type === "video" ? (
            <video
              src={media[activeImage].url}
              controls
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <Image
              src={media[activeImage].url}
              alt={media[activeImage].alt}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          )}
        </motion.div>
        {media.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {media.map((m, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveImage(i)}
                className={`relative h-20 w-16 overflow-hidden rounded-lg border-2 transition-colors ${
                  i === activeImage ? "border-yellow-500" : "border-transparent"
                }`}
              >
                {m.type === "video" ? (
                  <>
                    <video src={m.url} muted playsInline className="h-full w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play className="h-5 w-5 text-white" />
                    </span>
                  </>
                ) : (
                  <Image src={m.url} alt={m.alt} fill className="object-cover" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col">
        <h1 className="text-3xl font-bold sm:text-4xl">{product.name}</h1>
        <p className="mt-4 text-2xl font-semibold text-yellow-400">
          {format(product.price)}
        </p>
        {product.description && (
          <p className="mt-6 leading-relaxed text-gray-300">
            {product.description}
          </p>
        )}

        {/* Colour swatches */}
        {colours.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-2">
              <p className="text-xs uppercase tracking-widest text-gray-400">Colour</p>
              <span className="text-sm text-gray-200">
                {selectedColor ?? "Choose a colour"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              {colours.map((c) => {
                const active = c === selectedColor;
                const soldOut = !product.variants.some(
                  (v) => v.color === c && v.stockQty > 0,
                );
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => selectColor(c)}
                    disabled={soldOut}
                    aria-pressed={active}
                    aria-label={`Colour: ${c}${soldOut ? " (sold out)" : ""}`}
                    title={c}
                    className="group flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                        active
                          ? "ring-2 ring-yellow-500 ring-offset-2 ring-offset-black"
                          : "ring-1 ring-white/20 group-hover:ring-white/50"
                      } ${isLight(c) ? "border border-white/30" : ""} ${
                        soldOut ? "opacity-30" : ""
                      }`}
                      style={{ backgroundColor: swatchColor(c) }}
                    >
                      {active && (
                        <Check
                          className={`h-4 w-4 ${isLight(c) ? "text-black" : "text-white"}`}
                        />
                      )}
                    </span>
                    <span
                      className={`text-[11px] ${
                        active ? "text-yellow-400" : "text-gray-400"
                      } ${soldOut ? "line-through" : ""}`}
                    >
                      {c}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Sizes */}
        {sizes.length > 0 && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-widest text-gray-400">Size</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sizes.map((s) => {
                const active = s === selectedSize;
                const available = product.variants.some(
                  (v) =>
                    v.size === s &&
                    (colours.length === 0 || v.color === selectedColor) &&
                    v.stockQty > 0,
                );
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!available}
                    onClick={() => {
                      setSelectedSize(s);
                      setError(null);
                    }}
                    className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                      active
                        ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
                        : "border-white/20 text-gray-200 hover:border-yellow-500"
                    } ${!available ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {product.variants.length > 0 && (
          <p className="mt-4 text-sm text-gray-400">
            {resolvedVariant
              ? inStock
                ? `${resolvedVariant.stockQty} in stock`
                : "Out of stock"
              : "Select options above"}
          </p>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        {/* Add to bag — requires sign-in */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          disabled={isAuthenticated && !!resolvedVariant && !inStock}
          onClick={handleAdd}
          className="mt-6 flex items-center justify-center gap-2 rounded-sm bg-yellow-500 px-8 py-4 font-semibold text-black transition-colors hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {!isAuthenticated ? (
            <>
              <LogIn className="h-5 w-5" /> Sign in to add to bag
            </>
          ) : added ? (
            <>
              <Check className="h-5 w-5" /> Added to bag
            </>
          ) : (
            <>
              <ShoppingBag className="h-5 w-5" /> Add to Bag
            </>
          )}
        </motion.button>
        <p className="mt-3 text-xs text-gray-500">
          {isAuthenticated
            ? "Added items appear in your bag."
            : "You need an account to shop your bag."}
        </p>
      </div>
    </div>
  );
}
