"use server";

import { revalidatePath } from "next/cache";

import {
  deleteDestination,
  deleteState,
  listDestinationsForAdmin,
  setDestinationEnabled,
  upsertDestination,
  upsertState,
  type WriteResult,
} from "@/infrastructure/supabase/nigeria-shipping-service";
import { requireAdmin } from "@/infrastructure/supabase/auth";
import type { NgDestination } from "@/domain/shipping/nigeria";

/**
 * Nigeria shipping admin.
 *
 * Every action re-checks admin rights. These write the prices customers are
 * charged, so "the page is behind /admin" is not on its own a control — a
 * server action is a public endpoint that happens to be called from a private
 * page.
 */

const PATH = "/admin/shipping/nigeria";

export async function adminListDestinations(
  stateId: string,
): Promise<NgDestination[]> {
  await requireAdmin();
  return listDestinationsForAdmin(stateId);
}

export async function adminSaveState(input: {
  id?: string;
  name: string;
  code: string | null;
  enabled: boolean;
}): Promise<WriteResult> {
  await requireAdmin();
  if (input.name.trim().length < 2) {
    return { ok: false, error: "A state needs a name." };
  }
  const result = await upsertState(input);
  if (result.ok) revalidatePath(PATH);
  return result;
}

export async function adminDeleteState(id: string): Promise<WriteResult> {
  await requireAdmin();
  const result = await deleteState(id);
  if (result.ok) revalidatePath(PATH);
  return result;
}

export async function adminSaveDestination(input: {
  id?: string;
  stateId: string;
  name: string;
  /** Entered in naira; stored in kobo, like every other price. */
  priceNaira: number;
  enabled: boolean;
}): Promise<WriteResult> {
  await requireAdmin();
  if (input.name.trim().length < 2) {
    return { ok: false, error: "A destination needs a name." };
  }
  if (!Number.isFinite(input.priceNaira) || input.priceNaira < 0) {
    return { ok: false, error: "Enter a delivery fee of zero or more." };
  }
  const result = await upsertDestination({
    id: input.id,
    stateId: input.stateId,
    name: input.name,
    priceKobo: Math.round(input.priceNaira * 100),
    enabled: input.enabled,
  });
  if (result.ok) revalidatePath(PATH);
  return result;
}

export async function adminDeleteDestination(
  id: string,
): Promise<WriteResult> {
  await requireAdmin();
  const result = await deleteDestination(id);
  if (result.ok) revalidatePath(PATH);
  return result;
}

export async function adminToggleDestination(
  id: string,
  enabled: boolean,
): Promise<WriteResult> {
  await requireAdmin();
  const result = await setDestinationEnabled(id, enabled);
  if (result.ok) revalidatePath(PATH);
  return result;
}
