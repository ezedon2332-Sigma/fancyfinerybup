/**
 * Carrier port.
 *
 * A method with `rateSource: 'carrier'` is priced by a live courier API rather
 * than the rate table. Everything a courier needs is in this one interface, so
 * adding DHL, FedEx, UPS, USPS, Aramex, EMS, Shippo or EasyPost means writing
 * an adapter and registering it — no schema change, no change to the engine,
 * no change to checkout.
 *
 * Adapters live in infrastructure. This file stays pure so the domain never
 * depends on any courier SDK.
 */

export interface CarrierAddress {
  readonly countryCode: string;
  readonly postal?: string | null;
  readonly city?: string | null;
  readonly state?: string | null;
}

export interface CarrierParcel {
  readonly weightGrams: number;
  /** Declared value in NGN kobo — several couriers require it for customs. */
  readonly valueNgn: number;
}

export interface CarrierRateRequest {
  readonly destination: CarrierAddress;
  readonly parcel: CarrierParcel;
  /** Opaque per-method config from `shipping_methods.carrier_config`. */
  readonly config: Record<string, unknown>;
}

export interface CarrierRateOffer {
  /** Courier's own service identifier, e.g. "EXPRESS_WORLDWIDE". */
  readonly serviceCode: string;
  readonly serviceName: string;
  /** Price in NGN minor units, already converted by the adapter. */
  readonly priceNgn: number;
  readonly minDays: number;
  readonly maxDays: number;
}

export interface CarrierRateResult {
  readonly ok: boolean;
  readonly offers: CarrierRateOffer[];
  readonly error?: string;
}

/** What every courier adapter implements. */
export interface CarrierRateProvider {
  readonly code: string;
  readonly name: string;
  quote(request: CarrierRateRequest): Promise<CarrierRateResult>;
}

/**
 * Adapter registry. Empty until a courier is integrated; the engine treats an
 * unregistered carrier as "no live rates" and simply offers nothing for that
 * method, which is why an unconfigured integration degrades quietly instead of
 * failing checkout.
 */
const registry = new Map<string, CarrierRateProvider>();

export function registerCarrier(provider: CarrierRateProvider): void {
  registry.set(provider.code, provider);
}

export function getCarrier(code: string | null): CarrierRateProvider | null {
  return code ? (registry.get(code) ?? null) : null;
}

export function registeredCarriers(): string[] {
  return [...registry.keys()];
}
