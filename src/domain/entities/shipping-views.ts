import type { NgState } from "@/domain/shipping/nigeria";

/**
 * Read models for the shipping admin screens.
 *
 * `AdminNgState` lived in `infrastructure/supabase/nigeria-shipping-service.ts`
 * and was imported straight into `NigeriaShippingPanel.tsx`, so the component's
 * prop type came from a Supabase module. It belongs to the domain instead.
 */

export interface AdminNgState extends NgState {
  destinationCount: number;
}

/**
 * Outcome of an admin write. Server Actions return this to render an inline
 * error rather than throwing into an error boundary and losing the form.
 */
export type WriteResult = { ok: boolean; error?: string };

/**
 * One published rate band for a destination.
 *
 * These two shapes were declared inside `components/shipping/RatesBrowser.tsx`
 * and imported BACK into `infrastructure/rate-card.ts` — infrastructure
 * depending on a React component, the dependency arrow pointing the wrong way
 * through every layer at once. The component now imports them from here.
 */
export interface RateRow {
  bracketLabel: string;
  minGrams: number;
  maxGrams: number | null;
  priceNaira: number;
}

export interface CountryRates {
  code: string;
  name: string;
  courier: string;
  minDays: number;
  maxDays: number;
  rows: RateRow[];
}
