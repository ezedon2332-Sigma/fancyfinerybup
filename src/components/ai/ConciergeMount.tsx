"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MessageCircle, X } from "lucide-react";

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
 * Floating concierge launcher. Rendered on every page (from the root layout)
 * only when the assistant is enabled and configured. The heavy panel is
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
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-24 right-4 z-[60] flex h-[72vh] max-h-[620px] w-[calc(100vw-2rem)] max-w-[400px] flex-col overflow-hidden rounded-3xl border border-yellow-600/25 bg-neutral-950/80 shadow-2xl shadow-black/60 backdrop-blur-xl sm:right-6"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="brand-wordmark text-base leading-none">Concierge</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-gray-500">
                  Fancy Finery
                </p>
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
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close concierge" : "Chat with the concierge"}
        aria-expanded={open}
        className="fixed bottom-5 right-4 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 text-black shadow-xl shadow-yellow-900/40 transition-transform hover:scale-105 sm:right-6"
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
            >
              <MessageCircle className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}
