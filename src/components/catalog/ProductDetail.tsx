"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, LogIn, Play, ShoppingBag } from "lucide-react";

import type { ProductWithDetails } from "@/domain/entities/product";
import { formatMoney } from "@/domain/shared/money";
import { resolveImageUrl } from "@/infrastructure/supabase/image-url";
import { useCart } from "@/components/cart/CartProvider";

export function ProductDetail({
  product,
  isAuthenticated,
}: {
  product: ProductWithDetails;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const media =
    product.images.length > 0
      ? product.images.map((img) => ({
          url: resolveImageUrl(img.storagePath),
          alt: img.alt ?? product.name,
          type: img.mediaType,
        }))
      : [{ url: "/image.jpeg", alt: product.name, type: "image" as const }];

  const [activeImage, setActiveImage] = useState(0);
  const [variantId, setVariantId] = useState<string | null>(
    product.variants.find((v) => v.stockQty > 0)?.id ?? null,
  );
  const [added, setAdded] = useState(false);

  const selectedVariant = useMemo(
    () => product.variants.find((v) => v.id === variantId) ?? null,
    [product.variants, variantId],
  );

  const inStock = selectedVariant ? selectedVariant.stockQty > 0 : false;

  function handleAdd() {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/products/${product.slug}`);
      return;
    }
    if (!inStock) return;
    addItem({
      productId: product.id,
      variantId: selectedVariant?.id ?? null,
      slug: product.slug,
      name: product.name,
      price: product.price,
      currency: product.currency,
      image: media.find((m) => m.type === "image")?.url ?? "/image.jpeg",
      size: selectedVariant?.size ?? null,
      color: selectedVariant?.color ?? null,
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
                  <span className="flex h-full w-full items-center justify-center bg-neutral-800">
                    <Play className="h-5 w-5 text-white" />
                  </span>
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
          {formatMoney(product.price, product.currency)}
        </p>
        {product.description && (
          <p className="mt-6 leading-relaxed text-gray-300">
            {product.description}
          </p>
        )}

        {/* Variants */}
        {product.variants.length > 0 && (
          <div className="mt-8">
            <p className="text-xs uppercase tracking-widest text-gray-400">
              Select option
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {product.variants.map((v) => {
                const label = [v.size, v.color].filter(Boolean).join(" · ") || "One size";
                const disabled = v.stockQty <= 0;
                const selected = v.id === variantId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setVariantId(v.id)}
                    className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                      selected
                        ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
                        : "border-white/20 text-gray-200 hover:border-yellow-500"
                    } ${disabled ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-gray-400">
              {inStock
                ? `${selectedVariant?.stockQty} in stock`
                : "Out of stock"}
            </p>
          </div>
        )}

        {/* Add to bag — requires sign-in */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          disabled={isAuthenticated && !inStock}
          onClick={handleAdd}
          className="mt-8 flex items-center justify-center gap-2 rounded-sm bg-yellow-500 px-8 py-4 font-semibold text-black transition-colors hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
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
