"use client";

import { Toaster as Sonner, toast } from "sonner";

/**
 * House toast style.
 *
 * Success and error feedback used to be rendered inline by each form, as a
 * coloured <p> beneath the button. That meant a message could appear below the
 * fold on a long form (the product editor, checkout), so an admin would press
 * Save, see nothing move, and press it again. A toast is anchored to the
 * viewport, so the outcome is visible wherever the control is.
 *
 * Styled to the brand rather than left at the library default: black ground,
 * gold accent, serif — a bright white notification on this storefront would
 * look like it belonged to a different site.
 */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      // Errors stay longer than confirmations: a success is acknowledged the
      // moment it is seen, an error usually has to be read and acted on.
      duration={4000}
      // Screen readers announce these; the visual style is not the message.
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!bg-neutral-950 !border !border-white/12 !text-gray-100 !shadow-2xl !shadow-black/60 !font-[var(--font-display),Georgia,serif]",
          title: "!text-sm !font-medium",
          description: "!text-xs !text-gray-400",
          success: "!border-green-500/30",
          error: "!border-red-500/40",
          closeButton: "!bg-neutral-900 !border-white/15 !text-gray-400",
        },
      }}
    />
  );
}

/**
 * The one place a result becomes a message.
 *
 * Every Server Action in this app returns the same shape — `{ ok, error?,
 * message? }` — so callers can hand the whole result over instead of each one
 * re-deciding which field to read and which colour to use. That consistency is
 * what stops a form quietly showing nothing because it checked `message` on a
 * failure that only set `error`.
 */
export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

export function toastResult(
  result: ActionResult,
  fallback: { success?: string; error?: string } = {},
): boolean {
  if (result.ok) {
    toast.success(result.message ?? fallback.success ?? "Done.");
    return true;
  }
  toast.error(result.error ?? fallback.error ?? "Something went wrong.", {
    duration: 6000,
  });
  return false;
}

export { toast };
