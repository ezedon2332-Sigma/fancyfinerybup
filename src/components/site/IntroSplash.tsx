"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Gold light-sweep intro: black screen → gold logo appears → a shimmering gold
 * light sweeps across it → "FANCY FINERY" fades in → the overlay fades away.
 * Plays once per browser session and is skipped for reduced-motion users.
 */
export function IntroSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("ff.introSeen")) return;
      sessionStorage.setItem("ff.introSeen", "1");
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    } catch {
      /* storage unavailable — just play it */
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), 2600);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="intro"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black"
          aria-hidden
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative"
          >
            <Image
              src="/logo.png"
              alt="Fancy Finery"
              width={112}
              height={112}
              priority
              className="h-24 w-24 object-contain"
            />
            <span className="intro-sweep" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.9, ease: "easeOut" }}
            className="brand-wordmark mt-6 text-2xl uppercase tracking-[0.45em] sm:text-3xl"
          >
            Fancy Finery
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
