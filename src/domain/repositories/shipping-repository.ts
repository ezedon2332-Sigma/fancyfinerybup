import type {
  ShippingCountry,
  ShippingSettings,
} from "@/domain/shipping/shipping";

/** Port: shipping configuration persistence, independent of Supabase. */
export interface ShippingRepository {
  /** All configured countries (admin view). */
  listCountries(): Promise<ShippingCountry[]>;
  /** Only countries currently enabled for shipping (checkout view). */
  listEnabledCountries(): Promise<ShippingCountry[]>;
  /** A single country's config by ISO alpha-2 code, or null. */
  getCountry(code: string): Promise<ShippingCountry | null>;
  /** Global settings (exchange rate). */
  getSettings(): Promise<ShippingSettings>;
}
