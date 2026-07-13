"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser, requireAdmin } from "@/infrastructure/supabase/auth";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";

const roleSchema = z.enum(["customer", "admin"]);

export interface RoleResult {
  ok: boolean;
  error?: string;
}

/** Grant or revoke the admin role. Uses the secret key (system context) so the
 *  role-escalation guard permits it. Prevents self-demotion (lock-out). */
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

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role: parsed.data })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${userId}`);
  return { ok: true };
}
