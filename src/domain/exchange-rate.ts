export type RateMode = "auto" | "manual";

/** The effective NGN/USD rate plus its provenance. */
export interface ExchangeRate {
  /** Effective NGN per 1 USD (integer). */
  ngnPerUsd: number;
  mode: RateMode;
  /** Where the current rate came from, e.g. "open.er-api.com" or "manual". */
  source: string | null;
  /** ISO timestamp the rate was last set/refreshed. */
  updatedAt: string | null;
}
