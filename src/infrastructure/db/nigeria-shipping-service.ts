import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import type { NgDestination, NgState } from "@/domain/shipping/nigeria";
import type { AdminNgState, WriteResult } from "@/domain/entities/shipping-views";
import { db } from "./client";
import { ngDestinations, ngStates } from "./schema";

/**
 * Nigeria local delivery data access.
 *
 * Reads are scoped so checkout only ever pulls the destinations for the one
 * state a customer picked — the table holds thousands of rows across
 * thirty-seven states, and shipping all of them to the browser to filter on the
 * client would undo the point of the schema.
 *
 * Public reads filter to `enabled` here rather than at the call site, so a new
 * surface cannot accidentally sell a withdrawn area by forgetting the filter.
 *
 * The Supabase version cast its client to an untyped `SupabaseClient` because
 * the generated types predated these two tables. Drizzle introspects the live
 * schema, so they are fully typed now and that escape hatch is gone.
 */

type StateRow = typeof ngStates.$inferSelect;
type DestinationRow = typeof ngDestinations.$inferSelect;

const toState = (r: StateRow): NgState => ({
  id: r.id,
  name: r.name,
  code: r.code,
  enabled: r.enabled,
});

const toDestination = (r: DestinationRow): NgDestination => ({
  id: r.id,
  stateId: r.stateId,
  name: r.name,
  priceKobo: r.priceKobo,
  enabled: r.enabled,
});

/** Every state a customer may pick. */
export async function listStates(): Promise<NgState[]> {
  try {
    const rows = await db
      .select()
      .from(ngStates)
      .where(eq(ngStates.enabled, true))
      .orderBy(asc(ngStates.name));
    return rows.map(toState);
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
    const rows = await db
      .select()
      .from(ngDestinations)
      .where(
        sql`${ngDestinations.stateId} = ${stateId} and ${ngDestinations.enabled} = true`,
      )
      .orderBy(asc(ngDestinations.priceKobo), asc(ngDestinations.name));
    return rows.map(toDestination);
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
    const [row] = await db
      .select()
      .from(ngDestinations)
      .where(eq(ngDestinations.id, id))
      .limit(1);
    return row ? toDestination(row) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Admin — callers must have passed requireAdmin() first.
// ---------------------------------------------------------------------------

/** Every state including disabled ones, with how many areas each holds. */
export async function listStatesForAdmin(): Promise<AdminNgState[]> {
  const rows = await db
    .select({
      id: ngStates.id,
      name: ngStates.name,
      code: ngStates.code,
      enabled: ngStates.enabled,
      destinationCount: sql<number>`count(${ngDestinations.id})::int`,
    })
    .from(ngStates)
    .leftJoin(ngDestinations, eq(ngDestinations.stateId, ngStates.id))
    .groupBy(ngStates.id)
    .orderBy(asc(ngStates.name));
  return rows;
}

/** Destinations for a state, disabled ones included. */
export async function listDestinationsForAdmin(
  stateId: string,
): Promise<NgDestination[]> {
  const rows = await db
    .select()
    .from(ngDestinations)
    .where(eq(ngDestinations.stateId, stateId))
    .orderBy(asc(ngDestinations.name));
  return rows.map(toDestination);
}

function friendly(message: string): string {
  return /duplicate key|unique/i.test(message)
    ? "That name already exists here."
    : message;
}

function failure(e: unknown): WriteResult {
  return {
    ok: false,
    error: friendly(e instanceof Error ? e.message : String(e)),
  };
}

export async function upsertState(input: {
  id?: string;
  name: string;
  code: string | null;
  enabled: boolean;
}): Promise<WriteResult> {
  const values = {
    name: input.name.trim(),
    code: input.code?.trim() || null,
    enabled: input.enabled,
  };
  try {
    if (input.id) {
      await db.update(ngStates).set(values).where(eq(ngStates.id, input.id));
    } else {
      await db.insert(ngStates).values(values);
    }
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

/** Removing a state removes its destinations too, by cascade. */
export async function deleteState(id: string): Promise<WriteResult> {
  try {
    await db.delete(ngStates).where(eq(ngStates.id, id));
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function upsertDestination(input: {
  id?: string;
  stateId: string;
  name: string;
  priceKobo: number;
  enabled: boolean;
}): Promise<WriteResult> {
  const values = {
    stateId: input.stateId,
    name: input.name.trim(),
    priceKobo: Math.max(0, Math.round(input.priceKobo)),
    enabled: input.enabled,
  };
  try {
    if (input.id) {
      await db
        .update(ngDestinations)
        .set(values)
        .where(eq(ngDestinations.id, input.id));
    } else {
      await db.insert(ngDestinations).values(values);
    }
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function deleteDestination(id: string): Promise<WriteResult> {
  try {
    await db.delete(ngDestinations).where(eq(ngDestinations.id, id));
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function setDestinationEnabled(
  id: string,
  enabled: boolean,
): Promise<WriteResult> {
  try {
    await db
      .update(ngDestinations)
      .set({ enabled })
      .where(eq(ngDestinations.id, id));
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
