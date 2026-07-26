import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ShippingCountry,
  ShippingSettings,
} from "@/domain/shipping/shipping";
import type { ShippingZone } from "@/domain/shipping/countries";
import type { RateSource, RateTable } from "@/domain/shipping/engine";
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
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return {
        ngnPerUsd: data?.ngn_per_usd ?? DEFAULT_NGN_PER_USD,
        taxEnabled: data?.tax_enabled ?? false,
        taxRateBps: data?.tax_rate_bps ?? 0,
        taxLabel: data?.tax_label ?? "VAT",
        discountEnabled: data?.discount_enabled ?? false,
        discountBps: data?.discount_bps ?? 0,
        discountLabel: data?.discount_label ?? "Discount",
        defaultItemWeightGrams: data?.default_item_weight_grams ?? 500,
      };
    },

    /**
     * Whole rate table in four parallel reads.
     *
     * Returns an empty table rather than throwing if the engine migration has
     * not been applied yet — the use-case falls back to the legacy per-country
     * prices in that case, so checkout keeps working either way.
     */
    async getRateTable(countryCode?: string): Promise<RateTable> {
      const code = countryCode?.trim().toUpperCase();

      // The destination's zone has to be known before the rates can be
      // narrowed to it, so that lookup goes first when a country is given.
      let zoneId: string | null = null;
      if (code) {
        const { data } = await client
          .from("shipping_zone_countries")
          .select("zone_id")
          .eq("country_code", code)
          .maybeSingle();
        zoneId = data?.zone_id ?? null;
      }

      let ratesQuery = client.from("shipping_rates").select("*");
      if (code) {
        ratesQuery = zoneId
          ? ratesQuery.or(`country_code.eq.${code},zone_id.eq.${zoneId}`)
          : ratesQuery.eq("country_code", code);
      }

      const [zonesRes, assignRes, methodsRes, bracketsRes, ratesRes] =
        await Promise.all([
          client.from("shipping_zones").select("*").order("sort_order"),
          client.from("shipping_zone_countries").select("*"),
          client.from("shipping_methods").select("*").order("sort_order"),
          client.from("shipping_weight_brackets").select("*").order("min_grams"),
          // Postgrest caps rows by default; a full admin read of a fine ladder
          // exceeds it, and a truncated rate table would price silently wrong.
          ratesQuery.limit(20_000),
        ]);

      if (zonesRes.error || methodsRes.error || bracketsRes.error || ratesRes.error) {
        return { zones: [], methods: [], brackets: [], rates: [] };
      }

      const byZone = new Map<string, string[]>();
      for (const a of assignRes.data ?? []) {
        const list = byZone.get(a.zone_id) ?? [];
        list.push(a.country_code.toUpperCase());
        byZone.set(a.zone_id, list);
      }

      return {
        zones: (zonesRes.data ?? []).map((z) => ({
          id: z.id,
          code: z.code,
          name: z.name,
          enabled: z.enabled,
          sortOrder: z.sort_order,
          countries: byZone.get(z.id) ?? [],
        })),
        methods: (methodsRes.data ?? []).map((m) => ({
          id: m.id,
          code: m.code,
          name: m.name,
          description: m.description,
          rateSource: m.rate_source as RateSource,
          carrierCode: m.carrier_code,
          enabled: m.enabled,
          sortOrder: m.sort_order,
          minDays: m.min_days,
          maxDays: m.max_days,
        })),
        brackets: (bracketsRes.data ?? []).map((b) => ({
          id: b.id,
          label: b.label,
          minGrams: b.min_grams,
          maxGrams: b.max_grams,
          sortOrder: b.sort_order,
        })),
        rates: (ratesRes.data ?? []).map((r) => ({
          id: r.id,
          zoneId: r.zone_id,
          countryCode: r.country_code,
          methodId: r.method_id,
          bracketId: r.bracket_id,
          price: r.price,
          freeOver: r.free_over,
          enabled: r.enabled,
        })),
      };
    },
  };
}
