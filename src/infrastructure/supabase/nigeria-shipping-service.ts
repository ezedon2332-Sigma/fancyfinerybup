import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import type { NgDestination, NgState } from "@/domain/shipping/nigeria";

/**
 * The generated database types are produced from the deployed schema and do
 * not know about ng_states / ng_destinations yet — their migration ships with
 * this change. Reading through an unparameterised client keeps the queries
 * compiling without inventing hand-written types that would then have to be
 * kept in step with the generated ones. Regenerating the types after the
 * migration is applied lets this narrow to the real client.
 */
function db(): SupabaseClient {
  return createSupabaseAdminClient() as unknown as SupabaseClient;
}

/**
 * Nigeria local delivery data access.
 *
 * Reads are scoped so checkout only ever pulls the destinations for the one
 * state a customer picked — the table is built to hold thousands of rows across
 * thirty-seven states, and shipping all of them to the browser to filter on the
 * client would undo the point of the schema.
 *
 * Public reads filter to `enabled` here rather than at the call site, so a new
 * surface cannot accidentally sell a withdrawn area by forgetting the filter.
 */

interface StateRow {
  id: string;
  name: string;
  code: string | null;
  enabled: boolean;
  sort_order: number;
}

interface DestinationRow {
  id: string;
  state_id: string;
  name: string;
  price_kobo: number;
  enabled: boolean;
  sort_order: number;
}

const toState = (r: StateRow): NgState => ({
  id: r.id,
  name: r.name,
  code: r.code,
  enabled: r.enabled,
});

const toDestination = (r: DestinationRow): NgDestination => ({
  id: r.id,
  stateId: r.state_id,
  name: r.name,
  priceKobo: r.price_kobo,
  enabled: r.enabled,
});

/** Every state a customer may pick. */
export async function listStates(): Promise<NgState[]> {
  try {
    const admin = db();
    const { data } = await admin
      .from("ng_states")
      .select("id, name, code, enabled, sort_order")
      .eq("enabled", true)
      .order("name", { ascending: true });
    return ((data ?? []) as StateRow[]).map(toState);
  } catch {
    // A states outage must not take checkout down; the international engine
    // still quotes Nigeria by weight.
    return [];
  }
}

/** Destinations for one state. The only query checkout makes per selection. */
export async function listDestinations(
  stateId: string,
): Promise<NgDestination[]> {
  if (!stateId?.trim()) return [];
  try {
    const admin = db();
    const { data } = await admin
      .from("ng_destinations")
      .select("id, state_id, name, price_kobo, enabled, sort_order")
      .eq("state_id", stateId)
      .eq("enabled", true)
      .order("price_kobo", { ascending: true })
      .order("name", { ascending: true });
    return ((data ?? []) as DestinationRow[]).map(toDestination);
  } catch {
    return [];
  }
}

/**
 * One destination by id, for the server-side price check.
 *
 * Checkout must never price an order from a figure the browser sent. This is
 * the read the quote and the order both go through.
 */
export async function findDestination(
  id: string,
): Promise<NgDestination | null> {
  if (!id?.trim()) return null;
  try {
    const admin = db();
    const { data } = await admin
      .from("ng_destinations")
      .select("id, state_id, name, price_kobo, enabled, sort_order")
      .eq("id", id)
      .maybeSingle();
    return data ? toDestination(data as DestinationRow) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminState extends NgState {
  destinationCount: number;
}

/** Every state including disabled ones, with how many areas each holds. */
export async function listStatesForAdmin(): Promise<AdminState[]> {
  const admin = db();
  const [{ data: states }, { data: dests }] = await Promise.all([
    admin
      .from("ng_states")
      .select("id, name, code, enabled, sort_order")
      .order("name", { ascending: true }),
    admin.from("ng_destinations").select("state_id"),
  ]);

  const counts = new Map<string, number>();
  for (const d of (dests ?? []) as { state_id: string }[]) {
    counts.set(d.state_id, (counts.get(d.state_id) ?? 0) + 1);
  }

  return ((states ?? []) as StateRow[]).map((s) => ({
    ...toState(s),
    destinationCount: counts.get(s.id) ?? 0,
  }));
}

/** Destinations for a state, disabled ones included. */
export async function listDestinationsForAdmin(
  stateId: string,
): Promise<NgDestination[]> {
  const admin = db();
  const { data } = await admin
    .from("ng_destinations")
    .select("id, state_id, name, price_kobo, enabled, sort_order")
    .eq("state_id", stateId)
    .order("name", { ascending: true });
  return ((data ?? []) as DestinationRow[]).map(toDestination);
}

export type WriteResult = { ok: boolean; error?: string };

function friendly(message: string): string {
  return /duplicate key|unique/i.test(message)
    ? "That name already exists here."
    : message;
}

export async function upsertState(input: {
  id?: string;
  name: string;
  code: string | null;
  enabled: boolean;
}): Promise<WriteResult> {
  const admin = db();
  const row = {
    name: input.name.trim(),
    code: input.code?.trim() || null,
    enabled: input.enabled,
  };
  const { error } = input.id
    ? await admin.from("ng_states").update(row).eq("id", input.id)
    : await admin.from("ng_states").insert(row);
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

/** Removing a state removes its destinations too, by cascade. */
export async function deleteState(id: string): Promise<WriteResult> {
  const admin = db();
  const { error } = await admin.from("ng_states").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function upsertDestination(input: {
  id?: string;
  stateId: string;
  name: string;
  priceKobo: number;
  enabled: boolean;
}): Promise<WriteResult> {
  const admin = db();
  const row = {
    state_id: input.stateId,
    name: input.name.trim(),
    price_kobo: Math.max(0, Math.round(input.priceKobo)),
    enabled: input.enabled,
  };
  const { error } = input.id
    ? await admin.from("ng_destinations").update(row).eq("id", input.id)
    : await admin.from("ng_destinations").insert(row);
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

export async function deleteDestination(id: string): Promise<WriteResult> {
  const admin = db();
  const { error } = await admin.from("ng_destinations").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setDestinationEnabled(
  id: string,
  enabled: boolean,
): Promise<WriteResult> {
  const admin = db();
  const { error } = await admin
    .from("ng_destinations")
    .update({ enabled })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
