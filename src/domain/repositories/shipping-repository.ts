import type {
  ShippingCountry,
  ShippingSettings,
} from "@/domain/shipping/shipping";
import type { RateTable } from "@/domain/shipping/engine";

/** Port: shipping configuration persistence, independent of Supabase. */
export interface ShippingRepository {
  /** All configured countries (admin view). */
  listCountries(): Promise<ShippingCountry[]>;
  /** Only countries currently enabled for shipping (checkout view). */
  listEnabledCountries(): Promise<ShippingCountry[]>;
  /** A single country's config by ISO alpha-2 code, or null. */
  getCountry(code: string): Promise<ShippingCountry | null>;
  /** Global settings (exchange rate, tax, discount). */
  getSettings(): Promise<ShippingSettings>;
  /**
   * Zones, methods, brackets and rates in one read, for the pure engine to
   * calculate over.
   *
   * `countryCode` narrows the *rates* to that destination — its own overrides
   * plus its zone's — which matters because a fine-grained ladder multiplies
   * out: 100 weight bands across 10 countries is 1,000 rows, and a checkout
   * quote re-runs on every address keystroke. Zones, methods and brackets are
   * small and always loaded whole. Omit it (admin screens) for the full table.
   */
  getRateTable(countryCode?: string): Promise<RateTable>;
}
