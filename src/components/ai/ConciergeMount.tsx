"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MessageCircle, Sparkles, X } from "lucide-react";

import type { AiPublicConfig } from "@/lib/ai-types";

// Lazy: the chat panel (and react-markdown) load only when first opened, so the
// widget never touches the initial bundle or blocks any page.
const ConciergePanel = dynamic(
  () => import("./ConciergePanel").then((m) => m.ConciergePanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
      </div>
    ),
  },
);

/**
 * Floating concierge launcher + panel. Rendered on every page (from the root
 * layout) only when the assistant is enabled and configured. The heavy panel is
 * code-split behind the first open.
 */
export function ConciergeMount({ config }: { config: AiPublicConfig }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            role="dialog"
            aria-label="Fancy Finery concierge"
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 22, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="concierge-panel fixed bottom-24 right-4 z-[60] flex h-[74vh] max-h-[640px] w-[calc(100vw-2rem)] max-w-[404px] flex-col overflow-hidden rounded-[28px] border border-yellow-600/25 backdrop-blur-2xl sm:right-6"
          >
            {/* Header */}
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-yellow-500/30 bg-black/60">
                  <Image
                    src="/logo.png"
                    alt="Fancy Finery"
                    width={72}
                    height={72}
                    className="h-8 w-8 object-contain mix-blend-screen"
                  />
                </span>
                <div className="leading-tight">
                  <p className="flex items-center gap-1.5">
                    <span className="brand-wordmark text-[15px] tracking-wide">
                      Fashion Concierge
                    </span>
                    <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                  </p>
                  <p className="text-[11px] tracking-wide text-gray-400">
                    Your luxury shopping assistant
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close concierge"
                className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1">
              <ConciergePanel config={config} />
            </div>

            {/* Tail pointing toward the launcher */}
            <span className="concierge-tail pointer-events-none absolute -bottom-1.5 right-10 h-4 w-4 rotate-45 rounded-[3px]" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close concierge" : "Chat with the concierge"}
        aria-expanded={open}
        className="concierge-launcher fixed bottom-5 right-4 z-[60] inline-flex h-15 w-15 items-center justify-center rounded-full text-black transition-transform hover:scale-105 sm:right-6"
        style={{ height: 60, width: 60 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="x"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="relative"
            >
              <MessageCircle className="h-6 w-6" strokeWidth={2.25} />
              <Sparkles className="absolute -right-2 -top-2 h-3.5 w-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}
