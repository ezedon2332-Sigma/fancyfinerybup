import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ShippingCountry,
  ShippingSettings,
} from "@/domain/shipping/shipping";
import type { ShippingZone } from "@/domain/shipping/countries";
import { DEFAULT_NGN_PER_USD } from "@/domain/shipping/currency";
import type { ShippingRepository } from "@/domain/repositories/shipping-repository";
import type { Database } from "../database.types";

type CountryRow = Database["public"]["Tables"]["shipping_countries"]["Row"];

function toShippingCountry(row: CountryRow): ShippingCountry {
  return {
    code: row.code,
    name: row.name,
    zone: row.zone as ShippingZone,
    enabled: row.enabled,
    standardPrice: row.standard_price,
    standardMinDays: row.standard_min_days,
    standardMaxDays: row.standard_max_days,
    expressPrice: row.express_price,
    expressMinDays: row.express_min_days,
    expressMaxDays: row.express_max_days,
    freeOver: row.free_over,
  };
}

export function createShippingRepository(
  client: SupabaseClient<Database>,
): ShippingRepository {
  return {
    async listCountries(): Promise<ShippingCountry[]> {
      const { data, error } = await client
        .from("shipping_countries")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(toShippingCountry);
    },

    async listEnabledCountries(): Promise<ShippingCountry[]> {
      const { data, error } = await client
        .from("shipping_countries")
        .select("*")
        .eq("enabled", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(toShippingCountry);
    },

    async getCountry(code: string): Promise<ShippingCountry | null> {
      const { data, error } = await client
        .from("shipping_countries")
        .select("*")
        .eq("code", code.trim().toUpperCase())
        .maybeSingle();
      if (error) throw error;
      return data ? toShippingCountry(data) : null;
    },

    async getSettings(): Promise<ShippingSettings> {
      const { data, error } = await client
        .from("shipping_settings")
        .select("ngn_per_usd")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return { ngnPerUsd: data?.ngn_per_usd ?? DEFAULT_NGN_PER_USD };
    },
  };
}
