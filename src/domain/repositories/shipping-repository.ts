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
   * The whole rate table — zones, methods, brackets and rates — in one read.
   *
   * Loaded wholesale rather than queried per lookup because the engine is a
   * pure function over it: one round trip serves a quote, a checkout, or an
   * admin preview identically. The table is small (zones × methods × brackets)
   * and changes rarely.
   */
  getRateTable(): Promise<RateTable>;
}
