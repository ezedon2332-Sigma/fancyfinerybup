/**
 * The one place Fancy Finery prices an order.
 *
 *   Grand Total = Subtotal + Shipping + Tax − Discount
 *
 * Pure: no database, no network, no clock beyond what is passed in. Every
 * surface — product page calculator, cart, rates page, checkout, order review,
 * payment — calls `priceOrder` so they can never disagree. If a number differs
 * between two screens, it is a bug in the caller, not a second formula.
 *
 * All money is integer minor units (NGN kobo). Floating point never touches a
 * total; percentages round once, at the point of application.
 */

export type WeightUnit = "g" | "kg";

export interface Zone {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
  /** Upper-case ISO alpha-2 codes. */
  countries: string[];
}

export interface Courier {
  id: string;
  code: string;
  name: string;
  displayName: string;
  carrierCode: string | null;
  enabled: boolean;
  sortOrder: number;
  minDays: number;
  maxDays: number;
  trackingUrlTemplate: string | null;
}

export interface WeightBracket {
  id: string;
  label: string;
  minGrams: number;
  /** null = open-ended top band. */
  maxGrams: number | null;
  sortOrder: number;
}

export interface Rate {
  id: string;
  zoneId: string | null;
  /** Set for a country override, which beats any zone rate. */
  countryCode: string | null;
  courierId: string;
  bracketId: string;
  /** NGN kobo. */
  priceKobo: number;
  /** Free above this subtotal, when set. */
  freeOverKobo: number | null;
  enabled: boolean;
}

export interface TaxRule {
  id: string;
  scope: "global" | "zone" | "country";
  countryCode: string | null;
  zoneId: string | null;
  rateBps: number;
  label: string;
  appliesToShipping: boolean;
  enabled: boolean;
}

export interface DiscountCode {
  id: string;
  code: string;
  kind: "percent" | "fixed" | "free_shipping";
  percentBps: number | null;
  amountKobo: number | null;
  minSubtotalKobo: number;
  maxDiscountKobo: number | null;
  firstTimeOnly: boolean;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  enabled: boolean;
}

/** Everything the engine needs, loaded once per request. */
export interface PricingTable {
  zones: Zone[];
  couriers: Courier[];
  brackets: WeightBracket[];
  rates: Rate[];
  taxRules: TaxRule[];
}

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------

export function toGrams(value: number, unit: WeightUnit): number {
  return Math.max(0, Math.round(unit === "kg" ? value * 1000 : value));
}

export function formatWeight(grams: number): string {
  if (grams >= 1000) return `${parseFloat((grams / 1000).toFixed(2))} kg`;
  return `${grams} g`;
}

export interface CartWeightLine {
  weightGrams: number;
  qty: number;
}

/** Total shippable weight. Items with no weight recorded fall back to the
 *  configured default rather than shipping as if they were weightless. */
export function totalCartWeight(
  lines: CartWeightLine[],
  defaultItemGrams: number,
): number {
  return lines.reduce(
    (sum, l) => sum + (l.weightGrams > 0 ? l.weightGrams : defaultItemGrams) * l.qty,
    0,
  );
}

/**
 * The band a weight falls into, using carrier tariff semantics: a band
 * labelled "up to 2 kg" INCLUDES a parcel of exactly 2.000 kg. Whole kilos are
 * where real parcels cluster, so a half-open range would overcharge a large
 * share of orders by pushing them into the next band.
 *
 * Returns null when nothing covers the weight — heavier than every band with
 * no open-ended top. Declining to quote is the safe failure; falling back to
 * the heaviest band would undercharge a 40 kg parcel at the 20 kg price.
 */
export function findBracket(
  brackets: WeightBracket[],
  grams: number,
): WeightBracket | null {
  const ordered = [...brackets].sort((a, b) => a.minGrams - b.minGrams);
  for (const b of ordered) {
    if (grams < b.minGrams) continue;
    if (b.maxGrams === null) return b;
    if (grams <= b.maxGrams) return b;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export function zoneForCountry(zones: Zone[], countryCode: string): Zone | null {
  const code = countryCode.toUpperCase();
  return (
    zones.find((z) => z.enabled && z.countries.includes(code)) ?? null
  );
}

export interface ResolvedRate {
  rate: Rate;
  source: "country-override" | "zone";
}

/** A country override always beats the zone rate — that is the whole point of
 *  an override, and it is why the USA and Canada can price differently while
 *  sitting in the same region. */
export function resolveRate(
  table: PricingTable,
  opts: { countryCode: string; courierId: string; bracketId: string },
): ResolvedRate | null {
  const code = opts.countryCode.toUpperCase();

  const override = table.rates.find(
    (r) =>
      r.enabled &&
      r.countryCode?.toUpperCase() === code &&
      r.courierId === opts.courierId &&
      r.bracketId === opts.bracketId,
  );
  if (override) return { rate: override, source: "country-override" };

  const zone = zoneForCountry(table.zones, code);
  if (!zone) return null;

  const zoneRate = table.rates.find(
    (r) =>
      r.enabled &&
      r.zoneId === zone.id &&
      r.courierId === opts.courierId &&
      r.bracketId === opts.bracketId,
  );
  return zoneRate ? { rate: zoneRate, source: "zone" } : null;
}

/** Most specific enabled rule wins: country, then zone, then global. */
export function resolveTax(
  table: PricingTable,
  countryCode: string,
): TaxRule | null {
  const code = countryCode.toUpperCase();
  const enabled = table.taxRules.filter((r) => r.enabled);

  const byCountry = enabled.find(
    (r) => r.scope === "country" && r.countryCode?.toUpperCase() === code,
  );
  if (byCountry) return byCountry;

  const zone = zoneForCountry(table.zones, code);
  if (zone) {
    const byZone = enabled.find((r) => r.scope === "zone" && r.zoneId === zone.id);
    if (byZone) return byZone;
  }

  return enabled.find((r) => r.scope === "global") ?? null;
}

// ---------------------------------------------------------------------------
// Shipping options
// ---------------------------------------------------------------------------

export interface ShippingOption {
  courierId: string;
  courierCode: string;
  courierName: string;
  priceKobo: number;
  free: boolean;
  minDays: number;
  maxDays: number;
  source: "country-override" | "zone";
}

export interface ShippingLookup {
  options: ShippingOption[];
  zone: Zone | null;
  bracket: WeightBracket | null;
  /** Why there is nothing to offer, for an honest empty state. */
  reason: "ok" | "no-zone" | "over-max-weight" | "no-rate";
}

export function shippingOptionsFor(
  table: PricingTable,
  opts: { countryCode: string; weightGrams: number; subtotalKobo: number },
): ShippingLookup {
  const zone = zoneForCountry(table.zones, opts.countryCode);
  const bracket = findBracket(table.brackets, opts.weightGrams);

  if (!bracket) {
    return { options: [], zone, bracket: null, reason: "over-max-weight" };
  }

  const options: ShippingOption[] = [];
  for (const courier of table.couriers.filter((c) => c.enabled)) {
    const found = resolveRate(table, {
      countryCode: opts.countryCode,
      courierId: courier.id,
      bracketId: bracket.id,
    });
    if (!found) continue;

    const free =
      found.rate.freeOverKobo != null &&
      opts.subtotalKobo >= found.rate.freeOverKobo;

    options.push({
      courierId: courier.id,
      courierCode: courier.code,
      courierName: courier.displayName || courier.name,
      priceKobo: free ? 0 : found.rate.priceKobo,
      free,
      minDays: courier.minDays,
      maxDays: courier.maxDays,
      source: found.source,
    });
  }

  options.sort((a, b) => a.priceKobo - b.priceKobo);

  const reason: ShippingLookup["reason"] =
    options.length > 0 ? "ok" : zone ? "no-rate" : "no-zone";

  return { options, zone, bracket, reason };
}

// ---------------------------------------------------------------------------
// Discounts
// ---------------------------------------------------------------------------

export type DiscountRejection =
  | "unknown"
  | "disabled"
  | "not-started"
  | "expired"
  | "exhausted"
  | "below-minimum"
  | "not-first-order";

export interface DiscountCheck {
  valid: boolean;
  reason?: DiscountRejection;
  message?: string;
}

const REJECTION_MESSAGE: Record<DiscountRejection, string> = {
  unknown: "That code isn't recognised.",
  disabled: "That code is no longer active.",
  "not-started": "That code isn't active yet.",
  expired: "That code has expired.",
  exhausted: "That code has reached its limit.",
  "below-minimum": "Your bag doesn't meet this code's minimum.",
  "not-first-order": "That code is for first orders only.",
};

/** Validate a code against the bag and the customer. `now` is injected so the
 *  result is deterministic and testable. */
export function checkDiscount(
  code: DiscountCode | null,
  ctx: { subtotalKobo: number; isFirstOrder: boolean; now: Date },
): DiscountCheck {
  const reject = (reason: DiscountRejection): DiscountCheck => ({
    valid: false,
    reason,
    message: REJECTION_MESSAGE[reason],
  });

  if (!code) return reject("unknown");
  if (!code.enabled) return reject("disabled");
  if (code.startsAt && ctx.now < new Date(code.startsAt)) return reject("not-started");
  if (code.endsAt && ctx.now > new Date(code.endsAt)) return reject("expired");
  if (code.usageLimit != null && code.usedCount >= code.usageLimit) {
    return reject("exhausted");
  }
  if (ctx.subtotalKobo < code.minSubtotalKobo) return reject("below-minimum");
  if (code.firstTimeOnly && !ctx.isFirstOrder) return reject("not-first-order");

  return { valid: true };
}

/** What a valid code is worth against this bag. Never exceeds what it applies
 *  to, so a discount can't make an order negative. */
export function discountAmount(
  code: DiscountCode,
  opts: { subtotalKobo: number; shippingKobo: number },
): number {
  switch (code.kind) {
    case "free_shipping":
      return opts.shippingKobo;
    case "fixed":
      return Math.min(code.amountKobo ?? 0, opts.subtotalKobo);
    case "percent": {
      const raw = Math.round((opts.subtotalKobo * (code.percentBps ?? 0)) / 10000);
      const capped =
        code.maxDiscountKobo != null
          ? Math.min(raw, code.maxDiscountKobo)
          : raw;
      return Math.min(capped, opts.subtotalKobo);
    }
  }
}

// ---------------------------------------------------------------------------
// The total
// ---------------------------------------------------------------------------

export interface PriceBreakdown {
  subtotalKobo: number;
  shippingKobo: number;
  taxKobo: number;
  discountKobo: number;
  totalKobo: number;
  taxLabel: string;
  /** Null when no rule applies — the UI says "No Tax" rather than hiding it. */
  taxRateBps: number | null;
  discountCode: string | null;
  freeShipping: boolean;
}

/**
 * Apply the identity.
 *
 * Tax is charged on what the customer actually pays for goods, i.e. after the
 * discount, and on shipping only where the jurisdiction taxes carriage. That
 * keeps the arithmetic honest AND preserves the displayed identity: with a
 * ₦100 bag, ₦10 shipping, ₦20 off and 7.5% tax, tax is 7.5% of ₦80 = ₦6, and
 * 100 + 10 + 6 − 20 = 96, which is exactly 80 goods + 10 shipping + 6 tax.
 */
export function priceOrder(input: {
  subtotalKobo: number;
  shippingKobo: number;
  taxRule: TaxRule | null;
  discount?: { code: DiscountCode; amountKobo: number } | null;
}): PriceBreakdown {
  const subtotal = Math.max(0, Math.round(input.subtotalKobo));
  const shipping = Math.max(0, Math.round(input.shippingKobo));
  const discount = Math.max(0, Math.round(input.discount?.amountKobo ?? 0));

  const freeShipping = input.discount?.code.kind === "free_shipping";
  const discountedGoods = Math.max(0, subtotal - (freeShipping ? 0 : discount));
  const taxedShipping = freeShipping ? 0 : shipping;

  let tax = 0;
  if (input.taxRule && input.taxRule.enabled && input.taxRule.rateBps > 0) {
    const base =
      discountedGoods + (input.taxRule.appliesToShipping ? taxedShipping : 0);
    tax = Math.round((base * input.taxRule.rateBps) / 10000);
  }

  const total = Math.max(0, subtotal + shipping + tax - discount);

  return {
    subtotalKobo: subtotal,
    shippingKobo: shipping,
    taxKobo: tax,
    discountKobo: discount,
    totalKobo: total,
    taxLabel: input.taxRule?.label ?? "Tax",
    taxRateBps: input.taxRule?.enabled ? input.taxRule.rateBps : null,
    discountCode: input.discount?.code.code ?? null,
    freeShipping,
  };
}
