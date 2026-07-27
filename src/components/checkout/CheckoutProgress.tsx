"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

export const CHECKOUT_STEPS = [
  "Shopping Bag",
  "Shipping",
  "Payment",
  "Review",
  "Confirmation",
] as const;

export type CheckoutStep = (typeof CHECKOUT_STEPS)[number];

/**
 * Where the customer is in the flow.
 *
 * Purely indicative — the checkout itself is a single page, so this orients
 * rather than navigates. Steps behind the current one are marked done; the
 * connecting rail fills to match, which is the only animation here.
 */
export function CheckoutProgress({ current }: { current: CheckoutStep }) {
  const index = CHECKOUT_STEPS.indexOf(current);
  const pct = (index / (CHECKOUT_STEPS.length - 1)) * 100;

  return (
    <nav aria-label="Checkout progress" className="w-full">
      <ol className="relative flex items-start justify-between">
        {/* Rail sits behind the markers, inset by half a marker each side so
            it starts and ends at their centres. */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-[11px] mx-[11px] h-px bg-white/12"
        >
          <motion.div
            className="h-px bg-gradient-to-r from-yellow-600 to-yellow-400"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        {CHECKOUT_STEPS.map((step, i) => {
          const done = i < index;
          const active = i === index;
          return (
            <li
              key={step}
              className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-2"
              aria-current={active ? "step" : undefined}
            >
              <span
                className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors duration-500 ${
                  done
                    ? "border-yellow-500 bg-yellow-500 text-black"
                    : active
                      ? "border-yellow-500 bg-black text-yellow-400"
                      : "border-white/20 bg-black text-gray-600"
                }`}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`text-center text-[9px] uppercase leading-tight tracking-[0.14em] transition-colors duration-500 sm:text-[10px] ${
                  active
                    ? "text-yellow-400"
                    : done
                      ? "text-gray-300"
                      : "text-gray-600"
                }`}
              >
                {step}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
