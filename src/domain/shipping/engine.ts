/**
 * Shipping rate engine — pure domain logic, no I/O.
 *
 * The whole calculation is a function of data that has already been loaded:
 * `resolveRate` and `calculateShipping` never touch a database or a network,
 * which is what makes them cheap to unit-test and safe to run inside a quote,
 * a checkout, or an admin preview without behaving differently in each.
 *
 * Money is NGN minor units (kobo) throughout, matching the catalogue. Weight is
 * always whole grams — no floats anywhere in the arithmetic.
 */

export type WeightUnit = "g" | "kg";

export const WEIGHT_UNITS: WeightUnit[] = ["g", "kg"];

/** Convert an admin-entered weight into canonical grams. */
export function toGrams(value: number, unit: WeightUnit): number {
  const grams = unit === "kg" ? value * 1000 : value;
  return Math.max(0, Math.round(grams));
}

/** Render canonical grams in the unit the admin prefers. */
export function fromGrams(grams: number, unit: WeightUnit): number {
  return unit === "kg" ? grams / 1000 : grams;
}

export function formatWeight(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${Number.isInteger(kg) ? kg : kg.toFixed(2)} kg`;
  }
  return `${grams} g`;
}

/** How a method is priced. `carrier` defers to a live courier API. */
export type RateSource = "table" | "carrier";

export interface ShippingZone {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly sortOrder: number;
  /** ISO alpha-2 codes assigned to this zone. */
  readonly countries: string[];
}

export interface ShippingMethodConfig {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly rateSource: RateSource;
  readonly carrierCode: string | null;
  readonly enabled: boolean;
  readonly sortOrder: number;
  readonly minDays: number;
  readonly maxDays: number;
}

export interface WeightBracket {
  readonly id: string;
  readonly label: string;
  readonly minGrams: number;
  /** null = open-ended top bracket (e.g. "20 kg +"). */
  readonly maxGrams: number | null;
  readonly sortOrder: number;
}

export interface ShippingRate {
  readonly id: string;
  /** Set for a zone rate; null for a country override. */
  readonly zoneId: string | null;
  /** Set for a country override; null for a zone rate. */
  readonly countryCode: string | null;
  readonly methodId: string;
  readonly bracketId: string;
  readonly price: number;
  readonly freeOver: number | null;
  readonly enabled: boolean;
}

/** Everything the engine needs, loaded once and passed in. */
export interface RateTable {
  readonly zones: ShippingZone[];
  readonly methods: ShippingMethodConfig[];
  readonly brackets: WeightBracket[];
  readonly rates: ShippingRate[];
}

export interface CartWeightLine {
  readonly weightGrams: number;
  readonly qty: number;
}

/**
 * Total cart weight. Lines with no weight recorded fall back to
 * `defaultItemGrams` rather than counting as zero — a catalogue gap should
 * over-estimate postage, never under-charge it.
 */
export function totalCartWeight(
  lines: CartWeightLine[],
  defaultItemGrams = 0,
): number {
  return lines.reduce((sum, l) => {
    const per = l.weightGrams > 0 ? l.weightGrams : defaultItemGrams;
    return sum + per * l.qty;
  }, 0);
}

/**
 * The bracket a weight falls into. Ranges are [min, max) so a weight sitting
 * exactly on a boundary lands in the higher bracket exactly once — 1000 g with
 * a 0.5–1 kg and a 1–2 kg bracket is a 1–2 kg parcel.
 *
 * Anything above the last bounded bracket uses the open-ended one; if there
 * isn't one, the heaviest bracket is used rather than returning nothing.
 */
export function findBracket(
  brackets: WeightBracket[],
  grams: number,
): WeightBracket | null {
  if (brackets.length === 0) return null;
  const ordered = [...brackets].sort((a, b) => a.minGrams - b.minGrams);

  for (const b of ordered) {
    const above = grams >= b.minGrams;
    const below = b.maxGrams === null || grams < b.maxGrams;
    if (above && below) return b;
  }
  // Heavier than every bounded bracket and no open-ended one exists.
  return ordered[ordered.length - 1];
}

export function zoneForCountry(
  zones: ShippingZone[],
  countryCode: string,
): ShippingZone | null {
  const code = countryCode.trim().toUpperCase();
  return zones.find((z) => z.countries.includes(code)) ?? null;
}

export interface ResolvedRate {
  readonly rate: ShippingRate;
  /** Which scope supplied the price — surfaced in the admin preview. */
  readonly source: "country-override" | "zone";
  readonly zone: ShippingZone | null;
}

/**
 * Find the rate for a destination + method + bracket.
 *
 * A country override always beats its zone, which is the whole point of
 * overrides: the US and Canada can sit in one region and still price apart.
 */
export function resolveRate(
  table: RateTable,
  params: { countryCode: string; methodId: string; bracketId: string },
): ResolvedRate | null {
  const code = params.countryCode.trim().toUpperCase();

  const override = table.rates.find(
    (r) =>
      r.enabled &&
      r.countryCode?.toUpperCase() === code &&
      r.methodId === params.methodId &&
      r.bracketId === params.bracketId,
  );
  const zone = zoneForCountry(table.zones, code);

  if (override) return { rate: override, source: "country-override", zone };
  if (!zone || !zone.enabled) return null;

  const zoneRate = table.rates.find(
    (r) =>
      r.enabled &&
      r.zoneId === zone.id &&
      r.methodId === params.methodId &&
      r.bracketId === params.bracketId,
  );
  return zoneRate ? { rate: zoneRate, source: "zone", zone } : null;
}

export interface CalculatedOption {
  readonly methodId: string;
  readonly methodCode: string;
  readonly methodName: string;
  /** NGN kobo, before currency conversion. */
  readonly priceNgn: number;
  readonly free: boolean;
  readonly minDays: number;
  readonly maxDays: number;
  readonly bracket: WeightBracket;
  readonly source: ResolvedRate["source"];
  readonly zoneName: string | null;
}

export interface CalculationInput {
  readonly countryCode: string;
  readonly weightGrams: number;
  /** Order subtotal in NGN kobo, for free-shipping thresholds. */
  readonly subtotalNgn: number;
}

export interface CalculationResult {
  readonly weightGrams: number;
  readonly bracket: WeightBracket | null;
  readonly zone: ShippingZone | null;
  readonly options: CalculatedOption[];
}

/**
 * Price every enabled table-rated method for a destination.
 *
 * Methods with `rateSource: 'carrier'` are skipped here — they are priced by a
 * courier adapter at quote time (see CarrierRateProvider), not from this table.
 */
export function calculateShipping(
  table: RateTable,
  input: CalculationInput,
): CalculationResult {
  const bracket = findBracket(table.brackets, input.weightGrams);
  const zone = zoneForCountry(table.zones, input.countryCode);
  if (!bracket) {
    return { weightGrams: input.weightGrams, bracket: null, zone, options: [] };
  }

  const options: CalculatedOption[] = [];

  for (const method of [...table.methods].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!method.enabled || method.rateSource !== "table") continue;

    const resolved = resolveRate(table, {
      countryCode: input.countryCode,
      methodId: method.id,
      bracketId: bracket.id,
    });
    if (!resolved) continue;

    const { rate } = resolved;
    const free =
      rate.price === 0 ||
      (rate.freeOver != null && input.subtotalNgn >= rate.freeOver);

    options.push({
      methodId: method.id,
      methodCode: method.code,
      methodName: method.name,
      priceNgn: free ? 0 : rate.price,
      free,
      minDays: method.minDays,
      maxDays: method.maxDays,
      bracket,
      source: resolved.source,
      zoneName: resolved.zone?.name ?? null,
    });
  }

  return { weightGrams: input.weightGrams, bracket, zone, options };
}

/* -------------------------------------------------------------------------
   Order money breakdown
   ------------------------------------------------------------------------- */

export interface TaxDiscountConfig {
  readonly taxEnabled: boolean;
  readonly taxRateBps: number;
  readonly taxLabel: string;
  readonly discountEnabled: boolean;
  readonly discountBps: number;
  readonly discountLabel: string;
}

export interface MoneyBreakdown {
  readonly subtotal: number;
  readonly shipping: number;
  readonly discount: number;
  readonly tax: number;
  readonly total: number;
}

/**
 * Compose the order total from its parts.
 *
 * Discount comes off the goods before tax, and shipping is taxed alongside
 * them — the ordering most jurisdictions expect, and the reason this lives in
 * one function instead of being re-derived per call site. Basis points keep
 * percentages exact: 7.5% is 750, never 0.075.
 */
export function computeTotals(
  parts: { subtotal: number; shipping: number },
  config: TaxDiscountConfig,
): MoneyBreakdown {
  const subtotal = Math.max(0, Math.round(parts.subtotal));
  const shipping = Math.max(0, Math.round(parts.shipping));

  const discount = config.discountEnabled
    ? Math.min(subtotal, Math.round((subtotal * config.discountBps) / 10_000))
    : 0;

  const taxable = subtotal - discount + shipping;
  const tax = config.taxEnabled
    ? Math.round((taxable * config.taxRateBps) / 10_000)
    : 0;

  return { subtotal, shipping, discount, tax, total: taxable + tax };
}
