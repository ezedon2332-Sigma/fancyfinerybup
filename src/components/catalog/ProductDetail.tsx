"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Globe, LogIn, Play, ShoppingBag, Truck, Weight } from "lucide-react";

import type { ProductWithDetails } from "@/domain/entities/product";
import { formatWeight } from "@/domain/shipping/pricing";
import { resolveImageUrl } from "@/infrastructure/supabase/image-url";
import { useCart } from "@/components/cart/CartProvider";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { ShippingCalculator } from "@/components/shipping/ShippingCalculator";
import type { CountryOption } from "@/components/checkout/CountrySelect";
import { ZoomableImage } from "./ZoomableImage";
import { SizeAndFit } from "./SizeAndFit";
import { chartForCategory } from "@/domain/sizing";

export function ProductDetail({
  product,
  isAuthenticated,
  countries,
  categorySlug,
}: {
  product: ProductWithDetails;
  isAuthenticated: boolean;
  countries: CountryOption[];
  /** Drives which size chart is shown. Resolved on the server, where the
   *  category is already loaded. */
  categorySlug?: string | null;
}) {
  const sizeChart = chartForCategory(categorySlug);
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
      weightGrams: product.weightGrams,
      currency: product.currency,
      image: (media.find((m) => m.type === "image") ?? media[0]).url,
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
              muted
              autoPlay
              loop
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <ZoomableImage
              src={media[activeImage].url}
              alt={media[activeImage].alt}
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

        {/* Facts a shopper needs before committing. Weight is shown because it
            is what sets the shipping cost — hiding it would make the delivery
            figure look arbitrary. */}
        <ul className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px]">
          <li className="inline-flex items-center gap-1.5 rounded-full border border-yellow-600/40 px-3 py-1.5 text-yellow-500">
            <Weight className="h-3 w-3" />
            {formatWeight(product.weightGrams)}
          </li>
          <li className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-gray-300">
            <Globe className="h-3 w-3 text-yellow-500" />
            Ships worldwide
          </li>
          <li className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-gray-300">
            <Truck className="h-3 w-3 text-yellow-500" />
            UPS
          </li>
          <li
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${
              inStock
                ? "border-green-500/40 text-green-300"
                : "border-white/15 text-gray-500"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                inStock ? "bg-green-400" : "bg-gray-600"
              }`}
            />
            {inStock ? "In stock" : "Out of stock"}
          </li>
        </ul>

        {product.description && (
          <p className="mt-6 leading-relaxed text-gray-300">
            {product.description}
          </p>
        )}

        {/* Size & fit — owns size selection, so add-to-bag validation below
            is unchanged: it still refuses a null variant. */}
        <SizeAndFit
          options={product.variants.map((v) => ({
            id: v.id,
            size: v.size ?? "One size",
            colour: v.color,
            stockQty: v.stockQty,
          }))}
          chart={sizeChart}
          selectedId={variantId}
          onSelect={setVariantId}
          fitType={product.fitType}
          model={
            product.modelHeightCm && product.modelWeightKg && product.modelSize
              ? {
                  heightCm: product.modelHeightCm,
                  weightKg: product.modelWeightKg,
                  size: product.modelSize,
                }
              : null
          }
        />

        {product.variants.length > 0 && (
          <p className="mt-3 text-sm text-gray-400">
            {inStock ? `${selectedVariant?.stockQty} in stock` : "Out of stock"}
          </p>
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

        {/* Live delivery cost. Deliberately below the CTA: it answers the
            "what will this actually cost me" question without delaying the
            shopper who already knows. */}
        <ShippingCalculator
          productId={product.id}
          weightGrams={product.weightGrams}
          countries={countries}
          className="mt-8"
        />
      </div>
    </div>
  );
}
