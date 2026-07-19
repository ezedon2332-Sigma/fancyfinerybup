import type { ShippingZone } from "./countries";
import { DOMESTIC_COUNTRY } from "./currency";

/** Seed defaults for a country's shipping config. Prices are NGN kobo. */
export interface ZoneRateDefault {
  enabled: boolean;
  standardPrice: number;
  standardMinDays: number;
  standardMaxDays: number;
  expressPrice: number | null;
  expressMinDays: number;
  expressMaxDays: number;
  freeOver: number | null;
}

const ZONE_DEFAULTS: Record<ShippingZone, ZoneRateDefault> = {
  Africa: { enabled: true, standardPrice: 500000, standardMinDays: 4, standardMaxDays: 9, expressPrice: 1200000, expressMinDays: 2, expressMaxDays: 4, freeOver: null },
  Europe: { enabled: true, standardPrice: 1500000, standardMinDays: 6, standardMaxDays: 12, expressPrice: 3000000, expressMinDays: 3, expressMaxDays: 6, freeOver: null },
  Asia: { enabled: true, standardPrice: 1600000, standardMinDays: 6, standardMaxDays: 12, expressPrice: 3200000, expressMinDays: 3, expressMaxDays: 6, freeOver: null },
  "North America": { enabled: true, standardPrice: 1800000, standardMinDays: 6, standardMaxDays: 12, expressPrice: 3500000, expressMinDays: 3, expressMaxDays: 6, freeOver: null },
  "South America": { enabled: true, standardPrice: 2000000, standardMinDays: 9, standardMaxDays: 16, expressPrice: 4000000, expressMinDays: 5, expressMaxDays: 8, freeOver: null },
  Oceania: { enabled: true, standardPrice: 2000000, standardMinDays: 9, standardMaxDays: 16, expressPrice: 4000000, expressMinDays: 5, expressMaxDays: 8, freeOver: null },
  // Antarctica territories: shipping disabled by default (admin can enable).
  Antarctica: { enabled: false, standardPrice: 0, standardMinDays: 20, standardMaxDays: 40, expressPrice: null, expressMinDays: 20, expressMaxDays: 40, freeOver: null },
};

/** Domestic (Nigeria): cheapest + fast, free over ₦200,000. */
const DOMESTIC_DEFAULT: ZoneRateDefault = {
  enabled: true,
  standardPrice: 200000,
  standardMinDays: 2,
  standardMaxDays: 4,
  expressPrice: 500000,
  expressMinDays: 1,
  expressMaxDays: 2,
  freeOver: 20000000,
};

export function defaultRateFor(zone: ShippingZone, code: string): ZoneRateDefault {
  if (code === DOMESTIC_COUNTRY) return DOMESTIC_DEFAULT;
  return ZONE_DEFAULTS[zone];
}
