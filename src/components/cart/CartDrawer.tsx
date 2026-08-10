"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";

import { useCart } from "./CartProvider";
import { useCurrency } from "@/components/providers/CurrencyProvider";

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQty, subtotal, count } =
    useCart();
  const { format } = useCurrency();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
            className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-md flex-col border-l border-yellow-600/30 bg-neutral-950 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <ShoppingBag className="h-5 w-5 text-yellow-400" /> Your Bag
                <span className="text-sm text-gray-400">({count})</span>
              </h2>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Close"
                className="rounded-full p-2 text-gray-300 hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <ShoppingBag className="h-10 w-10 text-gray-600" />
                <p className="text-gray-400">Your bag is empty.</p>
                <Link
                  href="/collections"
                  onClick={closeCart}
                  className="rounded-sm bg-yellow-500 px-6 py-3 font-semibold text-black hover:bg-yellow-600"
                >
                  Shop collections
                </Link>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  {items.map((item) => (
                    <div
                      key={`${item.productId}-${item.variantId}`}
                      className="flex gap-3"
                    >
                      <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          // Fixed 80px-wide cart thumbnail; `fill` alone would
                          // imply 100vw and pull a full-width variant.
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex flex-1 flex-col">
                        <div className="flex justify-between gap-2">
                          <Link
                            href={`/products/${item.slug}`}
                            onClick={closeCart}
                            className="text-sm font-medium hover:text-yellow-400"
                          >
                            {item.name}
                          </Link>
                          <button
                            type="button"
                            aria-label="Remove"
                            onClick={() =>
                              removeItem(item.productId, item.variantId)
                            }
                            className="text-gray-500 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {(item.size || item.color) && (
                          <p className="mt-0.5 text-xs text-gray-400">
                            {[item.size, item.color].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center gap-2 rounded-md border border-white/15">
                            <button
                              type="button"
                              aria-label="Decrease"
                              onClick={() =>
                                updateQty(
                                  item.productId,
                                  item.variantId,
                                  item.qty - 1,
                                )
                              }
                              className="p-1.5 text-gray-300 hover:text-yellow-400"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-6 text-center text-sm">
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              aria-label="Increase"
                              onClick={() =>
                                updateQty(
                                  item.productId,
                                  item.variantId,
                                  item.qty + 1,
                                )
                              }
                              className="p-1.5 text-gray-300 hover:text-yellow-400"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="text-sm font-semibold text-yellow-400">
                            {format(item.price * item.qty)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 px-5 py-4">
                  <div className="mb-4 flex items-center justify-between text-sm">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="text-lg font-semibold">
                      {format(subtotal)}
                    </span>
                  </div>
                  <Link
                    href="/checkout"
                    onClick={closeCart}
                    className="block rounded-sm bg-yellow-500 py-4 text-center font-semibold text-black transition-colors hover:bg-yellow-600"
                  >
                    Checkout
                  </Link>
                  <p className="mt-2 text-center text-xs text-gray-500">
                    Shipping calculated at delivery.
                  </p>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
