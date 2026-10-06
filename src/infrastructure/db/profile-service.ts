import "server-only";

import { eq } from "drizzle-orm";

import type { Profile } from "@/domain/entities/profile";
import { db } from "./client";
import { profiles } from "./schema";
import { toProfile } from "./mappers";

/**
 * Profile reads and writes.
 *
 * Every function takes the `userId` it is to act on and scopes the statement to
 * it. That parameter is the security control, not ceremony: under Supabase the
 * `profiles_update_self_or_admin` RLS policy supplied `id = auth.uid()`
 * invisibly, and with RLS gone the filter has to live somewhere a caller cannot
 * forget it. Callers pass the id from the SESSION, never from a request body.
 */

export interface DeliveryAddressInput {
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const row = await db.query.profiles.findFirst({
    where: eq(profiles.id, userId),
  });
  return row ? toProfile(row) : null;
}

/**
 * Remember the delivery details a customer just checked out with, so the next
 * order prefills.
 *
 * Only the fields actually supplied are written. The checkout path has no
 * latitude or longitude to offer and must not blank a pin the customer set on
 * the account screen, which a blanket `?? null` on every column would do.
 */
export async function saveDeliveryAddress(
  userId: string,
  input: DeliveryAddressInput,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  for (const key of [
    "phone",
    "address",
    "city",
    "state",
    "country",
    "lat",
    "lng",
  ] as const) {
    if (input[key] !== undefined) patch[key] = input[key];
  }
  if (Object.keys(patch).length === 0) return;

  await db.update(profiles).set(patch).where(eq(profiles.id, userId));
}

/** Update the name and saved address together (the account screen's save). */
export async function updateProfileDetails(
  userId: string,
  input: DeliveryAddressInput & { fullName?: string | null },
): Promise<void> {
  const { fullName, ...address } = input;
  const patch: Record<string, unknown> = {};
  if (fullName !== undefined) patch.fullName = fullName;
  for (const key of [
    "phone",
    "address",
    "city",
    "state",
    "country",
    "lat",
    "lng",
  ] as const) {
    if (address[key] !== undefined) patch[key] = address[key];
  }
  if (Object.keys(patch).length === 0) return;

  await db.update(profiles).set(patch).where(eq(profiles.id, userId));
}
