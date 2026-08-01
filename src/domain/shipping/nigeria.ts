/**
 * Nigeria local delivery.
 *
 * A flat fee per named destination, picked by the customer, instead of the
 * weight brackets the international engine uses. The two never mix: this module
 * knows nothing about zones, couriers or parcel weight, and the international
 * path knows nothing about states.
 *
 * Everything here is pure. Which rows exist is the database's business; what a
 * given selection means is decided here, so it can be tested without one.
 */

export const NIGERIA_COUNTRY_CODE = "NG";

/**
 * Courier id for the synthetic local-delivery option. Deliberately not a uuid:
 * it names something that is not a courier row, and a fake uuid here would sit
 * in the same field as real ones waiting to be looked up and not found.
 */
export const LOCAL_DELIVERY_ID = "ng-local-delivery";

export interface NgState {
  id: string;
  name: string;
  code: string | null;
  enabled: boolean;
}

export interface NgDestination {
  id: string;
  stateId: string;
  name: string;
  priceKobo: number;
  enabled: boolean;
}

/** What the checkout screen should be showing right now. */
export type NgStep =
  /** Not shipping to Nigeria — this module sits out entirely. */
  | { step: "not-applicable" }
  /** Waiting for a state. */
  | { step: "choose-state" }
  /** State chosen, waiting for a destination. */
  | { step: "choose-destination"; stateId: string }
  /**
   * State chosen but nothing configured for it yet. Not an error: the house
   * simply has not priced that state, so the international engine quotes it.
   */
  | { step: "no-destinations"; stateId: string }
  /** Done — this is the fee. */
  | { step: "resolved"; stateId: string; destination: NgDestination };

export function isNigeria(countryCode: string | null | undefined): boolean {
  return (countryCode ?? "").trim().toUpperCase() === NIGERIA_COUNTRY_CODE;
}

/**
 * Work out the next thing to ask the customer.
 *
 * Written as one function returning a single state rather than a handful of
 * booleans in the component, because "show only the next required selection"
 * is a rule about the whole flow — spread across four `&&`s in JSX it drifts
 * the first time someone adds a case.
 *
 * A destination that has been disabled since it was chosen is treated as not
 * chosen, so a withdrawn area cannot be checked out at a stale price.
 */
export function resolveStep(input: {
  countryCode: string | null | undefined;
  stateId: string | null | undefined;
  destinationId: string | null | undefined;
  /** Destinations already loaded for `stateId`. */
  destinations: NgDestination[];
  /** False while the list for this state is still in flight. */
  loaded: boolean;
}): NgStep {
  if (!isNigeria(input.countryCode)) return { step: "not-applicable" };

  const stateId = input.stateId?.trim();
  if (!stateId) return { step: "choose-state" };

  const usable = input.destinations.filter(
    (d) => d.enabled && d.stateId === stateId,
  );

  // Still loading: keep asking for a destination rather than flashing the
  // "nothing here" message and then replacing it a moment later.
  if (!input.loaded) return { step: "choose-destination", stateId };

  if (usable.length === 0) return { step: "no-destinations", stateId };

  const chosen = usable.find((d) => d.id === input.destinationId);
  if (!chosen) return { step: "choose-destination", stateId };

  return { step: "resolved", stateId, destination: chosen };
}

/**
 * The delivery fee in kobo, or null when this order is not a resolved Nigerian
 * local delivery and should fall through to the international engine.
 *
 * The lookup re-reads the destination from the supplied rows rather than
 * trusting a price sent alongside the id — the id is the only part of the
 * customer's selection worth believing.
 */
export function localFeeKobo(input: {
  countryCode: string | null | undefined;
  destinationId: string | null | undefined;
  destinations: NgDestination[];
}): number | null {
  if (!isNigeria(input.countryCode)) return null;
  const id = input.destinationId?.trim();
  if (!id) return null;

  const found = input.destinations.find((d) => d.id === id && d.enabled);
  if (!found) return null;
  return Number.isFinite(found.priceKobo) && found.priceKobo >= 0
    ? Math.round(found.priceKobo)
    : null;
}

/** Alphabetical, with the FCT filed where people look for it. */
export function sortStates(states: NgState[]): NgState[] {
  return [...states]
    .filter((s) => s.enabled)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/** Cheapest first, then alphabetical — the order a customer scans in. */
export function sortDestinations(destinations: NgDestination[]): NgDestination[] {
  return [...destinations]
    .filter((d) => d.enabled)
    .sort(
      (a, b) =>
        a.priceKobo - b.priceKobo || a.name.localeCompare(b.name, "en"),
    );
}

/** Case- and space-insensitive search, for the admin table. */
export function matchesQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.trim().toLowerCase().includes(q);
}
