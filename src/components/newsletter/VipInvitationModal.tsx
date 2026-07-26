"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, X } from "lucide-react";

import { PriveCircleForm } from "./PriveCircleForm";

const STORAGE_KEY = "ff-prive-invitation";
const DELAY_MS = 25_000;

/** Suppress for 30 days after it is seen, forever once someone joins. */
function suppressed(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const { joined, until } = JSON.parse(raw) as { joined?: boolean; until?: number };
    if (joined) return true;
    return typeof until === "number" && Date.now() < until;
  } catch {
    return false;
  }
}

function remember(entry: { joined?: boolean; days?: number }) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        joined: entry.joined ?? false,
        until: Date.now() + (entry.days ?? 30) * 86_400_000,
      }),
    );
  } catch {
    /* private browsing — worst case the invitation shows again */
  }
}

/**
 * VIP invitation. Opens after a visitor has spent long enough on the site to
 * be genuinely interested, or the moment they move to leave — whichever comes
 * first. Never on the first few seconds, never twice in a month.
 */
export function VipInvitationModal() {
  const [open, setOpen] = useState(false);
  const armed = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const show = useCallback(() => {
    if (armed.current || suppressed()) return;
    armed.current = true;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    remember({ days: 30 });
    previouslyFocused.current?.focus?.();
  }, []);

  useEffect(() => {
    if (suppressed()) return;

    const timer = window.setTimeout(show, DELAY_MS);

    // Exit intent: pointer leaving through the top of the viewport is the
    // classic "reaching for the address bar" signal. Desktop only — on touch
    // devices the same gesture means nothing, so the timer carries it.
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) show();
    };
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (fine) document.addEventListener("mouseout", onLeave);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mouseout", onLeave);
    };
  }, [show]);

  // Escape to dismiss, and keep focus inside while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("input")?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md sm:p-6"
          onClick={close}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="prive-invitation-title"
            initial={{ opacity: 0, y: 26, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-yellow-600/35 bg-[#0b0b0b] shadow-[0_40px_120px_-40px_rgba(0,0,0,1)]"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.22),transparent_70%)] blur-3xl"
            />

            <button
              type="button"
              onClick={close}
              aria-label="Close invitation"
              className="absolute right-4 top-4 z-10 rounded-full p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-yellow-400"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative px-6 pb-8 pt-10 sm:px-10 sm:pb-10">
              <div className="text-center">
                <p className="inline-flex items-center gap-2 rounded-full border border-yellow-600/40 px-3.5 py-1 text-[9px] uppercase tracking-[0.3em] text-yellow-500">
                  <Crown className="h-3 w-3" /> By Invitation
                </p>
                <h2
                  id="prive-invitation-title"
                  className="brand-wordmark mt-5 text-2xl tracking-[0.04em] sm:text-3xl"
                >
                  Experience Exclusive Luxury
                </h2>
                <p className="mx-auto mt-4 max-w-sm text-xs leading-relaxed text-gray-400 sm:text-sm">
                  Join the Privé Circle for early access to new collections,
                  private sales and invitations reserved for our most valued
                  members.
                </p>
              </div>

              <div className="mt-7">
                <PriveCircleForm
                  source="modal"
                  compact
                  onJoined={() => remember({ joined: true, days: 3650 })}
                />
              </div>

              <button
                type="button"
                onClick={close}
                className="mx-auto mt-5 block text-[10px] uppercase tracking-[0.24em] text-gray-500 transition-colors hover:text-gray-300"
              >
                Not just now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
