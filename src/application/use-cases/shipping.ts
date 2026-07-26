import type { ShippingRepository } from "@/domain/repositories/shipping-repository";
import {
  convertFromNgnMinor,
  orderCurrencyForCountry,
  type OrderCurrency,
} from "@/domain/shipping/currency";
import type {
  ShippingCountry,
  ShippingQuote,
  ShippingQuoteOption,
} from "@/domain/shipping/shipping";
import {
  calculateShipping,
  computeTotals,
  type MoneyBreakdown,
} from "@/domain/shipping/engine";

export interface ShippingDeps {
  shipping: ShippingRepository;
}

export class ShippingError extends Error {}

/**
 * Shipping quotes and authoritative checkout resolution.
 *
 * Two rate sources, tried in order:
 *   1. The zone / country-override / weight-bracket rate table (the engine).
 *   2. The legacy flat per-country prices in `shipping_countries`.
 *
 * The fallback is deliberate. It means the engine migration can land, and the
 * admin can fill the rate table in over days, without checkout ever being
 * unable to price an order. A destination switches to engine pricing the
 * moment a matching rate row exists for it.
 */

function legacyOptions(
  country: ShippingCountry,
  subtotalNgn: number,
  currency: OrderCurrency,
  ngnPerUsd: number,
): ShippingQuoteOption[] {
  const freeByThreshold =
    country.freeOver != null && subtotalNgn >= country.freeOver;

  const build = (
    method: "standard" | "express",
    priceNgn: number | null,
    minDays: number,
    maxDays: number,
  ): ShippingQuoteOption | null => {
    if (priceNgn == null) return null;
    const free = freeByThreshold || priceNgn === 0;
    return {
      method,
      cost: free ? 0 : convertFromNgnMinor(priceNgn, currency, ngnPerUsd),
      currency,
      minDays,
      maxDays,
      free,
    };
  };

  return [
    build(
      "standard",
      country.standardPrice,
      country.standardMinDays,
      country.standardMaxDays,
    ),
    build(
      "express",
      country.expressPrice,
      country.expressMinDays,
      country.expressMaxDays,
    ),
  ].filter((o): o is ShippingQuoteOption => o !== null);
}

export interface QuoteParams {
  countryCode: string;
  /** Server-recomputed cart subtotal in NGN kobo. Never client-supplied. */
  subtotalNgn: number;
  /** Server-recomputed total cart weight in grams. */
  weightGrams: number;
}

/**
 * Compute a shipping quote for display, including the full money breakdown so
 * the checkout summary and the order that follows agree line for line.
 */
export async function getShippingQuote(
  deps: ShippingDeps,
  params: QuoteParams,
): Promise<ShippingQuote> {
  const [country, settings, table] = await Promise.all([
    deps.shipping.getCountry(params.countryCode),
    deps.shipping.getSettings(),
    deps.shipping.getRateTable(),
  ]);

  // The legacy table is still the source of truth for *whether* we ship
  // somewhere, so an admin disabling a country keeps working as before.
  if (country && !country.enabled) {
    throw new ShippingError("We don't currently ship to that country.");
  }

  const currency = orderCurrencyForCountry(params.countryCode);
  const { ngnPerUsd } = settings;

  const engine = calculateShipping(table, {
    countryCode: params.countryCode,
    weightGrams: params.weightGrams,
    subtotalNgn: params.subtotalNgn,
  });

  let options: ShippingQuoteOption[];
  if (engine.options.length > 0) {
    options = engine.options.map((o) => ({
      method: o.methodCode,
      methodName: o.methodName,
      cost: convertFromNgnMinor(o.priceNgn, currency, ngnPerUsd),
      currency,
      minDays: o.minDays,
      maxDays: o.maxDays,
      free: o.free,
    }));
  } else if (country) {
    options = legacyOptions(country, params.subtotalNgn, currency, ngnPerUsd);
  } else {
    throw new ShippingError("We don't currently ship to that country.");
  }

  if (options.length === 0) {
    throw new ShippingError(
      "No shipping method is available for this destination and weight.",
    );
  }

  const subtotal = convertFromNgnMinor(params.subtotalNgn, currency, ngnPerUsd);

  return {
    countryCode: params.countryCode.toUpperCase(),
    countryName: country?.name ?? engine.zone?.name ?? params.countryCode,
    currency,
    subtotal,
    weightGrams: params.weightGrams,
    bracketLabel: engine.bracket?.label ?? null,
    zoneName: engine.zone?.name ?? null,
    options,
    // Breakdown for the cheapest option, so the summary has something to show
    // before a method is picked.
    breakdown: computeTotals(
      { subtotal, shipping: Math.min(...options.map((o) => o.cost)) },
      settings,
    ),
    taxConfig: {
      taxEnabled: settings.taxEnabled,
      taxRateBps: settings.taxRateBps,
      taxLabel: settings.taxLabel,
      discountEnabled: settings.discountEnabled,
      discountBps: settings.discountBps,
      discountLabel: settings.discountLabel,
    },
  };
}

export interface ResolvedShipping {
  currency: OrderCurrency;
  ngnPerUsd: number;
  subtotal: number;
  shippingCost: number;
  tax: number;
  discount: number;
  total: number;
  method: string;
  minDays: number;
  maxDays: number;
  free: boolean;
  countryName: string;
  weightGrams: number;
  breakdown: MoneyBreakdown;
}

/**
 * Authoritatively resolve what an order costs. Validates the destination and
 * that the chosen method is genuinely offered, then returns every line already
 * converted into the order's currency. Client prices are never trusted.
 */
export async function resolveShipping(
  deps: ShippingDeps,
  params: { countryCode: string; method: string; subtotalNgn: number; weightGrams: number },
): Promise<ResolvedShipping> {
  const [country, settings, table] = await Promise.all([
    deps.shipping.getCountry(params.countryCode),
    deps.shipping.getSettings(),
    deps.shipping.getRateTable(),
  ]);

  if (country && !country.enabled) {
    throw new ShippingError("We don't currently ship to that country.");
  }

  const currency = orderCurrencyForCountry(params.countryCode);
  const { ngnPerUsd } = settings;

  const engine = calculateShipping(table, {
    countryCode: params.countryCode,
    weightGrams: params.weightGrams,
    subtotalNgn: params.subtotalNgn,
  });

  let priceNgn: number | null = null;
  let minDays = 0;
  let maxDays = 0;
  let free = false;

  const engineChoice = engine.options.find((o) => o.methodCode === params.method);
  if (engineChoice) {
    priceNgn = engineChoice.priceNgn;
    minDays = engineChoice.minDays;
    maxDays = engineChoice.maxDays;
    free = engineChoice.free;
  } else if (
    country &&
    engine.options.length === 0 &&
    (params.method === "standard" || params.method === "express")
  ) {
    // Legacy path — only when the engine has nothing at all for this
    // destination, so a configured zone can never be silently bypassed.
    const legacy = legacyOptions(country, params.subtotalNgn, currency, ngnPerUsd).find(
      (o) => o.method === params.method,
    );
    if (legacy) {
      priceNgn =
        legacy.free
          ? 0
          : params.method === "express"
            ? (country.expressPrice ?? 0)
            : country.standardPrice;
      minDays = legacy.minDays;
      maxDays = legacy.maxDays;
      free = legacy.free;
    }
  }

  if (priceNgn == null) {
    throw new ShippingError(
      "That shipping method isn't available for your country and order weight.",
    );
  }

  const subtotal = convertFromNgnMinor(params.subtotalNgn, currency, ngnPerUsd);
  const shippingCost = free ? 0 : convertFromNgnMinor(priceNgn, currency, ngnPerUsd);
  const breakdown = computeTotals({ subtotal, shipping: shippingCost }, settings);

  return {
    currency,
    ngnPerUsd,
    subtotal: breakdown.subtotal,
    shippingCost: breakdown.shipping,
    tax: breakdown.tax,
    discount: breakdown.discount,
    total: breakdown.total,
    method: params.method,
    minDays,
    maxDays,
    free,
    countryName: country?.name ?? engine.zone?.name ?? params.countryCode,
    weightGrams: params.weightGrams,
    breakdown,
  };
}
