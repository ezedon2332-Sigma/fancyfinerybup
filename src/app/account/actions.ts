"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/infrastructure/supabase/auth";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
import { profileSchema } from "@/lib/validation";

/** Sign the current user out and return to the home page. */
export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export interface ProfileResult {
  ok: boolean;
  error?: string;
}

/** Update the signed-in user's name + saved delivery address. */
export async function updateProfile(payload: unknown): Promise<ProfileResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const parsed = profileSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }
  const p = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: p.fullName ?? null,
      phone: p.phone ?? null,
      address: p.address ?? null,
      city: p.city ?? null,
      state: p.state ?? null,
      country: p.country ?? null,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/account");
  return { ok: true };
}
