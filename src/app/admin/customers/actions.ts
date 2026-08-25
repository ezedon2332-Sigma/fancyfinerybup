"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser, requireAdmin } from "@/infrastructure/auth/session";
import { eq } from "drizzle-orm";

import { db } from "@/infrastructure/db/client";
import { profiles } from "@/infrastructure/db/schema";

const roleSchema = z.enum(["customer", "admin"]);

export interface RoleResult {
  ok: boolean;
  error?: string;
}

/**
 * Grant or revoke the admin role.
 *
 * Under Supabase this needed the secret key so the `guard_profile_role` trigger
 * (which refused role changes unless `auth.uid()` was an admin) would let it
 * through. That trigger is gone with RLS, so the ONLY thing standing between a
 * caller and an admin promotion is the `requireAdmin()` below. It is not
 * decoration — losing it would make this a privilege-escalation endpoint.
 *
 * Still refuses self-demotion, so the last admin cannot lock themselves out.
 */
export async function updateCustomerRole(
  userId: string,
  role: string,
): Promise<RoleResult> {
  await requireAdmin();
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { ok: false, error: "Invalid role." };

  const me = await getCurrentUser();
  if (me?.id === userId && parsed.data !== "admin") {
    return { ok: false, error: "You can't remove your own admin access." };
  }

  try {
    await db
      .update(profiles)
      .set({ role: parsed.data })
      .where(eq(profiles.id, userId));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${userId}`);
  return { ok: true };
}
