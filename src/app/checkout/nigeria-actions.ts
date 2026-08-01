"use server";

import {
  listDestinations,
  listStates,
} from "@/infrastructure/supabase/nigeria-shipping-service";
import type { NgDestination, NgState } from "@/domain/shipping/nigeria";

/**
 * Nigeria delivery lookups for checkout.
 *
 * Destinations are fetched per state rather than all at once. The table is
 * designed to hold thousands of areas across thirty-seven states, and shipping
 * the lot to the browser so it can filter client-side would throw away the
 * reason for indexing by state in the first place.
 */

export async function fetchNgStates(): Promise<NgState[]> {
  return listStates();
}

export async function fetchNgDestinations(
  stateId: string,
): Promise<NgDestination[]> {
  return listDestinations(stateId);
}
