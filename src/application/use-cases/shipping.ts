import type { ShippingRepository } from "@/domain/repositories/shipping-repository";
import {
  convertFromNgnMinor,
  orderCurrencyForCountry,
  type OrderCurrency,
} from "@/domain/shipping/currency";
import type {
  ShippingCountry,
  ShippingMethod,
  ShippingQuote,
  ShippingQuoteOption,
} from "@/domain/shipping/shipping";

export interface ShippingDeps {
  shipping: ShippingRepository;
}

export class ShippingError extends Error {}

/** NGN-kobo price of a method for a country, or null if not offered. */
function methodPriceNgn(
  country: ShippingCountry,
  method: ShippingMethod,
): number | null {
  return method === "express" ? country.expressPrice : country.standardPrice;
}

function isFree(country: ShippingCountry, subtotalNgn: number): boolean {
  return country.freeOver != null && subtotalNgn >= country.freeOver;
}

function buildOption(
  country: ShippingCountry,
  method: ShippingMethod,
  subtotalNgn: number,
  currency: OrderCurrency,
  ngnPerUsd: number,
): ShippingQuoteOption | null {
  const priceNgn = methodPriceNgn(country, method);
  if (priceNgn == null) return null; // method not offered
  const free = isFree(country, subtotalNgn) || priceNgn === 0;
  const cost = free ? 0 : convertFromNgnMinor(priceNgn, currency, ngnPerUsd);
  return {
    method,
    cost,
    currency,
    minDays: method === "express" ? country.expressMinDays : country.standardMinDays,
    maxDays: method === "express" ? country.expressMaxDays : country.standardMaxDays,
    free,
  };
}

/**
 * Compute a shipping quote for display. `subtotalNgn` MUST be the server-side
 * recomputed cart subtotal in NGN kobo — never a client-supplied amount.
 */
export async function getShippingQuote(
  deps: ShippingDeps,
  params: { countryCode: string; subtotalNgn: number },
): Promise<ShippingQuote> {
  const country = await deps.shipping.getCountry(params.countryCode);
  if (!country || !country.enabled) {
    throw new ShippingError("We don't currently ship to that country.");
  }
  const { ngnPerUsd } = await deps.shipping.getSettings();
  const currency = orderCurrencyForCountry(country.code);

  const options = (["standard", "express"] as ShippingMethod[])
    .map((m) => buildOption(country, m, params.subtotalNgn, currency, ngnPerUsd))
    .filter((o): o is ShippingQuoteOption => o !== null);

  return {
    countryCode: country.code,
    countryName: country.name,
    currency,
    subtotal: convertFromNgnMinor(params.subtotalNgn, currency, ngnPerUsd),
    options,
  };
}

export interface ResolvedShipping {
  currency: OrderCurrency;
  ngnPerUsd: number;
  /** Subtotal converted into the order currency (minor units). */
  subtotal: number;
  /** Shipping cost in the order currency (minor units). */
  shippingCost: number;
  total: number;
  method: ShippingMethod;
  minDays: number;
  maxDays: number;
  free: boolean;
  countryName: string;
}

/**
 * Authoritatively resolve the shipping charge for an order at checkout.
 * Validates the country is shippable and the method is offered, then returns
 * amounts already converted into the order's currency. Never trusts client prices.
 */
export async function resolveShipping(
  deps: ShippingDeps,
  params: { countryCode: string; method: ShippingMethod; subtotalNgn: number },
): Promise<ResolvedShipping> {
  const country = await deps.shipping.getCountry(params.countryCode);
  if (!country || !country.enabled) {
    throw new ShippingError("We don't currently ship to that country.");
  }
  const priceNgn = methodPriceNgn(country, params.method);
  if (priceNgn == null) {
    throw new ShippingError("That shipping method isn't available for your country.");
  }

  const { ngnPerUsd } = await deps.shipping.getSettings();
  const currency = orderCurrencyForCountry(country.code);
  const free = isFree(country, params.subtotalNgn) || priceNgn === 0;

  const subtotal = convertFromNgnMinor(params.subtotalNgn, currency, ngnPerUsd);
  const shippingCost = free
    ? 0
    : convertFromNgnMinor(priceNgn, currency, ngnPerUsd);

  return {
    currency,
    ngnPerUsd,
    subtotal,
    shippingCost,
    total: subtotal + shippingCost,
    method: params.method,
    minDays:
      params.method === "express" ? country.expressMinDays : country.standardMinDays,
    maxDays:
      params.method === "express" ? country.expressMaxDays : country.standardMaxDays,
    free,
    countryName: country.name,
  };
}
